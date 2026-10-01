/**
 * Accusations: a manager proves a defect in a rival's build with a check the
 * engine runs on the rival's commit. Upheld accusations earn points; an
 * accusation whose check fails is perjury and eliminates the accuser.
 */
import fs from 'node:fs';
import {SkillsmithError} from '../../core/errors.js';
import {readJson, writeJson} from '../../core/fs.js';
import * as G from '../../core/git.js';
import {appendLedger, fileHash} from '../../core/ledger.js';
import {clip, nowIso} from '../../core/text.js';
import {runCheck} from '../checks.js';
import type {Project} from '../project.js';
import {runSetup, scrubPath, withCleanroom} from './cleanroom.js';
import {killTeam} from './graveyard.js';
import {loadAcceptance} from './init.js';
import {addEvent, requireAlive, requireArena, saveArena, teamPaths} from './model.js';
import {parseAccusations} from './records.js';

/** Outcome of one accusation. */
export interface AccusationResult {
  id: string;
  against: string;
  text: string;
  status: 'upheld' | 'false' | 'dismissed';
  commit?: string;
  detail: string;
}

/** Contents of accusations-verdict.json. */
export interface AccusationVerdict {
  accuser: string;
  round: number;
  at: string;
  results: AccusationResult[];
}

/** Runs every accusation a team filed. `dryRun` records nothing and kills nobody. */
export async function accuse(
  project: Project,
  accuser: string,
  options: {setup?: boolean; dryRun?: boolean} = {},
): Promise<{results: AccusationResult[]; died: boolean; dryRun: boolean}> {
  const {root, store} = project;
  const arena = requireArena(root);
  const team = requireAlive(arena, accuser);
  const paths = teamPaths(root, accuser);
  const {accusations, errors} = parseAccusations(
    readJson(paths.accusations),
    accuser,
    Object.keys(arena.teams),
  );
  if (errors.length)
    throw new SkillsmithError(`accusations.json is invalid:\n- ${errors.join('\n- ')}`);
  const acceptance = loadAcceptance(root);
  fs.mkdirSync(paths.probes, {recursive: true});

  const results: AccusationResult[] = [];
  for (const target of [...new Set(accusations.map(item => item.against))]) {
    const list = accusations.filter(item => item.against === target);
    const rival = arena.teams[target];
    if (!rival || rival.status !== 'alive') {
      for (const item of list) {
        results.push({
          id: item.id,
          against: target,
          text: item.text,
          status: 'dismissed',
          detail: `${target} is already ${rival?.status ?? 'gone'}`,
        });
      }
      continue;
    }
    const head = G.revParse(root, rival.branch);
    await withCleanroom(root, store, `${accuser}-vs-${target}`, head, async (dir, port) => {
      if (options.setup !== false) await runSetup(acceptance.setup, dir, port);
      for (const item of list) {
        const outcome = await runCheck(item.evidence, {
          dir,
          port,
          env: {SKILLSMITH_PROBES: paths.probes},
        });
        const status =
          outcome.status === 'pass' ? 'upheld' : outcome.status === 'fail' ? 'false' : 'dismissed';
        results.push({
          id: item.id,
          against: target,
          text: item.text,
          status,
          commit: head,
          detail: clip(scrubPath(outcome.detail, dir), 500),
        });
      }
    });
  }

  const record: AccusationVerdict = {accuser, round: arena.round, at: nowIso(), results};
  if (options.dryRun) {
    writeJson(paths.accusationsDryRun, record);
    return {results, died: false, dryRun: true};
  }
  writeJson(paths.accusationsVerdict, record);
  const upheld = results.filter(item => item.status === 'upheld');
  const perjury = results.filter(item => item.status === 'false');
  appendLedger(root, store, 'accusations', {
    accuser,
    round: arena.round,
    hash: fileHash(paths.accusationsVerdict) ?? '',
    upheld: upheld.length,
    false: perjury.length,
  });
  for (const item of results) {
    const data = {
      persona: team.persona,
      target: arena.teams[item.against]?.persona ?? item.against,
      text: item.text,
    };
    if (item.status === 'upheld') addEvent(arena, 'upheld', accuser, data);
    if (item.status === 'false') addEvent(arena, 'perjury', accuser, data);
  }
  if (perjury.length) {
    killTeam(
      project,
      arena,
      accuser,
      'false-accusation',
      perjury.map(item => ({
        label: `${item.id} against ${item.against}: "${item.text}"`,
        detail: item.detail,
      })),
    );
  }
  saveArena(root, arena);
  return {results, died: perjury.length > 0, dryRun: false};
}
