/** Shared test helpers: temporary projects, in-process CLI runs and git. */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run} from '../src/cli/main.js';
import {BufferIo} from '../src/core/term.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cleanup: string[] = [];
process.setMaxListeners(0);
process.on('exit', () => {
  for (const dir of cleanup) fs.rmSync(dir, {recursive: true, force: true});
});

/** Repository root (tests run from .build/test). */
export const REPO_ROOT = path.resolve(here, '..', '..');

/** The plugin folder with templates and the manifest. */
export const PLUGIN_ROOT = path.join(REPO_ROOT, 'plugins', 'skillsmith');

/** Creates a temporary folder that is removed when the process exits. */
export function tempDir(prefix = 'skillsmith-test-'): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  cleanup.push(dir);
  return dir;
}

/** Writes a file, creating parent folders. */
export function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
}

/** Writes pretty JSON. */
export function writeJsonFile(file: string, value: unknown): void {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Result of an in-process CLI run. */
export interface CliResult {
  code: number;
  out: string;
  err: string;
}

/** A test sandbox: a project folder and a private store folder. */
export interface Sandbox {
  dir: string;
  env: NodeJS.ProcessEnv;
  cli(args: string[], stdin?: string): Promise<CliResult>;
}

/** Creates a sandbox with its own SKILLSMITH_HOME. */
export function sandbox(): Sandbox {
  const dir = tempDir();
  const home = tempDir('skillsmith-home-');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SKILLSMITH_HOME: home,
    SKILLSMITH_OFFLINE: '1',
    NO_COLOR: '1',
  };
  return {
    dir,
    env,
    async cli(args, stdin = '') {
      const io = new BufferIo();
      const code = await run(args, {
        cwd: dir,
        env,
        io,
        pluginRoot: PLUGIN_ROOT,
        readStdin: () => Promise.resolve(stdin),
      });
      return {code, out: io.stdout.join('\n'), err: io.stderr.join('\n')};
    },
  };
}

/** Runs git in a folder and returns stdout; throws on failure. */
export function gitIn(dir: string, ...args: string[]): string {
  const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

/** Stages everything in a folder and commits it. */
export function commitAll(dir: string, message: string): void {
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '-q', '-m', message);
}
