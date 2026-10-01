/** Gathers everything the report and the dashboard show. */
import {errorMessage} from '../../core/errors.js';
import {readJson, readText} from '../../core/fs.js';
import {verifyLedger, type LedgerCheck} from '../../core/ledger.js';
import {recordPath} from '../../core/paths.js';
import {loadGraveyard, type Graveyard} from '../arena/graveyard.js';
import {loadArena, teamPaths, type Arena, type Verdict} from '../arena/model.js';
import {computeScore, type Scoreboard} from '../arena/score.js';
import {oneSentence} from '../brief.js';
import {driftedOutputs, type Project} from '../project.js';

/** Inputs for REPORT.md and dashboard.html. */
export interface ReportData {
  project: Project;
  arena: Arena | undefined;
  board: Scoreboard | undefined;
  /** Set when scoring refused a record that failed the integrity check. */
  integrityProblem: string | undefined;
  verdicts: Record<string, Verdict | undefined>;
  graveyard: Graveyard;
  summary: string;
  ledger: LedgerCheck;
  drift: string[];
}

/** Collects report data. Never throws for damaged records; it reports them. */
export function collectReport(project: Project): ReportData {
  const {root} = project;
  const arena = loadArena(root);
  let board: Scoreboard | undefined;
  let integrityProblem: string | undefined;
  if (arena) {
    try {
      board = computeScore(project);
    } catch (error: unknown) {
      integrityProblem = errorMessage(error);
    }
  }
  const verdicts: Record<string, Verdict | undefined> = {};
  for (const name of Object.keys(arena?.teams ?? {})) {
    verdicts[name] = readJson(teamPaths(root, name).verdict, {optional: true}) as
      Verdict | undefined;
  }
  const brief = readText(recordPath(root, '01-brief.md'), {optional: true});
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
