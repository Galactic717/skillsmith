/**
 * Where things live. Project records sit in `<project>/.skillsmith/`; secrets
 * the builders must not see (the ledger key, sealed holdout checks) sit in a
 * private store outside the project.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {UsageError} from './errors.js';

/** Name of the records folder inside a project. */
export const RECORDS_DIR = '.skillsmith';

/** The file that marks a folder as a Skillsmith project. */
export const STATE_FILE = 'state.json';

/** Path of a file inside the project's records folder. */
export function recordPath(root: string, ...parts: string[]): string {
  return path.join(root, RECORDS_DIR, ...parts);
}

function isProject(dir: string): boolean {
  return fs.existsSync(recordPath(dir, STATE_FILE));
}

/**
 * Walks up from `start` to the folder that holds `.skillsmith/state.json`.
 * Team worktrees carry their own copy of `.skillsmith/`, so a path inside
 * `.skillsmith/arena/<team>/` resolves to the project that owns the arena.
 */
export function findProjectRoot(start: string): string | undefined {
  let dir = path.resolve(start);
  const marker = `${path.sep}${RECORDS_DIR}${path.sep}arena${path.sep}`;
  const index = `${dir}${path.sep}`.indexOf(marker);
  if (index !== -1) dir = dir.slice(0, index);
  for (;;) {
    if (isProject(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Resolves the project root or explains how to create one. */
export function requireProjectRoot(cwd: string, dirFlag?: string): string {
  const root = dirFlag ? path.resolve(cwd, dirFlag) : findProjectRoot(cwd);
  if (!root || !isProject(root)) {
    throw new UsageError(
      'No Skillsmith project here.',
      'Run `skillsmith init` in your project folder first.',
    );
  }
  return root;
}

/** Root of the private store: $SKILLSMITH_HOME or ~/.skillsmith. */
export function storeHome(env: NodeJS.ProcessEnv): string {
  const configured = env['SKILLSMITH_HOME'];
  return configured ? path.resolve(configured) : path.join(os.homedir(), '.skillsmith');
}

/** Path of the private folder for one project, without creating it. */
export function projectStorePath(env: NodeJS.ProcessEnv, projectId: string): string {
  if (!/^[a-f0-9-]{8,64}$/.test(projectId)) throw new UsageError(`Bad project id: ${projectId}`);
  return path.join(storeHome(env), 'projects', projectId);
}

/** Private folder for one project, created with owner-only permissions. */
export function projectStore(env: NodeJS.ProcessEnv, projectId: string): string {
  const dir = projectStorePath(env, projectId);
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  return dir;
}

/** An empty folder used as core.hooksPath so repository hooks never run. */
export function emptyHooksDir(): string {
  const dir = path.join(os.tmpdir(), 'skillsmith-no-hooks');
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}
