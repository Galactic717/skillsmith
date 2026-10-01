/**
 * Clean rooms: a fresh, detached git worktree of one exact commit, outside
 * the project, where checks run. Uncommitted files never reach a verdict.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {addWorktree, removeWorktree} from '../../core/git.js';
import {clip} from '../../core/text.js';
import {runCheck} from '../checks.js';
import type {SetupRow} from './model.js';

const SETUP_TIMEOUT_S = 900;

/** Replaces the temporary clean-room path in output with "./". */
export function scrubPath(text: string, dir: string): string {
  return text.split(`${dir}${path.sep}`).join('./').split(dir).join('.');
}

/** Creates a clean room for `commit`, runs `work`, and always removes it. */
export async function withCleanroom<T>(
  root: string,
  store: string,
  label: string,
  commit: string,
  work: (dir: string) => Promise<T>,
): Promise<T> {
  const parent = path.join(store, 'cleanrooms');
  fs.mkdirSync(parent, {recursive: true, mode: 0o700});
  const safeLabel = label.replace(/[^a-z0-9-]/gi, '-').slice(0, 40);
  const dir = path.join(parent, `${safeLabel}-${crypto.randomBytes(4).toString('hex')}`);
  addWorktree(root, dir, {base: commit});
  try {
    return await work(dir);
  } finally {
    removeWorktree(root, dir);
  }
}

/** Runs setup commands in order and stops at the first that does not pass. */
export async function runSetup(commands: readonly string[], dir: string): Promise<SetupRow[]> {
  const rows: SetupRow[] = [];
  for (const run of commands) {
    const result = await runCheck({type: 'command', run, timeout: SETUP_TIMEOUT_S}, {dir});
    rows.push({run, status: result.status, detail: clip(scrubPath(result.detail, dir), 400)});
    if (result.status !== 'pass') break;
  }
  return rows;
}
