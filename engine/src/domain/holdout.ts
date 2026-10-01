/**
 * Holdout checks: a second set of acceptance checks the builders never see.
 * The founder (or the screenwriter, before the arena) writes
 * `.skillsmith/holdout.json`; `holdout seal` moves it into the private store
 * and records its hash. Official verification runs it; prechecks never do.
 *
 * Builders who game the visible checks score well on acceptance and badly
 * on the holdout, and the scoreboard shows the gap.
 */
import fs from 'node:fs';
import path from 'node:path';
import {IntegrityError, SkillsmithError} from '../core/errors.js';
import {readJson, writeJson} from '../core/fs.js';
import {git, isRepo} from '../core/git.js';
import {appendLedger, fileHash, latestEntry} from '../core/ledger.js';
import {recordPath} from '../core/paths.js';
import {parseHoldout, type HoldoutFile} from './acceptance.js';
import type {Project} from './project.js';

/** Draft location inside the project (git-ignored). */
export const HOLDOUT_DRAFT = 'holdout.json';

const SEALED_FILE = 'holdout.json';

/** What `holdout status` reports. */
export interface HoldoutStatus {
  sealed: boolean;
  count: number;
  hash?: string;
  sealedAt?: string;
}

function sealedPath(project: Project): string {
  return path.join(project.store, SEALED_FILE);
}

/** True when the draft was ever committed, so builders could read it in history. */
function inGitHistory(root: string, relative: string): boolean {
  if (!isRepo(root)) return false;
  return git(['log', '--all', '--format=%H', '-1', '--', relative], root, true).out.length > 0;
}

/** Validates the draft, moves it to the private store and records its hash. */
export function sealHoldout(
  project: Project,
  draftPath = recordPath(project.root, HOLDOUT_DRAFT),
): HoldoutStatus {
  const {file, errors} = parseHoldout(readJson(draftPath));
  if (!file) throw new SkillsmithError(`holdout file is invalid:\n- ${errors.join('\n- ')}`);
  const relative = path.relative(project.root, draftPath).split(path.sep).join('/');
  if (!relative.startsWith('..') && inGitHistory(project.root, relative)) {
    throw new SkillsmithError(`${relative} is in git history, so builders can read it there.`, {
      hint: 'Write a new holdout set with different checks; never commit it.',
    });
  }
  const target = sealedPath(project);
  writeJson(target, file, 0o600);
  fs.chmodSync(target, 0o600);
  fs.rmSync(draftPath, {force: true});
  const hash = fileHash(target) ?? '';
  const entry = appendLedger(project.root, project.store, 'holdout-seal', {
    hash,
    count: file.checks.length,
  });
  return {sealed: true, count: file.checks.length, hash, sealedAt: entry.at};
}

/** Reports whether a holdout set is sealed for this project. */
export function holdoutStatus(project: Project): HoldoutStatus {
  const entry = latestEntry(project.root, 'holdout-seal');
  const hash = fileHash(sealedPath(project));
  if (!entry || !hash) return {sealed: false, count: 0};
  return {sealed: true, count: Number(entry.data['count'] ?? 0), hash, sealedAt: entry.at};
}

/**
 * Loads the sealed set. Throws when the file no longer matches the hash the
 * arena recorded, because then the hidden checks changed mid-arena.
 */
export function loadSealedHoldout(project: Project, expectedHash: string): HoldoutFile {
  const file = sealedPath(project);
  if (fileHash(file) !== expectedHash) {
    throw new IntegrityError(
      'The sealed holdout checks changed after the arena opened.',
      'Holdout checks must stay fixed for the whole arena. Restore them or open a new arena.',
    );
  }
  const parsed = parseHoldout(readJson(file));
  if (!parsed.file)
    throw new IntegrityError(`Sealed holdout file is invalid: ${parsed.errors.join('; ')}`);
  return parsed.file;
}

/** Where holdout result details are kept, away from the builders. */
export function holdoutReportPath(project: Project, team: string, round: number): string {
  return path.join(project.store, 'holdout-results', `${team}-round-${round}.json`);
}
