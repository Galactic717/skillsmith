/** Gathers everything the report and the dashboard show. */
import { errorMessage } from '../../core/errors.js';
import { readJson, readText } from '../../core/fs.js';
import { verifyLedger } from '../../core/ledger.js';
import { recordPath } from '../../core/paths.js';
import { loadGraveyard } from '../arena/graveyard.js';
import { loadArena, teamPaths } from '../arena/model.js';
import { computeScore } from '../arena/score.js';
import { oneSentence } from '../brief.js';
import { driftedOutputs } from '../project.js';
/** Collects report data. Never throws for damaged records; it reports them. */
export function collectReport(project) {
    const { root } = project;
    const arena = loadArena(root);
    let board;
    let integrityProblem;
    if (arena) {
        try {
            board = computeScore(project);
        }
        catch (error) {
            integrityProblem = errorMessage(error);
        }
    }
    const verdicts = {};
    for (const name of Object.keys(arena?.teams ?? {})) {
        verdicts[name] = readJson(teamPaths(root, name).verdict, { optional: true });
    }
    const brief = readText(recordPath(root, '01-brief.md'), { optional: true });
    return {
        project,
        arena,
        board,
        integrityProblem,
        verdicts,
        graveyard: loadGraveyard(root),
        summary: brief ? oneSentence(brief) : '',
        ledger: verifyLedger(root, project.store),
        drift: driftedOutputs(project),
    };
}
