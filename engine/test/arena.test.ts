/**
 * End to end: a founder's project goes through the arena in-process.
 * Four teams: alpha builds the full product, beta lies, gamma edits a
 * protected test, delta builds an honest but weaker version.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';
import {EXIT} from '../src/core/errors.js';
import {recordPath} from '../src/core/paths.js';
import {
  ACCEPTANCE_SCRIPT,
  acceptanceData,
  briefText,
  GOOD_APP,
  holdoutData,
  hooksText,
  researchText,
  screenplayText,
  sourcesData,
  WEAK_APP,
} from './fixtures.js';
import {commitAll, gitIn, sandbox, write, writeJsonFile, type Sandbox} from './helpers.js';

function readJsonFile(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

async function preparedProject(): Promise<Sandbox> {
  const box = sandbox();
  const init = await box.cli(['init', '--name', 'TrialGuard']);
  assert.equal(init.code, EXIT.ok, init.err);
  write(recordPath(box.dir, '01-brief.md'), briefText());
  write(recordPath(box.dir, '02-research.md'), researchText());
  writeJsonFile(recordPath(box.dir, '02-sources.json'), sourcesData());
  write(recordPath(box.dir, '03-hooks.md'), hooksText());
  write(recordPath(box.dir, '04-screenplay.md'), screenplayText());
  writeJsonFile(recordPath(box.dir, '04-acceptance.json'), acceptanceData());
  write(path.join(box.dir, 'tests', 'acceptance', 'add.mjs'), ACCEPTANCE_SCRIPT);
  write(path.join(box.dir, 'README.md'), '# TrialGuard\n');
  commitAll(box.dir, 'Add acceptance tests');
  return box;
}

function teamDir(box: Sandbox, team: string): string {
  return path.join(box.dir, '.skillsmith', 'arena', team);
}

function build(box: Sandbox, team: string, app: string, readme: string): void {
  const dir = teamDir(box, team);
  write(path.join(dir, 'app.mjs'), app);
  write(path.join(dir, 'README.md'), readme);
  commitAll(dir, `${team}: build`);
}

function fileClaims(box: Sandbox, team: string, claims: unknown[]): void {
  writeJsonFile(recordPath(box.dir, 'teams', team, 'claims.json'), {
    team,
    claims,
    known_issues: [],
  });
}

describe('arena end to end', () => {
  it('runs the line from interview to crown, with deaths, hidden checks and fusion', async () => {
    const box = await preparedProject();

    for (const station of ['interview', 'research', 'hooks'] as const) {
      const result = await box.cli(['advance', station]);
      assert.equal(result.code, EXIT.ok, `${station}: ${result.out}`);
    }
    const early = await box.cli(['advance', 'screenplay']);
    assert.equal(early.code, EXIT.failed);
    assert.match(early.out, /04-vacuity.json does not exist/);

    const vacuity = await box.cli(['acceptance', 'vacuity']);
    assert.equal(vacuity.code, EXIT.ok, vacuity.out + vacuity.err);
    assert.match(vacuity.out, /Every check can fail/);
    const trace = await box.cli(['acceptance', 'trace']);
    assert.equal(trace.code, EXIT.ok);
    assert.match(trace.out, /Coverage: 100%/);
    assert.equal((await box.cli(['advance', 'screenplay'])).code, EXIT.ok);

    writeJsonFile(recordPath(box.dir, 'holdout.json'), holdoutData());
    const seal = await box.cli(['holdout', 'seal']);
    assert.equal(seal.code, EXIT.ok, seal.err);
    assert.equal(fs.existsSync(recordPath(box.dir, 'holdout.json')), false);
    assert.match((await box.cli(['holdout', 'status'])).out, /1 hidden check/);

    const opened = await box.cli(['arena', 'init', '--teams', 'alpha,beta,gamma,delta']);
    assert.equal(opened.code, EXIT.ok, opened.err);
    assert.match(opened.out, /1 hidden check/);
    assert.ok(fs.existsSync(recordPath(box.dir, 'teams', 'alpha', 'orders.md')));
    assert.equal((await box.cli(['arena', 'init'])).code, EXIT.failed);

    build(box, 'alpha', GOOD_APP, 'Run: node app.mjs headline\n');
    fileClaims(box, 'alpha', [
      {
        id: 'C1',
        text: 'Every acceptance check passes',
        evidence: {type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4']},
      },
      {
        id: 'C2',
        text: 'Past dates are rejected',
        evidence: {
          type: 'command',
          run: 'node app.mjs add Old 2020-01-01',
          expect: {exit: 1, includes: 'rejected'},
        },
      },
    ]);
    build(box, 'beta', WEAK_APP, 'Run: node app.mjs\n');
    fileClaims(box, 'beta', [
      {
        id: 'C1',
        text: 'Past dates are rejected',
        evidence: {
          type: 'command',
          run: 'node app.mjs add Old 2020-01-01',
          expect: {includes: 'rejected'},
        },
      },
    ]);
    build(box, 'gamma', WEAK_APP, 'Run: node app.mjs\n');
    write(
      path.join(teamDir(box, 'gamma'), 'tests', 'acceptance', 'add.mjs'),
      'console.log("listed: Netflix")',
    );
    commitAll(teamDir(box, 'gamma'), 'gamma: make the test pass');
    fileClaims(box, 'gamma', [
      {id: 'C1', text: 'Acceptance passes', evidence: {type: 'acceptance', ids: ['A1']}},
    ]);
    build(box, 'delta', WEAK_APP, 'Run: node app.mjs headline\n');
    fileClaims(box, 'delta', [
      {id: 'C1', text: 'The headline is shown', evidence: {type: 'acceptance', ids: ['A2']}},
    ]);

    const precheck = await box.cli(['arena', 'precheck', 'beta', '--json']);
    assert.equal(precheck.code, EXIT.failed);
    const pre = JSON.parse(precheck.out) as {outcome: string; holdout: {ran: boolean}};
    assert.equal(pre.outcome, 'dead');
    assert.equal(pre.holdout.ran, false, 'prechecks never run hidden checks');
    assert.ok(fs.existsSync(teamDir(box, 'beta')), 'a precheck kills nobody');

    const verify = await box.cli(['arena', 'verify', '--all']);
    assert.equal(verify.code, EXIT.failed);
    assert.match(verify.out, /Hidden checks 1\/1/);
    assert.match(verify.out, /DEAD \(false-claim\)/);
    assert.match(verify.out, /DEAD \(tampering\)/);
    const arena = readJsonFile(recordPath(box.dir, 'arena.json')) as {
      teams: Record<string, {status: string}>;
    };
    assert.deepEqual(
      Object.fromEntries(Object.entries(arena.teams).map(([name, team]) => [name, team.status])),
      {alpha: 'alive', beta: 'dead', gamma: 'dead', delta: 'alive'},
    );
    assert.equal(fs.existsSync(teamDir(box, 'beta')), false);
    assert.throws(() => gitIn(box.dir, 'rev-parse', '--verify', 'refs/heads/skillsmith/beta'));
    assert.match(
      fs.readFileSync(recordPath(box.dir, 'graveyard.md'), 'utf8'),
      /changed protected file `tests\/acceptance\/add.mjs`/,
    );
    const deltaVerdict = readJsonFile(recordPath(box.dir, 'teams', 'delta', 'verdict.json')) as {
      holdout: {passed: number; results: Array<Record<string, unknown>>};
    };
    assert.equal(deltaVerdict.holdout.passed, 0);
    assert.equal(
      deltaVerdict.holdout.results[0]?.['detail'],
      undefined,
      'hidden check details never reach the builders',
    );

    const probes = recordPath(box.dir, 'teams', 'alpha', 'probes');
    write(
      path.join(probes, 'past.mjs'),
      `import {spawnSync} from 'node:child_process';
const r = spawnSync(process.execPath, ['app.mjs', 'add', 'Old', '2020-01-01'], {encoding: 'utf8'});
console.log(r.stdout.includes('listed') ? 'DEFECT: past date accepted' : 'fine');`,
    );
    writeJsonFile(recordPath(box.dir, 'teams', 'alpha', 'accusations.json'), {
      accusations: [
        {
          id: 'X1',
          against: 'delta',
          text: 'Delta accepts a past end date',
          evidence: {
            type: 'command',
            run: 'node "$SKILLSMITH_PROBES/past.mjs"',
            expect: {includes: 'DEFECT'},
          },
        },
      ],
    });
    const dry = await box.cli(['arena', 'accuse', 'alpha', '--dry-run']);
    assert.equal(dry.code, EXIT.ok, dry.err);
    assert.match(dry.out, /Dry run/);
    const accused = await box.cli(['arena', 'accuse', 'alpha']);
    assert.equal(accused.code, EXIT.ok, accused.err);
    assert.match(accused.out, /upheld/);

    const unscored = await box.cli(['arena', 'crown']);
    assert.equal(unscored.code, EXIT.failed);
    assert.match(unscored.err, /auditor has not scored/);
    const evidence = 'Ran node app.mjs add in the clean room and read app.mjs line by line';
    writeJsonFile(recordPath(box.dir, 'judge.json'), {
      scores: {
        alpha: {
          fit: {score: 8, evidence},
          experience: {score: 7, evidence},
          craft: {score: 8, evidence},
        },
        delta: {
          fit: {score: 5, evidence},
          experience: {score: 6, evidence},
          craft: {score: 4, evidence},
        },
      },
    });
    assert.equal((await box.cli(['arena', 'judge'])).code, EXIT.ok);
    const score = await box.cli(['arena', 'score', '--json']);
    const board = JSON.parse(score.out) as {
      rows: Array<{
        team: string;
        holdoutPts: number;
        crossPlus: number;
        crossMinus: number;
        eligible: boolean;
      }>;
    };
    assert.equal(board.rows[0]?.team, 'alpha');
    assert.equal(board.rows[0]?.holdoutPts, 20);
    assert.equal(board.rows[0]?.crossPlus, 3);
    assert.equal(board.rows[1]?.crossMinus, 4);
    assert.equal(board.rows[0]?.eligible, true);

    const verdictPath = recordPath(box.dir, 'teams', 'delta', 'verdict.json');
    const original = fs.readFileSync(verdictPath, 'utf8');
    const forged = JSON.parse(original) as {acceptance: {weightPassed: number}};
    forged.acceptance.weightPassed = 99;
    fs.writeFileSync(verdictPath, JSON.stringify(forged, null, 2));
    const tampered = await box.cli(['arena', 'score']);
    assert.equal(tampered.code, EXIT.integrity);
    assert.match(tampered.err, /changed after Skillsmith wrote it/);
    fs.writeFileSync(verdictPath, original);

    const crowned = await box.cli(['arena', 'crown']);
    assert.equal(crowned.code, EXIT.ok, crowned.err);
    assert.match(crowned.out, /alpha \(Sprint\) wins/);
    assert.equal(fs.readFileSync(path.join(box.dir, 'app.mjs'), 'utf8'), GOOD_APP);
    assert.ok(gitIn(box.dir, 'branch', '--list', 'skillsmith/retired/delta'));

    const fused = await box.cli(['arena', 'fuse', '--from', 'delta']);
    assert.equal(fused.code, EXIT.ok, fused.err + fused.out);
    assert.match(fused.out, /Fusion kept/);

    const ledger = await box.cli(['ledger', 'verify']);
    assert.equal(ledger.code, EXIT.ok, ledger.out);
    assert.match((await box.cli(['ledger', 'show'])).out, /crown/);

    assert.equal((await box.cli(['report'])).code, EXIT.ok);
    assert.match(
      fs.readFileSync(recordPath(box.dir, 'REPORT.md'), 'utf8'),
      /\*\*Winner:\*\* alpha/,
    );
    assert.equal((await box.cli(['dashboard'])).code, EXIT.ok);
    const html = fs.readFileSync(recordPath(box.dir, 'dashboard.html'), 'utf8');
    assert.match(html, /Winner/);
    assert.match(html, /Hidden checks/);
    assert.match(html, /intact/);
    assert.equal((await box.cli(['advance', 'arena'])).code, EXIT.ok);
    assert.equal((await box.cli(['advance', 'ship'])).code, EXIT.ok);
    assert.match((await box.cli(['status'])).out, /All stations are done/);

    const ledgerFile = recordPath(box.dir, 'ledger.jsonl');
    fs.writeFileSync(
      ledgerFile,
      fs.readFileSync(ledgerFile, 'utf8').replace('"TrialGuard"', '"Other"'),
    );
    assert.equal((await box.cli(['ledger', 'verify'])).code, EXIT.integrity);
  });

  it('eliminates a team that accuses without proof', async () => {
    const box = await preparedProject();
    assert.equal(
      (await box.cli(['arena', 'init', '--teams', 'alpha,beta', '--force'])).code,
      EXIT.ok,
    );
    build(box, 'alpha', GOOD_APP, 'Run: node app.mjs\n');
    writeJsonFile(recordPath(box.dir, 'teams', 'beta', 'accusations.json'), {
      accusations: [
        {
          id: 'X1',
          against: 'alpha',
          text: 'Alpha has no headline',
          evidence: {
            type: 'command',
            run: 'node app.mjs headline',
            expect: {excludes: 'Never pay'},
          },
        },
      ],
    });
    const result = await box.cli(['arena', 'accuse', 'beta']);
    assert.equal(result.code, EXIT.failed);
    assert.match(result.out, /accused without proof/);
    const arena = readJsonFile(recordPath(box.dir, 'arena.json')) as {
      teams: Record<string, {status: string; cause?: string}>;
    };
    assert.equal(arena.teams['beta']?.status, 'dead');
    assert.equal(arena.teams['beta']?.cause, 'false-accusation');
    assert.equal(
      (await box.cli(['arena', 'eliminate', 'alpha', '--reason', 'Founder stopped the project']))
        .code,
      EXIT.ok,
    );
    const wiped = readJsonFile(recordPath(box.dir, 'arena.json'));
    assert.equal(wiped['status'], 'wiped');
    const again = await box.cli(['arena', 'init', '--teams', 'beta', '--force']);
    assert.equal(again.code, EXIT.failed);
    assert.match(again.err, /graveyard/);
  });

  it('refuses vacuous checks and uncommitted tests', async () => {
    const box = sandbox();
    await box.cli(['init']);
    const data = acceptanceData();
    data['checks'] = [
      {id: 'A1', title: 'README exists', covers: ['R1'], type: 'file_exists', path: 'README.md'},
      {id: 'A2', title: 'App exists', covers: ['R2'], type: 'file_exists', path: 'app.mjs'},
      {
        id: 'A3',
        title: 'Test exists',
        covers: ['R3'],
        type: 'file_exists',
        path: 'tests/acceptance/add.mjs',
      },
    ];
    writeJsonFile(recordPath(box.dir, '04-acceptance.json'), data);
    const noCommit = await box.cli(['acceptance', 'vacuity']);
    assert.equal(noCommit.code, EXIT.failed);
    assert.match(noCommit.err, /at least one commit/);
    write(path.join(box.dir, 'README.md'), '# x');
    commitAll(box.dir, 'start');
    write(path.join(box.dir, 'tests', 'acceptance', 'add.mjs'), '');
    const dirty = await box.cli(['acceptance', 'vacuity']);
    assert.equal(dirty.code, EXIT.failed);
    assert.match(dirty.err, /not committed/);
    commitAll(box.dir, 'tests');
    const vacuous = await box.cli(['acceptance', 'vacuity']);
    assert.equal(vacuous.code, EXIT.failed);
    assert.match(vacuous.out, /Vacuous: A1, A3/);
  });
});
