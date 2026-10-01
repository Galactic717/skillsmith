/**
 * Synchronous git wrapper. Arguments are always an array (no shell), every
 * call has a timeout and an output cap, and repository hooks, fsmonitor and
 * replace refs are switched off so code under test cannot run inside the
 * engine's own git calls.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {SkillsmithError} from './errors.js';
import {emptyHooksDir} from './paths.js';

const GIT_TIMEOUT_MS = 120_000;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/** Result of one git call. */
export interface GitResult {
  ok: boolean;
  out: string;
  err: string;
}

function hardenedEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1',
    GIT_LFS_SKIP_SMUDGE: '1',
  };
}

function hardenedArgs(args: readonly string[]): string[] {
  return ['-c', `core.hooksPath=${emptyHooksDir()}`, '-c', 'core.fsmonitor=false', ...args];
}

/** Runs git. Throws on a non-zero exit unless allowFail is set. */
export function git(args: readonly string[], cwd: string, allowFail = false): GitResult {
  const result = spawnSync('git', hardenedArgs(args), {
    cwd,
    encoding: 'utf8',
    env: hardenedEnv(),
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
    windowsHide: true,
  });
  if (result.error) {
    throw new SkillsmithError(`git could not run: ${result.error.message}`, {
      hint: 'Install git from https://git-scm.com and try again.',
    });
  }
  const out = (result.stdout ?? '').trimEnd();
  const err = (result.stderr ?? '').trim();
  const ok = result.status === 0;
  if (!ok && !allowFail) throw new SkillsmithError(`git ${args.join(' ')} failed: ${err || out}`);
  return {ok, out, err};
}

/** True when a git executable is on the PATH. */
export function hasGit(): boolean {
  return !spawnSync('git', ['--version'], {windowsHide: true}).error;
}

/** True when `dir` is inside a git work tree. */
export function isRepo(dir: string): boolean {
  return git(['rev-parse', '--is-inside-work-tree'], dir, true).out === 'true';
}

/** Full commit id for a ref. */
export function revParse(dir: string, ref: string): string {
  return git(['rev-parse', '--verify', `${ref}^{commit}`], dir).out;
}

/** Name of the checked-out branch, or "HEAD" when detached. */
export function currentBranch(dir: string): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], dir, true).out;
}

/** True when a local branch exists. */
export function branchExists(dir: string, branch: string): boolean {
  return git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], dir, true).ok;
}

/** Paths reported by `git status --porcelain`, without the status columns. */
export function dirtyPaths(dir: string): string[] {
  const out = git(['status', '--porcelain', '--untracked-files=all'], dir).out;
  if (!out) return [];
  return out.split('\n').map(line => line.slice(3).replace(/^"|"$/g, ''));
}

/** Files that differ between two commits. */
export function changedFiles(dir: string, from: string, to: string): string[] {
  const out = git(['diff', '--name-only', '--no-renames', from, to], dir).out;
  return out ? out.split('\n') : [];
}

/** Number of commits reachable from `to` but not from `from`. */
export function commitCount(dir: string, from: string, to: string): number {
  return Number(git(['rev-list', '--count', `${from}..${to}`], dir).out || 0);
}

/** Lines added and removed between two commits. */
export function diffSize(dir: string, from: string, to: string): {added: number; removed: number} {
  const out = git(['diff', '--numstat', from, to], dir).out;
  let added = 0;
  let removed = 0;
  for (const line of out ? out.split('\n') : []) {
    const [plus, minus] = line.split('\t');
    added += Number(plus) || 0;
    removed += Number(minus) || 0;
  }
  return {added, removed};
}

/**
 * Sets a local git identity when none is configured, so the engine's own
 * commits work for founders who never set up git.
 */
export function ensureIdentity(dir: string): string[] {
  const added: string[] = [];
  if (!git(['config', 'user.email'], dir, true).out) {
    git(['config', 'user.email', 'skillsmith@localhost'], dir);
    added.push('user.email');
  }
  if (!git(['config', 'user.name'], dir, true).out) {
    git(['config', 'user.name', 'Skillsmith'], dir);
    added.push('user.name');
  }
  return added;
}

/** Commits staged changes to the given paths if there are any. */
export function commitPaths(dir: string, paths: readonly string[], message: string): boolean {
  git(['add', '--', ...paths], dir);
  if (git(['diff', '--cached', '--quiet'], dir, true).ok) return false;
  git(['commit', '--no-verify', '-m', message, '--', ...paths], dir);
  return true;
}

/** Adds a worktree on a new branch, or detached at `base`. */
export function addWorktree(
  root: string,
  worktreePath: string,
  options: {base: string; branch?: string},
): void {
  const args = options.branch
    ? ['worktree', 'add', '-b', options.branch, worktreePath, options.base]
    : ['worktree', 'add', '--detach', worktreePath, options.base];
  git(args, root);
}

/** Removes a worktree and its folder, tolerating partial state. */
export function removeWorktree(root: string, worktreePath: string): void {
  git(['worktree', 'remove', '--force', worktreePath], root, true);
  if (fs.existsSync(worktreePath)) fs.rmSync(worktreePath, {recursive: true, force: true});
  git(['worktree', 'prune'], root, true);
}
