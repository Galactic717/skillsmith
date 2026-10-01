/**
 * Scoring. Points come only from records the engine wrote and signed: a
 * verdict, accusation result or judge file that no longer matches its ledger
 * hash is refused, not counted.
 */
import { SkillsmithError } from '../../core/errors.js';
import { readJson, writeFileAtomic } from '../../core/fs.js';
import * as G from '../../core/git.js';
import { isRecord } from '../../core/json.js';
import { appendLedger, assertRecordUnchanged, fileHash, latestEntry } from '../../core/ledger.js';
import { recordPath } from '../../core/paths.js';
import { addEvent, aliveTeams, CAUSE_TEXT, requireArena, saveArena, SCORING, teamPaths, } from './model.js';
import { JUDGE_CRITERIA, parseJudge } from './records.js';
/** Path of judge.json. */
export function judgeFile(root) {
    return recordPath(root, 'judge.json');
}
/** Loads a team's official verdict after checking it against the ledger. */
export function loadVerdict(root, team) {
    const file = teamPaths(root, team).verdict;
    const value = readJson(file, { optional: true });
    if (value === undefined)
        return undefined;
    const entry = latestEntry(root, 'verdict', data => data['team'] === team);
    assertRecordUnchanged(file, entry?.data['hash'], `teams/${team}/verdict.json`);
    return value;
}
function loadAccusationVerdicts(root, arena) {
    const verdicts = [];
    for (const name of Object.keys(arena.teams)) {
        const file = teamPaths(root, name).accusationsVerdict;
        const value = readJson(file, { optional: true });
        if (value === undefined)
            continue;
        const entry = latestEntry(root, 'accusations', data => data['accuser'] === name);
        assertRecordUnchanged(file, entry?.data['hash'], `teams/${name}/accusations-verdict.json`);
        if (isRecord(value))
            verdicts.push(value);
    }
    return verdicts;
}
function acceptedJudge(root, contenders) {
    const file = judgeFile(root);
    const value = readJson(file, { optional: true });
    if (value === undefined)
        return undefined;
    const entry = latestEntry(root, 'judge');
    if (!entry || entry.data['hash'] !== fileHash(file))
        return undefined;
    return parseJudge(value, contenders).scores;
}
/** Validates judge.json and, if it is acceptable, signs it in the ledger. */
export function acceptJudge(project) {
    const arena = requireArena(project.root);
    const contenders = aliveTeams(arena);
    const { errors } = parseJudge(readJson(judgeFile(project.root)), contenders);
    if (errors.length)
        return errors;
    appendLedger(project.root, project.store, 'judge', {
        hash: fileHash(judgeFile(project.root)) ?? '',
        teams: contenders,
    });
    addEvent(arena, 'judge', undefined, { teams: contenders.join(', ') });
    saveArena(project.root, arena);
    return [];
}
/** Computes the scoreboard and writes scoreboard.md. */
export function computeScore(project) {
    const { root } = project;
    const arena = requireArena(root);
    const contenders = Object.entries(arena.teams)
        .filter(([, team]) => team.status !== 'dead')
        .map(([name]) => name);
    const judge = acceptedJudge(root, contenders);
    const accusations = loadAccusationVerdicts(root, arena);
    const acceptanceMax = arena.holdout ? SCORING.acceptance : SCORING.acceptanceWithoutHoldout;
    const rows = contenders.map(name => {
        const team = arena.teams[name];
        if (!team)
            throw new SkillsmithError(`Team ${name} vanished from arena.json.`);
        const verdict = loadVerdict(root, name);
        const notes = [];
        let acceptancePts = 0;
        let holdoutPts = 0;
        let claimPts = 0;
        let safetyPenalty = 0;
        let current = false;
        if (verdict) {
            const { weightPassed, weightTotal } = verdict.acceptance;
            acceptancePts = weightTotal ? Math.round((acceptanceMax * weightPassed) / weightTotal) : 0;
            if (arena.holdout && verdict.holdout.ran && verdict.holdout.weightTotal) {
                holdoutPts = Math.round((SCORING.holdout * verdict.holdout.weightPassed) / verdict.holdout.weightTotal);
            }
            claimPts = Math.min(SCORING.claimsCap, verdict.claims.verified);
            if (!verdict.safety.clean) {
                safetyPenalty = SCORING.safetyPenalty;
                notes.push('safety problem: cannot be crowned');
            }
            current =
                team.status !== 'alive' ||
                    (G.branchExists(root, team.branch) && G.revParse(root, team.branch) === verdict.commit);
            if (!current)
                notes.push('code changed after verification');
        }
        else {
            notes.push('not verified yet');
        }
        const made = accusations
            .filter(item => item.accuser === name)
            .flatMap(item => item.results)
            .filter(item => item.status === 'upheld').length;
        const received = accusations
            .flatMap(item => item.results)
            .filter(item => item.against === name && item.status === 'upheld').length;
        const crossPlus = Math.min(SCORING.accusationBonusCap, SCORING.accusationBonus * made);
        const crossMinus = SCORING.accusationPenalty * received;
        const judgeRow = judge?.[name];
        const judgePts = judgeRow
            ? JUDGE_CRITERIA.reduce((sum, criterion) => sum + judgeRow[criterion], 0)
            : 0;
        if (!judgeRow)
            notes.push('no accepted auditor scores yet');
        const total = acceptancePts + holdoutPts + claimPts + crossPlus - crossMinus + judgePts - safetyPenalty;
        const eligible = team.status === 'alive' && verdict?.outcome === 'alive' && verdict.safety.clean && current;
        return {
            team: name,
            persona: team.persona,
            status: team.status,
            acceptancePts,
            holdoutPts,
            claimPts,
            crossPlus,
            crossMinus,
            judgePts,
            safetyPenalty,
            total,
            verified: Boolean(verdict),
            eligible,
            notes,
        };
    });
    rows.sort((a, b) => b.total - a.total ||
        b.holdoutPts - a.holdoutPts ||
        b.judgePts - a.judgePts ||
        b.acceptancePts - a.acceptancePts);
    const first = rows[0];
    const second = rows[1];
    const tooCloseToCall = Boolean(first && second && first.total - second.total <= SCORING.tooClose);
    const board = { rows, judgeOk: Boolean(judge), tooCloseToCall };
    writeScoreboard(root, arena, board);
    return board;
}
function writeScoreboard(root, arena, board) {
    const acceptanceMax = arena.holdout ? SCORING.acceptance : SCORING.acceptanceWithoutHoldout;
    const formula = [
        `acceptance up to ${acceptanceMax}`,
        ...(arena.holdout ? [`hidden holdout checks up to ${SCORING.holdout}`] : []),
        `proven claims up to ${SCORING.claimsCap}`,
        `proven accusations +${SCORING.accusationBonus} each (up to ${SCORING.accusationBonusCap})`,
        `defects proven against you −${SCORING.accusationPenalty} each`,
        `auditor up to ${SCORING.judgeMax}`,
        `safety problem −${SCORING.safetyPenalty}`,
    ];
    const dead = Object.entries(arena.teams).filter(([, team]) => team.status === 'dead');
    const lines = [
        '# Scoreboard',
        '',
        `${formula.join('; ')}.`,
        '',
        '| # | Team | Manager | Acceptance | Hidden | Claims | Accused others | Accused by others | Auditor | Safety | Total | Notes |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|',
        ...board.rows.map((row, index) => `| ${index + 1} | ${row.team} | ${row.persona} | ${row.acceptancePts} | ${arena.holdout ? row.holdoutPts : '–'} | ${row.claimPts} | +${row.crossPlus} | −${row.crossMinus} | ${row.judgePts} | ${row.safetyPenalty ? `−${row.safetyPenalty}` : 'ok'} | **${row.total}** | ${row.notes.join('; ')} |`),
        '',
    ];
    if (board.tooCloseToCall) {
        lines.push(`**Too close to call:** the top two are within ${SCORING.tooClose} points. Consider crowning one and fusing the other's strengths (\`skillsmith arena fuse\`).`, '');
    }
    if (dead.length) {
        lines.push('Out of the game:', '', ...dead.map(([name, team]) => `- ${name} (${team.persona}): ${team.cause ? CAUSE_TEXT[team.cause] : 'eliminated'}`), '');
    }
    writeFileAtomic(recordPath(root, 'scoreboard.md'), lines.join('\n'));
}
