/**
 * Child processes with hard limits: a timeout that kills the whole process
 * group, and an output cap that keeps the head and the tail.
 */
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import fs from 'node:fs';

/** Largest amount of output kept from one command. */
export const MAX_OUTPUT_CHARS = 256 * 1024;

/** Result of a finished (or killed) command. */
export interface CommandResult {
  /** Exit code, or undefined when the process was killed or never started. */
  exitCode: number | undefined;
  signal: string | undefined;
  timedOut: boolean;
  /** Set when the process could not be started at all. */
  startError: string | undefined;
  /** Interleaved stdout and stderr, capped at MAX_OUTPUT_CHARS. */
  output: string;
  ms: number;
}

/** Options for runShell. */
export interface ShellOptions {
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

let cachedShell: string | true | undefined;

/**
 * On Windows, run commands in Git Bash (Claude Code requires it there) so
 * "$VAR" and POSIX quoting mean the same thing on every machine.
 */
export function commandShell(env: NodeJS.ProcessEnv = process.env): string | true {
  if (cachedShell !== undefined) return cachedShell;
  cachedShell = true;
  if (process.platform === 'win32') {
    const candidates = [
      env['CLAUDE_CODE_GIT_BASH_PATH'],
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ];
    const found = candidates.find(candidate => candidate && fs.existsSync(candidate));
    if (found) cachedShell = found;
  }
  return cachedShell;
}

/** Collects output, keeping the first and last halves when it grows too big. */
class OutputBuffer {
  private head = '';
  private tail = '';
  private dropped = 0;

  push(chunk: string): void {
    const half = MAX_OUTPUT_CHARS / 2;
    if (this.head.length < half) {
      const room = half - this.head.length;
      this.head += chunk.slice(0, room);
      chunk = chunk.slice(room);
    }
    if (chunk.length === 0) return;
    this.tail += chunk;
    if (this.tail.length > half) {
      this.dropped += this.tail.length - half;
      this.tail = this.tail.slice(-half);
    }
  }

  toString(): string {
    if (this.dropped === 0) return this.head + this.tail;
    return `${this.head}\n[… ${this.dropped} characters dropped …]\n${this.tail}`;
  }
}

/** Kills a child and everything it started. Safe to call twice. */
export function killTree(child: ChildProcess | undefined): void {
  if (!child || child.pid === undefined || child.exitCode !== null || child.signalCode !== null)
    return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

/** Runs a shell command line and waits for it, never longer than timeoutMs. */
export function runShell(command: string, options: ShellOptions): Promise<CommandResult> {
  const started = Date.now();
  return new Promise(resolve => {
    const output = new OutputBuffer();
    let timedOut = false;
    let settled = false;
    let child: ChildProcess;
    try {
      child = spawn(command, {
        cwd: options.cwd,
        shell: commandShell(options.env),
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: options.env ?? process.env,
        windowsHide: true,
      });
    } catch (error: unknown) {
      resolve({
        exitCode: undefined,
        signal: undefined,
        timedOut: false,
        startError: error instanceof Error ? error.message : String(error),
        output: '',
        ms: Date.now() - started,
      });
      return;
    }
    const finish = (result: Omit<CommandResult, 'ms' | 'output' | 'timedOut'>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killTree(child);
      resolve({...result, timedOut, output: output.toString(), ms: Date.now() - started});
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, options.timeoutMs);
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => output.push(chunk));
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => output.push(chunk));
    child.on('error', error =>
      finish({exitCode: undefined, signal: undefined, startError: error.message}),
    );
    child.on('close', (code, signal) =>
      finish({exitCode: code ?? undefined, signal: signal ?? undefined, startError: undefined}),
    );
  });
}

/** Handle for a long-running background process such as a dev server. */
export interface Background {
  child: ChildProcess;
  /** Last few kilobytes of output, for error messages. */
  log(): string;
  /** True once the process has exited. */
  exited(): boolean;
  exitCode(): number | null;
  stop(): void;
}

/** Starts a shell command in the background, in its own process group. */
export function startBackground(command: string, cwd: string, env: NodeJS.ProcessEnv): Background {
  const child = spawn(command, {
    cwd,
    shell: commandShell(env),
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    windowsHide: true,
  });
  let log = '';
  const keep = (chunk: Buffer): void => {
    log = (log + chunk.toString('utf8')).slice(-4000);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.on('error', error => keep(Buffer.from(`\n${error.message}`)));
  return {
    child,
    log: () => log,
    exited: () => child.exitCode !== null || child.signalCode !== null,
    exitCode: () => child.exitCode,
    stop: () => killTree(child),
  };
}

/** Runs `items` through `worker` with at most `limit` running at once. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({length: Math.max(1, Math.min(limit, items.length))}, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(lanes);
  return results;
}
