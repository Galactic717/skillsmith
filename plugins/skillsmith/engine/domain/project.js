/**
 * Project state: which stations are done, and the hashes of the files each
 * approval covered, so later edits to an approved file are visible.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { IntegrityError } from '../core/errors.js';
import { readJson, writeJson } from '../core/fs.js';
import { isRecord } from '../core/json.js';
import { ensureKey, fileHash } from '../core/ledger.js';
import { projectStore, recordPath, RECORDS_DIR, STATE_FILE } from '../core/paths.js';
import { nowIso } from '../core/text.js';
import { STATION_IDS, STATIONS } from './stations.js';
function emptyStations() {
    const stations = {};
    for (const id of STATION_IDS)
        stations[id] = { status: 'pending' };
    return stations;
}
/** A fresh state for a new project. */
export function newState(project) {
    const now = nowIso();
    return {
        version: 2,
        projectId: crypto.randomUUID(),
        project,
        createdAt: now,
        updatedAt: now,
        stations: emptyStations(),
    };
}
function parseStationRecord(value) {
    if (!isRecord(value) || (value['status'] !== 'done' && value['status'] !== 'pending')) {
        return { status: 'pending' };
    }
    const record = { status: value['status'] };
    if (typeof value['doneAt'] === 'string')
        record.doneAt = value['doneAt'];
    if (value['skipped'] === true)
        record.skipped = true;
    if (typeof value['reason'] === 'string')
        record.reason = value['reason'];
    if (isRecord(value['hashes'])) {
        const hashes = {};
        for (const [file, hash] of Object.entries(value['hashes'])) {
            if (typeof hash === 'string')
                hashes[file] = hash;
        }
        record.hashes = hashes;
    }
    return record;
}
/**
 * Parses state.json. Version 1 files (Skillsmith 1.x, "stages") are migrated
 * in memory; the caller saves the result.
 */
export function parseState(value) {
    if (!isRecord(value) || typeof value['project'] !== 'string') {
        throw new IntegrityError('.skillsmith/state.json is not a Skillsmith state file.');
    }
    const migrated = value['version'] !== 2;
    const source = migrated ? value['stages'] : value['stations'];
    const stations = emptyStations();
    if (isRecord(source)) {
        for (const id of STATION_IDS)
            stations[id] = parseStationRecord(source[id]);
    }
    const projectId = typeof value['projectId'] === 'string' && /^[a-f0-9-]{8,64}$/.test(value['projectId'])
        ? value['projectId']
        : crypto.randomUUID();
    return {
        migrated: migrated || projectId !== value['projectId'],
        state: {
            version: 2,
            projectId,
            project: value['project'],
            createdAt: typeof value['createdAt'] === 'string' ? value['createdAt'] : nowIso(),
            updatedAt: typeof value['updatedAt'] === 'string' ? value['updatedAt'] : nowIso(),
            stations,
        },
    };
}
/** Writes state.json, stamping updatedAt. */
export function saveState(root, state) {
    state.updatedAt = nowIso();
    writeJson(recordPath(root, STATE_FILE), state);
}
/** Opens a project folder and its private store, migrating old state. */
export function openProject(root, env) {
    const { state, migrated } = parseState(readJson(recordPath(root, STATE_FILE)));
    if (migrated)
        saveState(root, state);
    const store = projectStore(env, state.projectId);
    ensureKey(store);
    return { root, state, store };
}
/** Creates `.skillsmith/` with a new state; fails if one exists. */
export function createProject(root, name, env) {
    fs.mkdirSync(recordPath(root), { recursive: true });
    const state = newState(name);
    saveState(root, state);
    const store = projectStore(env, state.projectId);
    ensureKey(store);
    return { root, state, store };
}
/** First station that is not done, or undefined when all are. */
export function currentStation(state) {
    return STATIONS.find(item => state.stations[item.id].status !== 'done');
}
/** Hashes of a station's output files that exist right now. */
export function outputHashes(root, item) {
    const hashes = {};
    for (const file of item.outputs) {
        const hash = fileHash(recordPath(root, file));
        if (hash)
            hashes[file] = hash;
    }
    return hashes;
}
/** Approved files that were edited after their station was approved. */
export function driftedOutputs(project) {
    const drifted = [];
    for (const item of STATIONS) {
        const record = project.state.stations[item.id];
        if (record.status !== 'done' || !record.hashes || item.id === 'arena' || item.id === 'ship')
            continue;
        for (const [file, hash] of Object.entries(record.hashes)) {
            if (fileHash(recordPath(project.root, file)) !== hash)
                drifted.push(`${RECORDS_DIR}/${file}`);
        }
    }
    return drifted;
}
