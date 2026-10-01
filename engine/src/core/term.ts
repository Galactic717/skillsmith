/**
 * Terminal output behind a small interface, so the CLI can run in-process in
 * tests and still write to the real terminal in production.
 */

/** Where the CLI writes. */
export interface Io {
  /** Writes one line to standard output. */
  out(line?: string): void;
  /** Writes one line to standard error. */
  err(line: string): void;
  /** Whether ANSI colors are allowed. */
  readonly color: boolean;
}

/** Text styling functions; identity functions when color is off. */
export interface Palette {
  bold: (text: string) => string;
  dim: (text: string) => string;
  red: (text: string) => string;
  green: (text: string) => string;
  yellow: (text: string) => string;
}

function paint(enabled: boolean, open: number, close: number): (text: string) => string {
  return text => (enabled ? `\u001b[${open}m${text}\u001b[${close}m` : text);
}

/** Builds a palette that styles text only when `enabled` is true. */
export function palette(enabled: boolean): Palette {
  return {
    bold: paint(enabled, 1, 22),
    dim: paint(enabled, 2, 22),
    red: paint(enabled, 31, 39),
    green: paint(enabled, 32, 39),
    yellow: paint(enabled, 33, 39),
  };
}

/** Io bound to the process streams. Colors only on a TTY without NO_COLOR. */
export function processIo(env: NodeJS.ProcessEnv = process.env): Io {
  return {
    out: (line = '') => process.stdout.write(`${line}\n`),
    err: line => process.stderr.write(`${line}\n`),
    color: Boolean(process.stdout.isTTY) && !env['NO_COLOR'],
  };
}

/** Io that records lines in memory; used by tests and by hooks. */
export class BufferIo implements Io {
  readonly color = false;
  readonly stdout: string[] = [];
  readonly stderr: string[] = [];

  out(line = ''): void {
    this.stdout.push(line);
  }

  err(line: string): void {
    this.stderr.push(line);
  }

  /** Everything written to stdout, joined with newlines. */
  text(): string {
    return this.stdout.join('\n');
  }
}
