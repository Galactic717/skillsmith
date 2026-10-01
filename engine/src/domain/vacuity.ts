/**
 * Vacuity check: "Will the tests actually fail when the code is broken?"
 * (Google code review guide). Every acceptance check that is not a guard is
 * run on the project before anyone builds anything. A check that already
 * passes there proves nothing, and the screenplay gate rejects it.
 */
import {SkillsmithError} from '../core/errors.js';
import {readJson, writeJson} from '../core/fs.js';
import {dirtyPaths, git, isRepo, revParse} from '../core/git.js';
import {matchAny} from '../core/glob.js';
import {isRecord} from '../core/json.js';
import {appendLedger, fileHash, latestEntry} from '../core/ledger.js';
import {RECORDS_DIR, recordPath} from '../core/paths.js';
import {nowIso} from '../core/text.js';
import {parseAcceptance} from './acceptance.js';
import {runCheck, type CheckStatus} from './checks.js';
import {runSetup, withCleanroom} from './arena/cleanroom.js';
import type {SetupRow} from './arena/model.js';
import type {Project} from './project.js';

/** File name of the vacuity report in `.skillsmith/`. */
export const VACUITY_FILE = '04-vacuity.json';

/** Contents of 04-vacuity.json. */
export interface VacuityReport {
  version: 2;
  at: string;
  commit: string;
  acceptanceHash: string;
  setup: SetupRow[];
  results: Array<{id: string; title: string; guard: boolean; status: CheckStatus}>;
  /** Non-guard checks that passed on the empty project. */
  vacuous: string[];
  ok: boolean;
}

/** Runs every acceptance check on the current commit and records the result. */
export async function runVacuity(project: Project): Promise<VacuityReport> {
  const {root, store} = project;
  const acceptancePath = recordPath(root, '04-acceptance.json');
  const {file, errors} = parseAcceptance(readJson(acceptancePath));
  if (!file) throw new SkillsmithError(`04-acceptance.json is invalid:\n- ${errors.join('\n- ')}`);
  if (!isRepo(root) || !git(['rev-parse', '--verify', 'HEAD'], root, true).ok) {
    throw new SkillsmithError(
      'The vacuity check needs a git repository with at least one commit.',
      {
        hint: 'Commit the acceptance tests: git add -A && git commit -m "Add acceptance tests"',
      },
    );
  }
  const uncommitted = dirtyPaths(root).filter(
    item => !item.startsWith(`${RECORDS_DIR}/`) && matchAny(item, file.protected),
  );
  if (uncommitted.length) {
    throw new SkillsmithError(
      `Acceptance test files are not committed:\n${uncommitted.join('\n')}`,
      {
        hint: 'Commit them first, so the check runs on exactly what the teams will get.',
      },
    );
  }
  const commit = revParse(root, 'HEAD');
  const {setup, results} = await withCleanroom(
    root,
    store,
    'vacuity',
    commit,
    async (dir, port) => {
      const setupRows = await runSetup(file.setup, dir, port);
      const rows: VacuityReport['results'] = [];
      for (const check of file.checks) {
        const outcome = await runCheck(check, {dir, port});
        rows.push({id: check.id, title: check.title, guard: check.guard, status: outcome.status});
      }
      return {setup: setupRows, results: rows};
    },
  );
  const vacuous = results.filter(row => !row.guard && row.status === 'pass').map(row => row.id);
  const report: VacuityReport = {
    version: 2,
    at: nowIso(),
    commit,
    acceptanceHash: fileHash(acceptancePath) ?? '',
    setup,
    results,
    vacuous,
    ok: vacuous.length === 0,
  };
  const reportPath = recordPath(root, VACUITY_FILE);
  writeJson(reportPath, report);
  appendLedger(root, store, 'vacuity', {
    hash: fileHash(reportPath) ?? '',
    acceptanceHash: report.acceptanceHash,
    commit,
    ok: report.ok,
  });
  return report;
}

/**
 * Gate findings about the vacuity report in `dir`. When `root` is given the
 * report must also match the ledger, so a hand-written report is rejected.
 */
export function vacuityFindings(dir: string, root?: string): string[] {
  const reportPath = `${dir}/${VACUITY_FILE}`;
  const value = readJson(reportPath, {optional: true});
  if (value === undefined) {
    return ['04-vacuity.json does not exist yet: run `skillsmith acceptance vacuity`'];
  }
  if (!isRecord(value))
    return ['04-vacuity.json is damaged: run `skillsmith acceptance vacuity` again'];
  const errors: string[] = [];
  if (value['acceptanceHash'] !== fileHash(`${dir}/04-acceptance.json`)) {
    errors.push(
      '04-acceptance.json changed after the vacuity check: run `skillsmith acceptance vacuity` again',
    );
  }
  const vacuous = Array.isArray(value['vacuous'])
    ? (value['vacuous'] as unknown[]).map(String)
    : [];
  if (vacuous.length) {
    errors.push(
      `these checks already pass before anything is built, so they prove nothing: ${vacuous.join(', ')} (make them stricter, or mark a true regression guard with "guard": true)`,
    );
  }
  if (root) {
    const entry = latestEntry(root, 'vacuity');
    if (!entry || entry.data['hash'] !== fileHash(reportPath)) {
      errors.push(
        '04-vacuity.json was not written by `skillsmith acceptance vacuity` (or was edited afterwards)',
      );
    }
  }
  return errors;
}
