/**
 * The ledger: an append-only, hash-chained log of every official decision
 * (approvals, sealed holdouts, verdicts, deaths, crowns). Each entry carries
 * the SHA-256 of the previous entry and an HMAC made with a key kept in the
 * private store, so an edited or deleted entry is detected.
 *
 * This is tamper-evident, not tamper-proof: someone with access to the key
 * can rewrite history. It stops an agent from quietly editing a record.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { IntegrityError } from './errors.js';
import { readText, writeFileAtomic } from './fs.js';
import { canonicalJson, isRecord } from './json.js';
import { recordPath } from './paths.js';
import { nowIso } from './text.js';
/** File name of the ledger inside `.skillsmith/`. */
export const LEDGER_FILE = 'ledger.jsonl';
/** File name of the HMAC key inside the private store. */
export const KEY_FILE = 'ledger.key';
const GENESIS = '0'.repeat(64);
const MAX_LEDGER_BYTES = 32 * 1024 * 1024;
/** SHA-256 of a string or buffer, hex encoded. */
export function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
/** SHA-256 of a file's bytes, or undefined if the file is missing. */
export function fileHash(filePath) {
    try {
        return sha256(fs.readFileSync(filePath));
    }
    catch {
        return undefined;
    }
}
/** Creates the ledger key in the store if it does not exist yet. */
export function ensureKey(store) {
    const keyPath = path.join(store, KEY_FILE);
    if (fs.existsSync(keyPath))
        return;
    fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
}
function readKey(store) {
    try {
        return fs.readFileSync(path.join(store, KEY_FILE), 'utf8').trim();
    }
    catch {
        return undefined;
    }
}
function entryHash(prev, body) {
    return sha256(`${prev}\n${canonicalJson(body)}`);
}
function mac(key, hash) {
    return crypto.createHmac('sha256', key).update(hash).digest('hex');
}
function parseEntry(line, lineNo) {
    let value;
    try {
        value = JSON.parse(line);
    }
    catch {
        throw new IntegrityError(`ledger line ${lineNo} is not valid JSON`);
    }
    if (!isRecord(value) ||
        typeof value['seq'] !== 'number' ||
        typeof value['at'] !== 'string' ||
        typeof value['type'] !== 'string' ||
        !isRecord(value['data']) ||
        typeof value['prev'] !== 'string' ||
        typeof value['hash'] !== 'string' ||
        typeof value['mac'] !== 'string') {
        throw new IntegrityError(`ledger line ${lineNo} does not have the ledger entry shape`);
    }
    return {
        seq: value['seq'],
        at: value['at'],
        type: value['type'],
        data: value['data'],
        prev: value['prev'],
        hash: value['hash'],
        mac: value['mac'],
    };
}
/** Reads every ledger entry without checking hashes. */
export function readLedger(root) {
    const text = readText(recordPath(root, LEDGER_FILE), {
        optional: true,
        maxBytes: MAX_LEDGER_BYTES,
    });
    if (!text)
        return [];
    return text
        .split('\n')
        .map((line, index) => ({ line: line.trim(), lineNo: index + 1 }))
        .filter(item => item.line.length > 0)
        .map(item => parseEntry(item.line, item.lineNo));
}
/** Appends an entry and returns it. The store must hold the ledger key. */
export function appendLedger(root, store, type, data) {
    const key = readKey(store);
    if (!key) {
        throw new IntegrityError(`The ledger key is missing from ${store}.`, 'Records can only be signed on the machine that created the project.');
    }
    const entries = readLedger(root);
    const last = entries.at(-1);
    const body = { seq: (last?.seq ?? 0) + 1, at: nowIso(), type, data };
    const prev = last?.hash ?? GENESIS;
    const hash = entryHash(prev, body);
    const entry = { ...body, prev, hash, mac: mac(key, hash) };
    const file = recordPath(root, LEDGER_FILE);
    const existing = readText(file, { optional: true, maxBytes: MAX_LEDGER_BYTES }) ?? '';
    writeFileAtomic(file, `${existing}${JSON.stringify(entry)}\n`);
    return entry;
}
/** Recomputes the chain and, when the key is present, every HMAC. */
export function verifyLedger(root, store) {
    const problems = [];
    let entries;
    try {
        entries = readLedger(root);
    }
    catch (error) {
        return { ok: false, entries: 0, macChecked: false, problems: [String(error.message)] };
    }
    const key = readKey(store);
    let prev = GENESIS;
    entries.forEach((entry, index) => {
        const where = `entry ${index + 1} (${entry.type})`;
        if (entry.seq !== index + 1)
            problems.push(`${where}: sequence number ${entry.seq}, expected ${index + 1}`);
        if (entry.prev !== prev)
            problems.push(`${where}: does not point at the previous entry`);
        const expected = entryHash(entry.prev, {
            seq: entry.seq,
            at: entry.at,
            type: entry.type,
            data: entry.data,
        });
        if (expected !== entry.hash)
            problems.push(`${where}: content was changed after it was written`);
        if (key && mac(key, entry.hash) !== entry.mac)
            problems.push(`${where}: signature does not match`);
        prev = entry.hash;
    });
    return { ok: problems.length === 0, entries: entries.length, macChecked: Boolean(key), problems };
}
/** Latest entry of a type that matches a predicate. */
export function latestEntry(root, type, matches = () => true) {
    return readLedger(root)
        .filter(entry => entry.type === type && matches(entry.data))
        .at(-1);
}
/**
 * Throws IntegrityError when a record file no longer has the hash the ledger
 * stored for it.
 */
export function assertRecordUnchanged(filePath, expectedHash, label) {
    const actual = fileHash(filePath);
    if (typeof expectedHash !== 'string' || actual !== expectedHash) {
        throw new IntegrityError(`${label} was changed after Skillsmith wrote it.`, 'Official records are written only by the engine. Run `skillsmith ledger verify` and re-run the step that writes it.');
    }
}
