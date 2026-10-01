/**
 * Child processes with hard limits: a timeout that kills the whole process
 * group, and an output cap that keeps the head and the tail.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
/** Largest amount of output kept from one command. */
export const MAX_OUTPUT_CHARS = 256 * 1024;
let cachedShell;
/**
 * On Windows, run commands in Git Bash (Claude Code requires it there) so
 * "$VAR" and POSIX quoting mean the same thing on every machine.
 */
export function commandShell(env = process.env) {
    if (cachedShell !== undefined)
        return cachedShell;
    cachedShell = true;
    if (process.platform === 'win32') {
        const candidates = [
            env['CLAUDE_CODE_GIT_BASH_PATH'],
            'C:\\Program Files\\Git\\bin\\bash.exe',
            'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        ];
        const found = candidates.find(candidate => candidate && fs.existsSync(candidate));
        if (found)
            cachedShell = found;
    }
    return cachedShell;
}
/** Collects output, keeping the first and last halves when it grows too big. */
class OutputBuffer {
    head = '';
    tail = '';
    dropped = 0;
    push(chunk) {
        const half = MAX_OUTPUT_CHARS / 2;
        if (this.head.length < half) {
            const room = half - this.head.length;
            this.head += chunk.slice(0, room);
            chunk = chunk.slice(room);
        }
        if (chunk.length === 0)
            return;
        this.tail += chunk;
        if (this.tail.length > half) {
            this.dropped += this.tail.length - half;
            this.tail = this.tail.slice(-half);
        }
    }
    toString() {
        if (this.dropped === 0)
            return this.head + this.tail;
        return `${this.head}\n[… ${this.dropped} characters dropped …]\n${this.tail}`;
    }
}
/** Kills a child and everything it started. Safe to call twice. */
export function killTree(child) {
    if (!child || child.pid === undefined || child.exitCode !== null || child.signalCode !== null)
        return;
    try {
        if (process.platform === 'win32') {
            spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        }
        else {
            process.kill(-child.pid, 'SIGKILL');
        }
    }
    catch {
        try {
            child.kill('SIGKILL');
        }
        catch {
            // Already gone.
        }
    }
}
/** Runs a shell command line and waits for it, never longer than timeoutMs. */
export function runShell(command, options) {
    const started = Date.now();
    return new Promise(resolve => {
        const output = new OutputBuffer();
        let timedOut = false;
        let settled = false;
        let child;
        try {
            child = spawn(command, {
                cwd: options.cwd,
                shell: commandShell(options.env),
                detached: process.platform !== 'win32',
                stdio: ['ignore', 'pipe', 'pipe'],
                env: options.env ?? process.env,
                windowsHide: true,
            });
        }
        catch (error) {
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
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            killTree(child);
            resolve({ ...result, timedOut, output: output.toString(), ms: Date.now() - started });
        };
        const timer = setTimeout(() => {
            timedOut = true;
            killTree(child);
        }, options.timeoutMs);
        child.stdout?.setEncoding('utf8').on('data', (chunk) => output.push(chunk));
        child.stderr?.setEncoding('utf8').on('data', (chunk) => output.push(chunk));
        child.on('error', error => finish({ exitCode: undefined, signal: undefined, startError: error.message }));
        child.on('close', (code, signal) => finish({ exitCode: code ?? undefined, signal: signal ?? undefined, startError: undefined }));
    });
}
/** Starts a shell command in the background, in its own process group. */
export function startBackground(command, cwd, env) {
    const child = spawn(command, {
        cwd,
        shell: commandShell(env),
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        windowsHide: true,
    });
    let log = '';
    const keep = (chunk) => {
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
/** Asks the operating system for a free TCP port on the loopback interface. */
export function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}
/** Runs `items` through `worker` with at most `limit` running at once. */
export async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await worker(items[index], index);
        }
    });
    await Promise.all(lanes);
    return results;
}
