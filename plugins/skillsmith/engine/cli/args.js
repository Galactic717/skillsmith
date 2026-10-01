/** Command-line parsing: positionals, `--flag`, `--key value` and `--key=value`. */
import { UsageError } from '../core/errors.js';
/** Flags that never take a value, so a following word stays positional. */
const BOOLEAN_FLAGS = new Set([
    'all',
    'dry-run',
    'force',
    'help',
    'json',
    'no-setup',
    'offline',
    'quiet',
    'setup',
    'strict',
]);
/** Parsed arguments with typed accessors. */
export class ParsedArgs {
    positional;
    flags;
    constructor(positional, flags) {
        this.positional = positional;
        this.flags = flags;
    }
    /** True when a boolean flag was given. */
    flag(name) {
        return this.flags.has(name);
    }
    /** Value of a string flag, or undefined. Fails if it was given without a value. */
    string(name) {
        const value = this.flags.get(name);
        if (value === undefined)
            return undefined;
        if (value === true)
            throw new UsageError(`--${name} needs a value`);
        return value;
    }
    /** Value of a numeric flag, or undefined. */
    number(name) {
        const value = this.string(name);
        if (value === undefined)
            return undefined;
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            throw new UsageError(`--${name} must be a number`);
        return parsed;
    }
    /** Comma-separated list flag. */
    list(name) {
        return this.string(name)
            ?.split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }
}
/** Parses argv (without the node and script paths). */
export function parseArgs(argv) {
    const positional = [];
    const flags = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] ?? '';
        if (arg === '--') {
            positional.push(...argv.slice(index + 1));
            break;
        }
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        const equals = arg.indexOf('=');
        if (equals !== -1) {
            flags.set(arg.slice(2, equals), arg.slice(equals + 1));
            continue;
        }
        const key = arg.slice(2);
        const next = argv[index + 1];
        if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith('--')) {
            flags.set(key, next);
            index += 1;
        }
        else {
            flags.set(key, true);
        }
    }
    return new ParsedArgs(positional, flags);
}
