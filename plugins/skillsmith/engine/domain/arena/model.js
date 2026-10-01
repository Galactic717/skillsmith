/**
 * Arena data model: rival teams in separate git worktrees, verified in clean
 * rooms. Lying, tampering with protected files or accusing without proof
 * deletes a team: worktree and branch are removed and the evidence goes to
 * the graveyard.
 */
import path from 'node:path';
import { SkillsmithError, UsageError } from '../../core/errors.js';
import { readJson, writeJson } from '../../core/fs.js';
import { isRecord } from '../../core/json.js';
import { recordPath } from '../../core/paths.js';
import { nowIso } from '../../core/text.js';
/** The three managers. Each has a fixed philosophy, so the rival builds differ. */
export const PERSONAS = [
    { persona: 'Sprint', motto: 'The smallest product that fully works, shipped first.' },
    { persona: 'Fortress', motto: 'Nothing breaks: tests, edge cases, security, accessibility.' },
    { persona: 'Spark', motto: 'The boldest experience people remember and tell friends about.' },
];
/** Default team names, in order. Dead names are never reused. */
export const TEAM_NAMES = [
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon',
    'zeta',
    'eta',
    'theta',
];
/** Points available in each part of the score. */
export const SCORING = {
    acceptance: 40,
    /** Acceptance is worth this much when no holdout checks were sealed. */
    acceptanceWithoutHoldout: 60,
    holdout: 20,
    claimsCap: 10,
    accusationBonus: 3,
    accusationBonusCap: 9,
    accusationPenalty: 4,
    judgeMax: 30,
    safetyPenalty: 10,
    /** Margin at or below which the top two are "too close to call". */
    tooClose: 2,
};
/** Plain-language reasons for each cause of death. */
export const CAUSE_TEXT = {
    'false-claim': 'claimed something that its own evidence check proved false',
    tampering: 'changed protected files (tests or Skillsmith records)',
    'false-accusation': 'accused a rival with evidence that did not hold up',
    manual: 'eliminated by the founder',
};
/** Absolute paths for a team's worktree and dossier. */
export function teamPaths(root, team) {
    const dossier = recordPath(root, 'teams', team);
    return {
        team,
        branch: `skillsmith/${team}`,
        worktree: recordPath(root, 'arena', team),
        dossier,
        orders: path.join(dossier, 'orders.md'),
        claims: path.join(dossier, 'claims.json'),
        accusations: path.join(dossier, 'accusations.json'),
        probes: path.join(dossier, 'probes'),
        verdict: path.join(dossier, 'verdict.json'),
        precheck: path.join(dossier, 'precheck.json'),
        accusationsVerdict: path.join(dossier, 'accusations-verdict.json'),
        accusationsDryRun: path.join(dossier, 'accusations-dryrun.json'),
    };
}
/** Path of arena.json. */
export function arenaFile(root) {
    return recordPath(root, 'arena.json');
}
/** Loads arena.json; undefined when no arena was ever opened. */
export function loadArena(root) {
    const value = readJson(arenaFile(root), { optional: true });
    if (value === undefined)
        return undefined;
    if (!isRecord(value) || value['version'] !== 2 || !isRecord(value['teams'])) {
        throw new SkillsmithError('.skillsmith/arena.json is from an older Skillsmith or damaged.', {
            hint: 'Finish or remove the old arena, then run `skillsmith arena init` again.',
        });
    }
    return value;
}
/** Loads arena.json or explains how to open one. */
export function requireArena(root) {
    const arena = loadArena(root);
    if (!arena) {
        throw new SkillsmithError('The arena has not started.', {
            hint: 'Run `skillsmith arena init` after the screenplay gate passes.',
        });
    }
    return arena;
}
/** Writes arena.json. */
export function saveArena(root, arena) {
    writeJson(arenaFile(root), arena);
}
/** Appends an event to the fight log. */
export function addEvent(arena, type, team, data) {
    arena.events.push({ at: nowIso(), round: arena.round, type, ...(team ? { team } : {}), data });
}
/** Looks up a team or fails with the list of valid names. */
export function getTeam(arena, name) {
    const team = arena.teams[name];
    if (!team) {
        throw new UsageError(`No team "${name}" in this arena. Teams: ${Object.keys(arena.teams).join(', ')}`);
    }
    return team;
}
/** Fails unless the team is still alive. */
export function requireAlive(arena, name) {
    const team = getTeam(arena, name);
    if (team.status !== 'alive')
        throw new SkillsmithError(`Team ${name} is ${team.status}.`);
    return team;
}
/** Names of teams still alive. */
export function aliveTeams(arena) {
    return Object.entries(arena.teams)
        .filter(([, team]) => team.status === 'alive')
        .map(([name]) => name);
}
function text(data, key) {
    const value = data[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
/** One plain-English line for an event. */
export function describeEvent(event) {
    const data = event.data;
    const persona = text(data, 'persona');
    switch (event.type) {
        case 'enter':
            return `${persona} enters the arena: ${text(data, 'motto')}`;
        case 'precheck':
            return `${persona} ran a private precheck: ${text(data, 'passed')}/${text(data, 'total')} acceptance checks pass.`;
        case 'verify': {
            const holdout = data['holdoutTotal']
                ? `, hidden ${text(data, 'holdoutPassed')}/${text(data, 'holdoutTotal')}`
                : '';
            return `${persona}: ${text(data, 'passed')}/${text(data, 'total')} acceptance${holdout}, ${text(data, 'verified')} claim(s) proven, ${text(data, 'false')} false.`;
        }
        case 'upheld':
            return `${persona} proved a defect in ${text(data, 'target')}: ${text(data, 'text')}`;
        case 'perjury':
            return `${persona} accused ${text(data, 'target')} without proof: ${text(data, 'text')}`;
        case 'death': {
            const cause = text(data, 'cause');
            return `${persona} is out: ${CAUSE_TEXT[cause] ?? cause}.`;
        }
        case 'wiped':
            return 'No team survived. Start a new arena with fresh names.';
        case 'judge':
            return 'The auditor scored the survivors, with evidence.';
        case 'retire':
            return `${persona} lost honestly. Branch kept as ${text(data, 'branch')}.`;
        case 'crown':
            return `${persona} wins. Their work is merged.`;
        case 'round':
            return `Round ${text(data, 'round')} begins.`;
        case 'fuse':
            return data['ok'] === true
                ? `Strengths from ${text(data, 'from')} were fused into the winner; every check still passes.`
                : `Fusion from ${text(data, 'from')} broke ${text(data, 'regressions')} check(s); revert it.`;
    }
}
