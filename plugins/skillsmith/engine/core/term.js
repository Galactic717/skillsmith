/**
 * Terminal output behind a small interface, so the CLI can run in-process in
 * tests and still write to the real terminal in production.
 */
function paint(enabled, open, close) {
    return text => (enabled ? `\u001b[${open}m${text}\u001b[${close}m` : text);
}
/** Builds a palette that styles text only when `enabled` is true. */
export function palette(enabled) {
    return {
        bold: paint(enabled, 1, 22),
        dim: paint(enabled, 2, 22),
        red: paint(enabled, 31, 39),
        green: paint(enabled, 32, 39),
        yellow: paint(enabled, 33, 39),
    };
}
/** Io bound to the process streams. Colors only on a TTY without NO_COLOR. */
export function processIo(env = process.env) {
    return {
        out: (line = '') => process.stdout.write(`${line}\n`),
        err: line => process.stderr.write(`${line}\n`),
        color: Boolean(process.stdout.isTTY) && !env['NO_COLOR'],
    };
}
/** Io that records lines in memory; used by tests and by hooks. */
export class BufferIo {
    color = false;
    stdout = [];
    stderr = [];
    out(line = '') {
        this.stdout.push(line);
    }
    err(line) {
        this.stderr.push(line);
    }
    /** Everything written to stdout, joined with newlines. */
    text() {
        return this.stdout.join('\n');
    }
}
