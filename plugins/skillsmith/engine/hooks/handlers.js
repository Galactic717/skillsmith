/**
 * Claude Code hook handlers. They must be fast and must never break a
 * session: the CLI treats any error as "no opinion".
 *
 * - SessionStart tells Claude where the project stands.
 * - PreToolUse keeps agents away from the engine's records, the protected
 *   files of each team and the private store that holds the hidden checks.
 * - Stop refuses to end a turn once when a manager filed claims after the
 *   last official verification, so unverified claims are never left behind.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJson, toPosix } from '../core/fs.js';
import { matchAny, matchGlob } from '../core/glob.js';
import { isRecord } from '../core/json.js';
import { findProjectRoot, projectStorePath, recordPath, RECORDS_DIR } from '../core/paths.js';
import { aliveTeams, loadArena, teamPaths } from '../domain/arena/model.js';
import { currentStation, driftedOutputs, parseState } from '../domain/project.js';
/** Files only the engine writes. */
const ENGINE_RECORDS = [
    `${RECORDS_DIR}/state.json`,
    `${RECORDS_DIR}/ledger.jsonl`,
    `${RECORDS_DIR}/arena.json`,
    `${RECORDS_DIR}/04-vacuity.json`,
    `${RECORDS_DIR}/graveyard.json`,
    `${RECORDS_DIR}/graveyard.md`,
    `${RECORDS_DIR}/scoreboard.md`,
    `${RECORDS_DIR}/history/**`,
    `${RECORDS_DIR}/teams/*/verdict.json`,
    `${RECORDS_DIR}/teams/*/precheck.json`,
    `${RECORDS_DIR}/teams/*/accusations-verdict.json`,
    `${RECORDS_DIR}/teams/*/accusations-dryrun.json`,
];
const RECORD_NAMES = /\b(ledger\.jsonl|verdict\.json|precheck\.json|arena\.json|state\.json|scoreboard\.md|graveyard\.(json|md)|04-vacuity\.json|accusations-verdict\.json)\b/;
const WRITE_OPERATORS = /(>|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\bwriteFile|\bperl\s+-[a-z]*i)/;
const STORE_MENTIONS = /\.skillsmith[\\/]projects|SKILLSMITH_HOME/;
function inputCwd(input, env) {
    const cwd = input['cwd'];
    return typeof cwd === 'string' && cwd ? cwd : (env['CLAUDE_PROJECT_DIR'] ?? process.cwd());
}
function locate(start, env) {
    const root = findProjectRoot(start);
    if (!root)
        return undefined;
    const { state } = parseState(readJson(recordPath(root, 'state.json')));
    let arena;
    try {
        arena = loadArena(root);
    }
    catch {
        arena = undefined;
    }
    return { root, state, store: projectStorePath(env, state.projectId), arena };
}
function deny(reason) {
    return {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
        },
    };
}
function isInside(parent, child) {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
/** Context for a new or resumed session. */
export function sessionStart(input, env) {
    const found = locate(inputCwd(input, env), env);
    if (!found)
        return undefined;
    const { state, arena, root, store } = found;
    const now = currentStation(state);
    const parts = [`This folder is a Skillsmith project ("${state.project}").`];
    parts.push(now
        ? `Current station: ${now.title} (${now.crew}). To continue, use the ${now.skill} skill.`
        : 'Every station is done.');
    if (arena?.status === 'running') {
        const alive = aliveTeams(arena).map(name => `${name}/${arena.teams[name]?.persona ?? ''}`);
        parts.push(`Arena round ${arena.round} is running. Alive: ${alive.join(', ') || 'nobody'}.`);
    }
    const drift = driftedOutputs({ root, state, store });
    if (drift.length)
        parts.push(`Edited after approval: ${drift.join(', ')}. Re-run that station's gate.`);
    parts.push('Rule: never say a check passed unless a Skillsmith verdict shows it. Run `skillsmith status` when unsure.');
    return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: parts.join(' ') } };
}
function checkWrite(found, absolute) {
    const relative = toPosix(path.relative(found.root, absolute));
    if (relative.startsWith('..'))
        return undefined;
    if (matchAny(relative, ENGINE_RECORDS)) {
        return deny(`${relative} is an official Skillsmith record. Only the skillsmith engine writes it; run the matching skillsmith command instead.`);
    }
    const arena = found.arena;
    if (arena?.status !== 'running')
        return undefined;
    if (relative === `${RECORDS_DIR}/04-acceptance.json`) {
        return deny('The arena is running: the acceptance checks are frozen until it ends.');
    }
    const inTeam = /^\.skillsmith\/arena\/([^/]+)\/(.+)$/.exec(relative);
    if (inTeam?.[1] && inTeam[2] && arena.teams[inTeam[1]]) {
        if (arena.protected.some(glob => matchGlob(inTeam[2] ?? '', glob))) {
            return deny(`${inTeam[2]} is protected in team ${inTeam[1]}'s worktree (acceptance tests or Skillsmith records). A committed change to it eliminates the team. File claims in ${teamPaths(found.root, inTeam[1]).dossier} instead.`);
        }
        return undefined;
    }
    const userGlobs = arena.protected.filter(glob => !glob.startsWith(`${RECORDS_DIR}/`));
    if (matchAny(relative, userGlobs))
        return deny(`${relative} is an acceptance file and is frozen while the arena runs.`);
    return undefined;
}
function checkRead(found, absolute) {
    if (isInside(found.store, absolute)) {
        return deny('That folder is the private Skillsmith store (hidden holdout checks and the ledger key). Builders and managers never read it.');
    }
    const relative = toPosix(path.relative(found.root, absolute));
    if (found.arena?.status === 'running' && relative === `${RECORDS_DIR}/holdout.json`) {
        return deny('Hidden holdout checks are off limits while the arena runs.');
    }
    return undefined;
}
function checkBash(found, command) {
    if (STORE_MENTIONS.test(command) || command.includes(found.store)) {
        return deny('That command touches the private Skillsmith store (hidden holdout checks and the ledger key).');
    }
    if (found.arena?.status === 'running' && command.includes('holdout.json')) {
        return deny('Hidden holdout checks are off limits while the arena runs.');
    }
    if (RECORD_NAMES.test(command) && WRITE_OPERATORS.test(command)) {
        return deny('That command would change an official Skillsmith record. Only the skillsmith engine writes records.');
    }
    return undefined;
}
/** Guards file and shell access before a tool runs. */
export function preToolUse(input, env) {
    const toolInput = isRecord(input['tool_input']) ? input['tool_input'] : {};
    const toolName = typeof input['tool_name'] === 'string' ? input['tool_name'] : '';
    const cwd = inputCwd(input, env);
    const target = [toolInput['file_path'], toolInput['notebook_path'], toolInput['path']].find((value) => typeof value === 'string' && value.length > 0);
    const absolute = target ? path.resolve(cwd, target) : undefined;
    const found = locate(absolute ? (fs.existsSync(absolute) ? path.dirname(absolute) : cwd) : cwd, env) ??
        locate(cwd, env);
    if (!found)
        return undefined;
    if (toolName === 'Bash') {
        const command = toolInput['command'];
        return typeof command === 'string' ? checkBash(found, command) : undefined;
    }
    if (!absolute)
        return undefined;
    if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
        return checkRead(found, absolute) ?? checkWrite(found, absolute);
    }
    return checkRead(found, absolute);
}
function mtime(file) {
    try {
        return fs.statSync(file).mtimeMs;
    }
    catch {
        return 0;
    }
}
/** Blocks the end of a turn once if claims were filed after the last verification. */
export function stopGuard(input, env) {
    if (input['stop_hook_active'] === true)
        return undefined;
    const found = locate(inputCwd(input, env), env);
    if (found?.arena?.status !== 'running')
        return undefined;
    const stale = aliveTeams(found.arena).filter(name => {
        const paths = teamPaths(found.root, name);
        const claims = mtime(paths.claims);
        return claims > 0 && claims > mtime(paths.verdict);
    });
    if (stale.length === 0)
        return undefined;
    return {
        decision: 'block',
        reason: `Claims were filed after the last official verification for: ${stale.join(', ')}. Run \`skillsmith arena verify ${stale.length === 1 ? stale[0] : '--all'}\` before you stop, so no unchecked claim is left behind.`,
    };
}
