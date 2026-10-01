/** Opening the arena: one git worktree and branch per team, from one base commit. */
import fs from 'node:fs';
import path from 'node:path';
import {SkillsmithError, UsageError} from '../../core/errors.js';
import {readJson, readText, toPosix, writeFileAtomic} from '../../core/fs.js';
import * as G from '../../core/git.js';
import {matchAny} from '../../core/glob.js';
import {appendLedger} from '../../core/ledger.js';
import {RECORDS_DIR, recordPath} from '../../core/paths.js';
import {nowIso} from '../../core/text.js';
import {parseAcceptance, type AcceptanceFile} from '../acceptance.js';
import {holdoutStatus} from '../holdout.js';
import {saveState, type Project} from '../project.js';
import {vacuityFindings} from '../vacuity.js';
import {ensureGraveyard, loadGraveyard} from './graveyard.js';
import {
  addEvent,
  arenaFile,
  loadArena,
  PERSONAS,
  saveArena,
  TEAM_NAMES,
  teamPaths,
  type Arena,
  type TeamPaths,
} from './model.js';

/** Lines Skillsmith keeps in the project's .gitignore. */
export const IGNORED = [`${RECORDS_DIR}/arena/`, `${RECORDS_DIR}/holdout.json`];

/** Adds Skillsmith's ignore lines to .gitignore when they are missing. */
export function ensureIgnored(root: string): void {
  const file = path.join(root, '.gitignore');
  const text = readText(file, {optional: true}) ?? '';
  const present = new Set(text.split(/\r?\n/).map(line => line.trim()));
  const missing = IGNORED.filter(line => !present.has(line));
  if (missing.length === 0) return;
  const prefix = text && !text.endsWith('\n') ? `${text}\n` : text;
  writeFileAtomic(
    file,
    `${prefix}# Skillsmith: team worktrees and the unsealed holdout draft\n${missing.join('\n')}\n`,
  );
}

/** Loads and validates 04-acceptance.json or fails with every problem. */
export function loadAcceptance(root: string): AcceptanceFile {
  const {file, errors} = parseAcceptance(readJson(recordPath(root, '04-acceptance.json')));
  if (!file) throw new SkillsmithError(`04-acceptance.json is invalid:\n- ${errors.join('\n- ')}`);
  return file;
}

/** Globs no team may change: Skillsmith records plus the acceptance tests. */
export function protectedGlobs(acceptance: AcceptanceFile): string[] {
  return [`${RECORDS_DIR}/**`, ...acceptance.protected];
}

/** Options for opening an arena. */
export interface ArenaInitOptions {
  teams?: string[];
  count?: number;
  /** Skip the screenplay and vacuity requirements (tests, demos). */
  force?: boolean;
  templatesDir?: string;
}

/** What opening the arena produced, for printing. */
export interface ArenaInitResult {
  arena: Arena;
  identity: string[];
  strayChanges: string[];
  paths: TeamPaths[];
  warnings: string[];
}

function chooseNames(
  requested: string[] | undefined,
  count: number | undefined,
  dead: string[],
): string[] {
  const names =
    requested ??
    TEAM_NAMES.filter(name => !dead.includes(name)).slice(0, Math.max(1, Math.min(count ?? 3, 5)));
  for (const name of names) {
    if (!/^[a-z][a-z0-9-]{1,20}$/.test(name)) {
      throw new UsageError(`Bad team name "${name}": use lowercase letters, digits and dashes.`);
    }
    if (dead.includes(name)) {
      throw new SkillsmithError(
        `Team name "${name}" is in the graveyard. The dead do not come back; pick another name.`,
      );
    }
  }
  if (new Set(names).size !== names.length) throw new UsageError('Team names must be different.');
  return names;
}

