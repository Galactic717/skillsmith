/** Commands that move a project along the line: init, status, gate, advance ... */
import fs from 'node:fs';
import path from 'node:path';
import { EXIT, UsageError } from '../core/errors.js';
import { readRequiredText } from '../core/fs.js';
import * as G from '../core/git.js';
import { appendLedger, verifyLedger } from '../core/ledger.js';
import { findProjectRoot, recordPath, STATE_FILE } from '../core/paths.js';
import { nowIso } from '../core/text.js';
import { ensureIgnored } from '../domain/arena/init.js';
import { loadArena } from '../domain/arena/model.js';
import { coverageMap, COVERAGE_AREAS, forgeVerdict, requirements, successCriteria, } from '../domain/brief.js';
import { runGate } from '../domain/gates.js';
import { createProject, currentStation, driftedOutputs, outputHashes, saveState, } from '../domain/project.js';
import { isStationId, STATION_IDS, STATIONS, station } from '../domain/stations.js';
import { colors, needPositional, project, templatesDir } from './context.js';
function printStatus(ctx, opened) {
    const c = colors(ctx);
    const { state, root } = opened;
    const now = currentStation(state);
    ctx.io.out(`${c.bold(state.project)}  ${c.dim(root)}`);
    STATIONS.forEach((item, index) => {
        const record = state.stations[item.id];
        const icon = record.status === 'done' ? c.green('✔') : now?.id === item.id ? c.yellow('▶') : c.dim('·');
        const note = record.skipped ? c.dim(` skipped: ${record.reason ?? ''}`) : '';
        ctx.io.out(`  ${icon} ${index + 1}. ${item.title.padEnd(11)} ${c.dim(item.crew)}${note}`);
    });
    const arena = loadArena(root);
    if (arena) {
        ctx.io.out(`\n  Arena: ${arena.status}, round ${arena.round}`);
        for (const [name, team] of Object.entries(arena.teams)) {
            ctx.io.out(`    ${name.padEnd(8)} ${team.persona.padEnd(9)} ${team.status}`);
        }
    }
    const drift = driftedOutputs(opened);
    if (drift.length)
        ctx.io.out(c.yellow(`\n  Edited after approval: ${drift.join(', ')}. Run that station's gate again.`));
    ctx.io.out(now
        ? `\nNext: ${c.bold(`/${now.skill}`)} (${now.title.toLowerCase()} station)`
        : `\n${c.green('All stations are done.')}`);
}
/** Prints a gate result. */
export function printGate(ctx, result) {
    const c = colors(ctx);
    if (result.ok)
        ctx.io.out(`${c.green('✔')} ${result.station} gate passed`);
    else {
        ctx.io.out(`${c.red('✘')} ${result.station} gate failed:`);
        for (const error of result.errors)
            ctx.io.out(`  - ${c.red(error)}`);
    }
    if (result.warnings.length) {
        ctx.io.out(c.yellow('  warnings:'));
        for (const warning of result.warnings)
            ctx.io.out(`  - ${c.yellow(warning)}`);
    }
}
/** `init`: starts a project in the current folder. */
export function initCommand(ctx, args) {
    const c = colors(ctx);
    const dir = path.resolve(ctx.cwd, args.string('dir') ?? '.');
    if (fs.existsSync(recordPath(dir, STATE_FILE))) {
        ctx.io.out(c.yellow('This folder is already a Skillsmith project.'));
        printStatus(ctx, project(ctx, args));
        return EXIT.ok;
    }
    fs.mkdirSync(dir, { recursive: true });
    const name = args.string('name') ?? path.basename(dir);
    const created = createProject(dir, name, ctx.env);
    const notes = [];
    if (G.hasGit()) {
        if (!G.isRepo(dir)) {
            G.git(['init'], dir);
            notes.push('created a git repository (git keeps every version of your project)');
        }
        const added = G.ensureIdentity(dir);
        if (added.length)
            notes.push(`set a local git name for this project (${added.join(', ')})`);
    }
    else {
        notes.push(c.yellow('git is not installed; the arena needs it. Get it at https://git-scm.com'));
    }
    ensureIgnored(dir);
    appendLedger(dir, created.store, 'init', { project: name });
    ctx.io.out(`${c.green('✔')} Skillsmith project "${name}" created in ${dir}`);
    for (const note of notes)
        ctx.io.out(`  - ${note}`);
    ctx.io.out(`Next: the interview. Run ${c.bold('/skillsmith:start')}`);
    return EXIT.ok;
}
/** `status`: where the project is and what comes next. */
export function statusCommand(ctx, args) {
    const opened = project(ctx, args);
    if (args.flag('json')) {
        const arena = loadArena(opened.root);
        const ledger = verifyLedger(opened.root, opened.store);
        ctx.io.out(JSON.stringify({
            root: opened.root,
            project: opened.state.project,
            current: currentStation(opened.state)?.id ?? null,
            stations: opened.state.stations,
            drift: driftedOutputs(opened),
            ledger: { ok: ledger.ok, entries: ledger.entries },
            arena: arena
                ? {
                    status: arena.status,
                    round: arena.round,
                    winner: arena.winner ?? null,
                    teams: Object.fromEntries(Object.entries(arena.teams).map(([name, team]) => [
                        name,
                        { persona: team.persona, status: team.status },
                    ])),
                }
                : null,
        }, null, 2));
        return EXIT.ok;
    }
    printStatus(ctx, opened);
    return EXIT.ok;
}
/** `gate <station>`: checks a station's output without moving on. */
export function gateCommand(ctx, args) {
    const id = needPositional(args, 0, `gate <${STATION_IDS.join('|')}> [--from DIR]`);
    if (!isStationId(id))
        throw new UsageError(`Unknown station "${id}". Stations: ${STATION_IDS.join(', ')}`);
    const from = args.string('from');
    let result;
    if (from) {
        result = runGate(id, path.resolve(ctx.cwd, from));
    }
    else {
        const opened = project(ctx, args);
        result = runGate(id, recordPath(opened.root), opened.root);
    }
    if (args.flag('json'))
        ctx.io.out(JSON.stringify(result, null, 2));
    else
        printGate(ctx, result);
    return result.ok ? EXIT.ok : EXIT.failed;
}
/** `advance <station>`: passes the gate and marks the station done. */
export function advanceCommand(ctx, args) {
    const c = colors(ctx);
    const opened = project(ctx, args);
    const id = needPositional(args, 0, `advance <${STATION_IDS.join('|')}> [--skip REASON]`);
    if (!isStationId(id))
        throw new UsageError(`Unknown station "${id}". Stations: ${STATION_IDS.join(', ')}`);
    const { state, root, store } = opened;
    const blocked = STATION_IDS.slice(0, STATION_IDS.indexOf(id)).filter(item => state.stations[item].status !== 'done');
    if (blocked.length)
        throw new UsageError(`Earlier stations are not done: ${blocked.join(', ')}`);
    const item = station(id);
    const skip = args.flag('skip') ? args.string('skip') : undefined;
    if (args.flag('skip')) {
        if (!item.skippable) {
            throw new UsageError(`Only ${STATIONS.filter(entry => entry.skippable)
                .map(entry => entry.id)
                .join(' and ')} can be skipped; the arena needs the brief and the screenplay.`);
        }
        if (!skip?.trim())
            throw new UsageError('Say why the founder chose to skip: --skip "reason"');
        state.stations[id] = { status: 'done', skipped: true, reason: skip, doneAt: nowIso() };
        saveState(root, state);
        appendLedger(root, store, 'advance', { station: id, skipped: true, reason: skip });
        ctx.io.out(c.yellow(`${id} skipped at the founder's request: ${skip}`));
    }
    else {
        const result = runGate(id, recordPath(root), root);
        printGate(ctx, result);
        if (!result.ok)
            return EXIT.failed;
        const hashes = outputHashes(root, item);
        state.stations[id] = { status: 'done', doneAt: nowIso(), hashes };
        saveState(root, state);
        appendLedger(root, store, 'advance', { station: id, hashes });
    }
    const next = currentStation(state);
    ctx.io.out(next
        ? `Next station: ${c.bold(next.title)} (${next.crew}).`
        : c.green('All stations are done.'));
    return EXIT.ok;
}
/** `template <name>`: prints a template file. */
export function templateCommand(ctx, args) {
    const dir = templatesDir(ctx);
    const files = fs.readdirSync(dir).sort();
    const names = files.map(file => file.replace(/\.[^.]+$/, ''));
    const name = needPositional(args, 0, `template <${names.join('|')}>`);
    const file = files.find(item => item.replace(/\.[^.]+$/, '') === name);
    if (!file)
        throw new UsageError(`No template "${name}". Available: ${names.join(', ')}`);
    ctx.io.out(readRequiredText(path.join(dir, file)).replace(/\n$/, ''));
    return EXIT.ok;
}
/** `brief`: requirements, success criteria, idea check and coverage map. */
export function briefCommand(ctx, args) {
    const c = colors(ctx);
    const file = args.positional[0] ?? recordPath(project(ctx, args).root, '01-brief.md');
    const text = readRequiredText(path.resolve(ctx.cwd, file));
    const coverage = coverageMap(text);
    const summary = {
        verdict: forgeVerdict(text) ?? null,
        requirements: requirements(text),
        success: successCriteria(text),
        coverage: Object.fromEntries(COVERAGE_AREAS.map(area => [area, coverage.get(area) ?? null])),
    };
    if (args.flag('json')) {
        ctx.io.out(JSON.stringify(summary, null, 2));
        return EXIT.ok;
    }
    ctx.io.out(`Idea check: ${summary.verdict ?? c.yellow('no verdict yet')}`);
    ctx.io.out('Requirements:');
    for (const item of summary.requirements)
        ctx.io.out(`  ${c.bold(item.id)} ${item.text}`);
    ctx.io.out('Success criteria:');
    for (const item of summary.success)
        ctx.io.out(`  ${c.bold(item.id)} ${item.text}`);
    ctx.io.out('Coverage:');
    for (const area of COVERAGE_AREAS) {
        const status = coverage.get(area);
        const tint = status === 'Clear' ? c.green : status === 'Partial' ? c.yellow : c.red;
        ctx.io.out(`  ${area.padEnd(10)} ${tint(status ?? 'not rated')}`);
    }
    return EXIT.ok;
}
/** `doctor`: checks Node, git, npm and the project's records. */
export function doctorCommand(ctx, args) {
    const c = colors(ctx);
    const rows = [];
    const major = Number(process.versions.node.split('.')[0]);
    rows.push([
        major >= 20,
        `Node.js ${process.versions.node}`,
        major >= 20 ? '' : 'Skillsmith needs Node 20 or newer: https://nodejs.org',
    ]);
    const gitOk = G.hasGit();
    rows.push([gitOk, 'git', gitOk ? '' : 'Install git: https://git-scm.com']);
    const dirFlag = args.string('dir');
    const root = dirFlag ? path.resolve(ctx.cwd, dirFlag) : findProjectRoot(ctx.cwd);
    rows.push([
        Boolean(root),
        'Skillsmith project',
        root ?? 'not in a project yet: run `skillsmith init`',
    ]);
    if (root && fs.existsSync(recordPath(root, STATE_FILE))) {
        if (gitOk)
            rows.push([
                G.isRepo(root),
                'git repository',
                G.isRepo(root) ? '' : 'run `git init` or `skillsmith init`',
            ]);
        const opened = project(ctx, args);
        const ledger = verifyLedger(opened.root, opened.store);
        rows.push([
            ledger.ok,
            `ledger (${ledger.entries} entries)`,
            ledger.ok
                ? ledger.macChecked
                    ? 'signatures checked'
                    : 'key not on this machine: chain only'
                : ledger.problems.join('; '),
        ]);
        const drift = driftedOutputs(opened);
        rows.push([drift.length === 0, 'approved files unchanged', drift.join(', ')]);
    }
    for (const [ok, what, note] of rows)
        ctx.io.out(`  ${ok ? c.green('✔') : c.red('✘')} ${what}${note ? c.dim(`  ${note}`) : ''}`);
    return rows.every(([ok]) => ok) ? EXIT.ok : EXIT.failed;
}
