/**
 * Verification. Each team's latest commit is checked out into a clean room
 * and judged there: setup, acceptance checks, sealed holdout checks (official
 * runs only), safety, then every claim the manager filed. A claim whose own
 * evidence fails, or a change to a protected file, eliminates the team.
 *
 * The slow work (evaluateTeam) touches no shared records, so several teams
 * can be verified in parallel; applyVerdict then writes records one by one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJson, resolveInside, writeJson } from '../../core/fs.js';
import * as G from '../../core/git.js';
import { matchAny } from '../../core/glob.js';
import { appendLedger, fileHash } from '../../core/ledger.js';
import { clip, nowIso } from '../../core/text.js';
import { runCheck } from '../checks.js';
import { holdoutReportPath, loadSealedHoldout } from '../holdout.js';
import { runSafety } from '../safety.js';
import { runSetup, scrubPath, withCleanroom } from './cleanroom.js';
import { killTeam } from './graveyard.js';
import { loadAcceptance, protectedGlobs } from './init.js';
import { addEvent, aliveTeams, requireAlive, requireArena, saveArena, teamPaths, } from './model.js';
import { parseClaims } from './records.js';
function totals(rows) {
    const passed = rows.filter(row => row.status === 'pass');
    return {
        passed: passed.length,
        total: rows.length,
        weightPassed: passed.reduce((sum, row) => sum + row.weight, 0),
        weightTotal: rows.reduce((sum, row) => sum + row.weight, 0),
    };
}
async function runChecks(checks, dir) {
    const rows = [];
    for (const check of checks) {
        const outcome = await runCheck(check, { dir });
        rows.push({
            id: check.id,
            title: check.title,
            weight: check.weight,
            covers: check.covers,
            status: outcome.status,
            detail: clip(scrubPath(outcome.detail, dir), 500),
        });
    }
    return rows;
}
/** Writes hidden test files into a clean room; returns their paths for cleanup. */
export function writeHoldoutFiles(dir, files) {
    const written = [];
    for (const [relative, content] of Object.entries(files)) {
        const absolute = resolveInside(dir, relative);
        if (!absolute)
            continue;
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content);
        written.push(absolute);
    }
    return written;
}
const CLAIM_STATUS = {
    pass: 'verified',
    fail: 'false',
};
/** Judges one team's latest commit in a clean room. Writes no records. */
export async function evaluateTeam(project, arena, name, options) {
    const { root, store } = project;
    const team = requireAlive(arena, name);
    const acceptance = loadAcceptance(root);
    const paths = teamPaths(root, name);
    const head = G.revParse(root, team.branch);
    const dirty = fs.existsSync(paths.worktree) ? G.dirtyPaths(paths.worktree).length : 0;
    const globs = protectedGlobs(acceptance);
    const tampered = G.changedFiles(root, arena.base, head).filter(file => matchAny(file, globs));
    const claimsValue = readJson(paths.claims, { optional: true });
    const claims = claimsValue === undefined ? undefined : parseClaims(claimsValue);
    const holdout = options.mode === 'verify' && arena.holdout
        ? loadSealedHoldout(project, arena.holdout.hash)
        : undefined;
    return withCleanroom(root, store, `${name}-${options.mode}`, head, async (dir) => {
        const safety = await runSafety(dir, {
            ...(options.offline === undefined ? {} : { offline: options.offline }),
            ...(options.lookup ? { lookup: options.lookup } : {}),
        });
        const setup = options.setup === false ? [] : await runSetup(acceptance.setup, dir);
        const acceptanceRows = await runChecks(acceptance.checks, dir);
        let holdoutRows = [];
        if (holdout) {
            const written = writeHoldoutFiles(dir, holdout.files);
            holdoutRows = await runChecks(holdout.checks, dir);
            for (const file of written)
                fs.rmSync(file, { force: true });
        }
        const acceptanceMap = Object.fromEntries(acceptanceRows.map(row => [row.id, row.status]));
        const claimRows = [];
        for (const claim of claims?.claims ?? []) {
            const outcome = await runCheck(claim.evidence, { dir, acceptance: acceptanceMap });
            claimRows.push({
                id: claim.id,
                text: claim.text,
                status: CLAIM_STATUS[outcome.status] ?? 'unverifiable',
                check: outcome.status,
                detail: clip(scrubPath(outcome.detail, dir), 500),
            });
        }
        const verdict = {
            version: 2,
            team: name,
            persona: team.persona,
            mode: options.mode,
            round: arena.round,
            at: nowIso(),
            commit: head,
            commits: G.commitCount(root, arena.base, head),
            diff: G.diffSize(root, arena.base, head),
            uncommitted: dirty,
            tampered,
            setup,
            acceptance: { ...totals(acceptanceRows), results: acceptanceRows },
            holdout: {
                ...totals(holdoutRows),
                ran: Boolean(holdout),
                results: holdoutRows.map(({ detail: _detail, ...row }) => row),
            },
            safety,
            claims: {
                filed: claims !== undefined,
                errors: claims?.errors ?? ['no claims.json filed yet'],
                results: claimRows,
                verified: claimRows.filter(row => row.status === 'verified').length,
                false: claimRows.filter(row => row.status === 'false').length,
                unverifiable: claimRows.filter(row => row.status === 'unverifiable').length,
            },
            knownIssues: claims?.knownIssues ?? [],
            outcome: 'alive',
            cause: null,
        };
        const { cause } = judgeOutcome(verdict);
        verdict.cause = cause;
        verdict.outcome = cause ? 'dead' : claimRows.length ? 'alive' : 'no-claims';
        return { verdict, holdoutDetails: holdoutRows };
    });
}
function judgeOutcome(verdict) {
    if (verdict.tampered.length) {
        return {
            cause: 'tampering',
            evidence: verdict.tampered.map(file => ({ label: `changed protected file \`${file}\`` })),
        };
    }
    if (verdict.claims.false > 0) {
        return {
            cause: 'false-claim',
            evidence: verdict.claims.results
                .filter(row => row.status === 'false')
                .map(row => ({ label: `${row.id}: "${row.text}"`, detail: row.detail })),
        };
    }
    return { cause: null, evidence: [] };
}
/** Writes a verdict, signs it in the ledger, and eliminates the team if needed. */
export function applyVerdict(project, arena, evaluation) {
    const { root, store } = project;
    const { verdict, holdoutDetails } = evaluation;
    const paths = teamPaths(root, verdict.team);
    const persona = verdict.persona;
    if (verdict.mode === 'precheck') {
        writeJson(paths.precheck, verdict);
        addEvent(arena, 'precheck', verdict.team, {
            persona,
            passed: verdict.acceptance.passed,
            total: verdict.acceptance.total,
        });
        return;
    }
    writeJson(paths.verdict, verdict);
    if (verdict.holdout.ran)
        writeJson(holdoutReportPath(project, verdict.team, verdict.round), holdoutDetails, 0o600);
    appendLedger(root, store, 'verdict', {
        team: verdict.team,
        round: verdict.round,
        commit: verdict.commit,
        hash: fileHash(paths.verdict) ?? '',
        outcome: verdict.outcome,
    });
    addEvent(arena, 'verify', verdict.team, {
        persona,
        passed: verdict.acceptance.passed,
        total: verdict.acceptance.total,
        holdoutPassed: verdict.holdout.passed,
        holdoutTotal: verdict.holdout.total,
        verified: verdict.claims.verified,
        false: verdict.claims.false,
    });
    const { cause, evidence } = judgeOutcome(verdict);
    if (cause)
        killTeam(project, arena, verdict.team, cause, evidence);
}
/** Verifies one team, or every alive team in parallel when `name` is "--all". */
export async function verifyTeams(project, names, options) {
    const arena = requireArena(project.root);
    const targets = names.length ? names : aliveTeams(arena);
    for (const name of targets)
        requireAlive(arena, name);
    const evaluations = await Promise.all(targets.map(name => evaluateTeam(project, arena, name, options)));
    for (const evaluation of evaluations)
        applyVerdict(project, arena, evaluation);
    saveArena(project.root, arena);
    return evaluations.map(evaluation => evaluation.verdict);
}