/** Opens a new arena with one worktree per team. */
export function initArena(project: Project, options: ArenaInitOptions = {}): ArenaInitResult {
  const {root, store, state} = project;
  const existing = loadArena(root);
  if (existing?.status === 'running') {
    throw new SkillsmithError('An arena is already running.', {
      hint: 'Finish it with `skillsmith arena crown`, or eliminate the remaining teams.',
    });
  }
  const warnings: string[] = [];
  if (!options.force) {
    if (state.stations.screenplay.status !== 'done') {
      throw new SkillsmithError('The screenplay is not approved yet.', {
        hint: 'Pass the screenplay gate first: `skillsmith advance screenplay`.',
      });
    }
    const vacuity = vacuityFindings(recordPath(root), root);
    if (vacuity.length)
      throw new SkillsmithError(`The acceptance checks are not ready:\n- ${vacuity.join('\n- ')}`);
  }
  const acceptance = loadAcceptance(root);
  const names = chooseNames(options.teams, options.count, loadGraveyard(root).names);

  if (!G.isRepo(root)) G.git(['init'], root);
  const identity = G.ensureIdentity(root);
  ensureIgnored(root);

  const uncommittedTests = G.dirtyPaths(root).filter(
    item => !item.startsWith(`${RECORDS_DIR}/`) && matchAny(item, acceptance.protected),
  );
  if (uncommittedTests.length) {
    throw new SkillsmithError(
      `Acceptance files are not committed, so the teams would not get them:\n${uncommittedTests.join('\n')}`,
      {
        hint: 'Commit them first: git add <files> && git commit -m "Add acceptance tests"',
      },
    );
  }

  if (existing) {
    const history = recordPath(root, 'history');
    fs.mkdirSync(history, {recursive: true});
    fs.renameSync(arenaFile(root), path.join(history, `arena-${Date.now()}.json`));
  }
  const holdout = holdoutStatus(project);
  if (!holdout.sealed) {
    warnings.push(
      'No holdout checks are sealed, so builders can see every check. Seal some with `skillsmith holdout seal` before the next arena.',
    );
  }
  ensureGraveyard(root);
  saveState(root, state);
  G.commitPaths(root, [RECORDS_DIR, '.gitignore'], 'skillsmith: pre-production records');
  const strayChanges = G.dirtyPaths(root).filter(item => !item.startsWith(`${RECORDS_DIR}/`));
  const base = G.revParse(root, 'HEAD');

  const arena: Arena = {
    version: 2,
    status: 'running',
    base,
    round: 1,
    createdAt: nowIso(),
    protected: protectedGlobs(acceptance),
    holdout: holdout.sealed && holdout.hash ? {hash: holdout.hash, count: holdout.count} : null,
    teams: {},
    events: [],
  };
  const orderTemplate = options.templatesDir
    ? readText(path.join(options.templatesDir, 'orders.md'), {optional: true})
    : undefined;
  names.forEach((name, index) => {
    const paths = teamPaths(root, name);
    if (G.branchExists(root, paths.branch)) {
      throw new SkillsmithError(`Branch ${paths.branch} already exists.`, {
        hint: `Rename or delete it: git branch -m ${paths.branch} ${paths.branch}-old`,
      });
    }
    G.addWorktree(root, paths.worktree, {branch: paths.branch, base});
    fs.mkdirSync(paths.probes, {recursive: true});
    const {persona, motto} = PERSONAS[index % PERSONAS.length] ?? PERSONAS[0];
    if (orderTemplate && !fs.existsSync(paths.orders)) {
      writeFileAtomic(
        paths.orders,
        orderTemplate
          .replaceAll('{{team}}', name)
          .replaceAll('{{persona}}', persona)
          .replaceAll('{{motto}}', motto),
      );
    }
    arena.teams[name] = {
      persona,
      motto,
      status: 'alive',
      branch: paths.branch,
      worktree: toPosix(path.relative(root, paths.worktree)),
      dossier: toPosix(path.relative(root, paths.dossier)),
    };
    addEvent(arena, 'enter', name, {persona, motto});
  });
  saveArena(root, arena);
  appendLedger(root, store, 'arena-init', {
    base,
    teams: names,
    protected: arena.protected,
    holdoutHash: arena.holdout?.hash ?? null,
  });
  return {arena, identity, strayChanges, paths: names.map(name => teamPaths(root, name)), warnings};
}
