// Thin, synchronous git wrapper. Every call passes arguments as an array,
// so paths with spaces never reach a shell.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { UserError } from './util.mjs';

export function git(args, { cwd, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.error) throw new UserError(`git is not available: ${r.error.message}`, { hint: 'Install git from https://git-scm.com and try again.' });
  if (r.status !== 0 && !allowFail) {
    throw new UserError(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim()}`);
  }
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

export const hasGit = () => !spawnSync('git', ['--version']).error;

export const isRepo = (dir) => git(['rev-parse', '--is-inside-work-tree'], { cwd: dir, allowFail: true }).out === 'true';

export const hasCommits = (dir) => git(['rev-parse', '--verify', 'HEAD'], { cwd: dir, allowFail: true }).ok;

export const revParse = (dir, ref) => git(['rev-parse', '--verify', `${ref}^{commit}`], { cwd: dir }).out;

export const currentBranch = (dir) => git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, allowFail: true }).out;

export const branchExists = (dir, branch) => git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: dir, allowFail: true }).ok;

export function statusLines(dir) {
  const out = git(['status', '--porcelain', '--untracked-files=all'], { cwd: dir }).out;
  return out ? out.split('\n') : [];
}

export function changedFiles(dir, from, to) {
  const out = git(['diff', '--name-only', '--no-renames', from, to], { cwd: dir }).out;
  return out ? out.split('\n') : [];
}

export function commitCount(dir, from, to) {
  return Number(git(['rev-list', '--count', `${from}..${to}`], { cwd: dir }).out || 0);
}

// Commits by the conveyor itself still work on machines where the user never
// configured git, which is common for first-time builders.
export function ensureIdentity(dir) {
  const email = git(['config', 'user.email'], { cwd: dir, allowFail: true }).out;
  const name = git(['config', 'user.name'], { cwd: dir, allowFail: true }).out;
  const added = [];
  if (!email) {
    git(['config', 'user.email', 'skillsmith@localhost'], { cwd: dir });
    added.push('user.email');
  }
  if (!name) {
    git(['config', 'user.name', 'Skillsmith'], { cwd: dir });
    added.push('user.name');
  }
  return added;
}

export function addWorktree(root, worktreePath, { branch, base, detach = false }) {
  const args = detach ? ['worktree', 'add', '--detach', worktreePath, base] : ['worktree', 'add', '-b', branch, worktreePath, base];
  git(args, { cwd: root });
}

export function removeWorktree(root, worktreePath) {
  git(['worktree', 'remove', '--force', worktreePath], { cwd: root, allowFail: true });
  if (fs.existsSync(worktreePath)) fs.rmSync(worktreePath, { recursive: true, force: true });
  git(['worktree', 'prune'], { cwd: root, allowFail: true });
}
