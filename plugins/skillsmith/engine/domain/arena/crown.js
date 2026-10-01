/**
 * Ending the arena: the winner's branch is merged, honest losers' branches are
 * kept under skillsmith/retired/, and fusion lets the winner borrow a loser's
 * strengths without breaking a single check.
 */
import { SkillsmithError, UsageError } from '../../core/errors.js';
import { writeJson } from '../../core/fs.js';
import * as G from '../../core/git.js';
import { appendLedger } from '../../core/ledger.js';
import { RECORDS_DIR } from '../../core/paths.js';
import { nowIso } from '../../core/text.js';
import { runCheck } from '../checks.js';
import { holdoutReportPath, loadSealedHoldout } from '../holdout.js';
import { saveState } from '../project.js';
import { runSetup, withCleanroom } from './cleanroom.js';
import { killTeam } from './graveyard.js';
import { loadAcceptance } from './init.js';
import { addEvent, aliveTeams, getTeam, requireAlive, requireArena, saveArena, teamPaths, } from './model.js';
import { computeScore, loadVerdict } from './score.js';
import { writeHoldoutFiles } from './trial.js';
/** Eliminates a team on the founder's word. */
export function eliminate(project, name, reason) {
    if (!reason.trim())
        throw new UsageError('Say why: --reason "..."');
    const arena = requireArena(project.root);
    requireAlive(arena, name);
    killTeam(project, arena, name, 'manual', [{ label: reason }]);
    saveArena(project.root, arena);
}
/** Starts the next round so teams can improve and verify again. */
export function nextRound(project) {
    const arena = requireArena(project.root);
    if (arena.status !== 'running')
        throw new SkillsmithError(`The arena is ${arena.status}.`);
    arena.round += 1;
    addEvent(arena, 'round', undefined, { round: arena.round });
    saveArena(project.root, arena);
    return arena.round;
}
function commitRecords(root, message) {
    G.commitPaths(root, [RECORDS_DIR], message);
}
/** Crowns a team (the leader by default) and merges its branch. */
export function crown(project, requested, options = {}) {
    const { root, store } = project;
    const arena = requireArena(root);
    if (arena.status !== 'running')
        throw new SkillsmithError(`The arena is ${arena.status}; nothing to crown.`);
    const board = computeScore(project);
    if (board.rows.length === 0) {
        throw new SkillsmithError('No team is alive.', {
            hint: 'Start a new arena: `skillsmith arena init`.',
        });
    }
    if (!board.judgeOk && !options.force) {
        throw new SkillsmithError('The auditor has not scored every surviving team with evidence.', {
            hint: 'Write .skillsmith/judge.json and run `skillsmith arena judge`.',
        });
    }
    const winner = requested ?? board.rows.find(row => row.eligible)?.team ?? board.rows[0]?.team ?? '';
    const team = requireAlive(arena, winner);
    const row = board.rows.find(item => item.team === winner);
    const verdict = loadVerdict(root, winner);
    if (!verdict || verdict.outcome !== 'alive') {
        throw new SkillsmithError(`Team ${winner} has no passing verification.`, {
            hint: `Run \`skillsmith arena verify ${winner}\`.`,
        });
    }
    if (G.revParse(root, team.branch) !== verdict.commit) {
        throw new SkillsmithError(`Team ${winner} changed code after verification.`, {
            hint: `Verify again: \`skillsmith arena verify ${winner}\`.`,
        });
    }
    if (!verdict.safety.clean) {
        throw new SkillsmithError(`Team ${winner} has a safety problem (a committed secret or a made-up dependency).`, {
            hint: 'A team with a safety problem cannot be crowned. Fix it, commit, and verify again.',
        });
    }
    if (!row?.eligible)
        throw new SkillsmithError(`Team ${winner} is not eligible: ${row?.notes.join('; ') ?? 'no score'}.`);
    if (G.currentBranch(root) === 'HEAD') {
        throw new SkillsmithError('The main checkout is on a detached HEAD; switch to your main branch first.');
    }
    const stray = G.dirtyPaths(root).filter(item => !item.startsWith(`${RECORDS_DIR}/`));
    if (stray.length) {
        throw new SkillsmithError(`Uncommitted changes outside ${RECORDS_DIR}/ would mix with the winner:\n${stray.join('\n')}`, {
            hint: 'Commit or stash them first.',
        });
    }
    for (const name of aliveTeams(arena).filter(item => item !== winner)) {
        const other = getTeam(arena, name);
        G.removeWorktree(root, teamPaths(root, name).worktree);
        let retired = `skillsmith/retired/${name}`;
        if (G.branchExists(root, retired))
            retired = `${retired}-${Date.now()}`;
        G.git(['branch', '-m', other.branch, retired], root);
        other.status = 'retired';
        other.branch = retired;
        addEvent(arena, 'retire', name, { persona: other.persona, branch: retired });
    }
    saveArena(root, arena);
    G.ensureIdentity(root);
    commitRecords(root, 'skillsmith: arena records');
    G.removeWorktree(root, teamPaths(root, winner).worktree);
    const merge = G.git([
        'merge',
        '--no-ff',
        '--no-verify',
        team.branch,
        '-m',
        `skillsmith: crown team ${winner} (${team.persona})`,
    ], root, true);
    if (!merge.ok) {
        G.git(['merge', '--abort'], root, true);
        throw new SkillsmithError(`Merging ${team.branch} failed: ${merge.err || merge.out}`, {
            hint: `Resolve by hand: git merge --no-ff ${team.branch}`,
        });
    }
    G.git(['branch', '-d', team.branch], root, true);
    team.status = 'crowned';
    arena.status = 'crowned';
    arena.winner = winner;
    arena.crownedAt = nowIso();
    addEvent(arena, 'crown', winner, { persona: team.persona });
    saveArena(root, arena);
    appendLedger(root, store, 'crown', {
        winner,
        commit: verdict.commit,
        forced: Boolean(options.force),
    });
    project.state.stations.arena = { status: 'done', doneAt: nowIso() };
    saveState(root, project.state);
    commitRecords(root, `skillsmith: ${winner} crowned`);
    return { winner, persona: team.persona, rows: board.rows, tooCloseToCall: board.tooCloseToCall };
}
/**
 * Re-verifies the main branch after strengths from a retired team were ported
 * into the winner's code. Every check that passed for the winner must still
 * pass; anything that now fails is a regression.
 */
