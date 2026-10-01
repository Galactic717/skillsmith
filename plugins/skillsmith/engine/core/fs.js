/**
 * File system helpers with bounded reads, atomic writes and symlink-safe path
 * resolution. Agents write the files the engine reads, so every path coming
 * from an artifact is treated as untrusted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SkillsmithError } from './errors.js';
/** Largest artifact the engine will read into memory (JSON, Markdown). */
export const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;
/** Converts a native path to forward slashes for display and globbing. */
export function toPosix(filePath) {
    return filePath.split(path.sep).join('/');
}
/** True when the path exists (file, directory or link). */
export function pathExists(filePath) {
    try {
        fs.lstatSync(filePath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Reads a UTF-8 text file, refusing files larger than maxBytes.
 * Returns undefined when the file does not exist and `optional` is set.
 */
export function readText(filePath, options = {}) {
    const maxBytes = options.maxBytes ?? MAX_ARTIFACT_BYTES;
    let stat;
    try {
        stat = fs.statSync(filePath);
    }
    catch (error) {
        if (isErrnoException(error) && error.code === 'ENOENT') {
            if (options.optional)
                return undefined;
            throw new SkillsmithError(`File not found: ${filePath}`);
        }
        throw error;
    }
    if (!stat.isFile())
        throw new SkillsmithError(`Not a regular file: ${filePath}`);
    if (stat.size > maxBytes) {
        throw new SkillsmithError(`${filePath} is ${stat.size} bytes; the limit is ${maxBytes}.`);
    }
    return fs.readFileSync(filePath, 'utf8');
}
/** Reads a required UTF-8 text file. */
export function readRequiredText(filePath, maxBytes) {
    const text = readText(filePath, maxBytes === undefined ? {} : { maxBytes });
    if (text === undefined)
        throw new SkillsmithError(`File not found: ${filePath}`);
    return text;
}
/** Parses a JSON file into `unknown`; callers validate the shape. */
export function readJson(filePath, options = {}) {
    const text = readText(filePath, options);
    if (text === undefined)
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new SkillsmithError(`${filePath} is not valid JSON: ${reason}`);
    }
}
/** Writes a file atomically: temporary file in the same directory, then rename. */
export function writeFileAtomic(filePath, data, mode = 0o644) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, data, { mode });
    fs.renameSync(tmp, filePath);
}
/** Writes pretty JSON atomically with a trailing newline. */
export function writeJson(filePath, value, mode) {
    writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`, mode);
}
/**
 * Resolves `relative` inside `base`. Returns undefined for absolute paths,
 * paths that escape `base`, and paths that pass through a symbolic link, so a
 * committed symlink cannot point a check at files outside the project.
 */
export function resolveInside(base, relative) {
    if (relative.length === 0 || relative.includes('\0'))
        return undefined;
    if (path.isAbsolute(relative) || /^[a-zA-Z]:[\\/]/.test(relative))
        return undefined;
    const absolute = path.resolve(base, relative);
    const back = path.relative(base, absolute);
    if (back.startsWith('..') || path.isAbsolute(back))
        return undefined;
    let current = base;
    for (const part of back.split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        let stat;
        try {
            stat = fs.lstatSync(current);
        }
        catch {
            return absolute; // The rest does not exist yet; nothing to follow.
        }
        if (stat.isSymbolicLink())
            return undefined;
    }
    return absolute;
}
const WALK_SKIP = new Set(['.git', 'node_modules']);
/** Lists regular files under `dir` as posix paths, never following links. */
export function walkFiles(dir, base = dir, out = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        if (WALK_SKIP.has(entry.name))
            continue;
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory())
            walkFiles(absolute, base, out);
        else if (entry.isFile())
            out.push(toPosix(path.relative(base, absolute)));
    }
    return out;
}
/** Heuristic binary detection: a NUL byte in the first 8 KB. */
export function isBinary(buffer) {
    const length = Math.min(buffer.length, 8000);
    for (let i = 0; i < length; i += 1) {
        if (buffer[i] === 0)
            return true;
    }
    return false;
}
/** Type guard for Node's errno-style errors. */
export function isErrnoException(error) {
    return error instanceof Error && 'code' in error;
}
/** File modification time in milliseconds, or 0 when missing. */
export function mtimeMs(filePath) {
    try {
        return fs.statSync(filePath).mtimeMs;
    }
    catch {
        return 0;
    }
}