export async function fuse(project, from) {
    const { root, store } = project;
    const arena = requireArena(root);
    if (arena.status !== 'crowned' || !arena.winner) {
        throw new SkillsmithError('Fusion comes after the crown.', {
            hint: 'Crown a winner first: `skillsmith arena crown`.',
        });
    }
    const donor = getTeam(arena, from);
    if (donor.status !== 'retired')
        throw new UsageError(`Team ${from} is ${donor.status}; only an honest loser can donate.`);
    const baseline = loadVerdict(root, arena.winner);
    if (!baseline)
        throw new SkillsmithError(`No verdict for the winner ${arena.winner}.`);
    const acceptance = loadAcceptance(root);
    const holdout = arena.holdout ? loadSealedHoldout(project, arena.holdout.hash) : undefined;
    const commit = G.revParse(root, 'HEAD');
    const statuses = await withCleanroom(root, store, `fuse-${from}`, commit, async (dir, port) => {
        await runSetup(acceptance.setup, dir, port);
        const result = new Map();
        for (const check of acceptance.checks)
            result.set(check.id, (await runCheck(check, { dir, port })).status);
        if (holdout) {
            writeHoldoutFiles(dir, holdout.files);
            for (const check of holdout.checks)
                result.set(check.id, (await runCheck(check, { dir, port })).status);
        }
        return result;
    });
    if (holdout)
        writeJson(holdoutReportPath(project, `fusion-${from}`, arena.round), Object.fromEntries(statuses), 0o600);
    const before = new Map([
        ...baseline.acceptance.results.map(row => [row.id, row.status]),
        ...baseline.holdout.results.map(row => [row.id, row.status]),
    ]);
    const regressions = [...before]
        .filter(([id, status]) => status === 'pass' && statuses.get(id) !== 'pass')
        .map(([id]) => id);
    const improvements = [...statuses]
        .filter(([id, status]) => status === 'pass' && before.get(id) !== 'pass')
        .map(([id]) => id);
    const ok = regressions.length === 0;
    addEvent(arena, 'fuse', arena.winner, { from, ok, regressions: regressions.length });
    saveArena(root, arena);
    appendLedger(root, store, 'fuse', { from, commit, ok, regressions, improvements });
    commitRecords(root, `skillsmith: fusion from ${from} ${ok ? 'kept' : 'rejected'}`);
    return { ok, from, commit, regressions, improvements };
}
