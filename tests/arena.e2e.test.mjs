// Full arena: three teams, one liar, one truthful accusation, one false
// accusation, a judge, a crown. Runs the real CLI against real git repos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cli, git, write, makeProject, commitAll, SERVER } from './helpers.mjs';

const PAGE = (extra = '') => `<!doctype html><html><body><h1>Order a cake</h1>
<form><input type="date" name="date"><input type="tel" name="phone" required>${extra}<button>Order</button></form></body></html>`;

const judgeFor = (teams) => ({
  judge: 'auditor',
  round: 1,
  scores: Object.fromEntries(
    teams.map(([team, s]) => [
      team,
      {
        fit: { score: s, evidence: 'Covers the order page, phone and confirmation from 01-brief.md.' },
        experience: { score: s, evidence: 'Opened index.html at 375px; form fits, labels readable.' },
        craft: { score: s, evidence: 'server.mjs is 3 lines; acceptance test passes in the clean room.' },
      },
    ]),
  ),
});

test('arena: liars die, honest losers retire, the winner is merged', async () => {
  const dir = makeProject();
  const init = cli(['arena', 'init'], { cwd: dir });
  assert.equal(init.code, 0, init.all);
  assert.match(init.out, /alpha \(Sprint\)/);
  assert.match(init.out, /gamma \(Spark\)/);
  const wt = (t) => path.join(dir, '.skillsmith', 'arena', t);
  const dossier = (t) => path.join(dir, '.skillsmith', 'teams', t);
  assert.ok(fs.existsSync(wt('alpha')));
  assert.ok(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').includes('.skillsmith/arena/'));

  // alpha: honest and complete, but without a contact phone link.
  write(wt('alpha'), 'index.html', PAGE());
  write(wt('alpha'), 'server.mjs', SERVER);
  commitAll(wt('alpha'), 'alpha: order page and server');
  write(dossier('alpha'), 'claims.json', {
    team: 'alpha',
    claims: [
      { id: 'C1', text: 'Every acceptance check passes', evidence: { type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4'] } },
      { id: 'C2', text: 'The form requires a phone number', evidence: { type: 'file_contains', path: 'index.html', pattern: 'type="tel" name="phone" required' } },
      { id: 'C3', text: 'Looks good on phones', evidence: { type: 'manual', note: 'Checked by eye at 375px.' } },
    ],
  });

  // beta: claims a test suite that does not exist.
  write(wt('beta'), 'index.html', PAGE());
  commitAll(wt('beta'), 'beta: order page');
  write(dossier('beta'), 'claims.json', {
    team: 'beta',
    claims: [{ id: 'C1', text: 'All our unit tests pass', evidence: { type: 'command', run: 'node tests/unit.test.mjs' } }],
  });

  // gamma: honest, and adds a contact link alpha lacks.
  write(wt('gamma'), 'index.html', PAGE('<a href="tel:+380000000000">Call Marta</a>'));
  write(wt('gamma'), 'server.mjs', SERVER);
  commitAll(wt('gamma'), 'gamma: order page with call link');
  write(dossier('gamma'), 'claims.json', {
    team: 'gamma',
    claims: [{ id: 'C1', text: 'Every acceptance check passes', evidence: { type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4'] } }],
  });

  // A private precheck shows beta's problem without killing anyone.
  const pre = cli(['arena', 'precheck', 'beta'], { cwd: dir });
  assert.equal(pre.code, 1);
  assert.match(pre.out, /\(precheck\) DEAD/);
  assert.ok(fs.existsSync(wt('beta')), 'precheck must not delete anything');

  const va = cli(['arena', 'verify', 'alpha'], { cwd: dir });
  assert.equal(va.code, 0, va.all);
  assert.match(va.out, /Acceptance 4\/4/);
  assert.match(va.out, /1 verified|2 verified/);

  const vb = cli(['arena', 'verify', 'beta'], { cwd: dir });
  assert.equal(vb.code, 1);
  assert.match(vb.out, /DEAD \(false-claim\)/);
  assert.ok(!fs.existsSync(wt('beta')), 'liar worktree is deleted');
  assert.throws(() => git(dir, 'rev-parse', '--verify', 'refs/heads/skillsmith/beta'), 'liar branch is deleted');
  const graveyard = fs.readFileSync(path.join(dir, '.skillsmith', 'graveyard.md'), 'utf8');
  assert.match(graveyard, /beta \(Fortress\)/);
  assert.match(graveyard, /All our unit tests pass/);

  const vg = cli(['arena', 'verify', 'gamma'], { cwd: dir });
  assert.equal(vg.code, 0, vg.all);

  // gamma proves a real defect in alpha: no tap-to-call link.
  write(path.join(dossier('gamma'), 'probes'), 'no-call-link.mjs', `import fs from 'node:fs';
if (fs.readFileSync('index.html', 'utf8').includes('href="tel:')) process.exit(1);
console.log('DEFECT: no tap-to-call link');
`);
  write(dossier('gamma'), 'accusations.json', {
    team: 'gamma',
    accusations: [
      {
        id: 'X1',
        against: 'alpha',
        text: 'Customers cannot tap to call Marta',
        evidence: { type: 'command', run: 'node "$SKILLSMITH_PROBES/no-call-link.mjs"', expect: { exit: 0, includes: 'DEFECT' } },
      },
    ],
  });
  const ag = cli(['arena', 'accuse', 'gamma'], { cwd: dir });
  assert.equal(ag.code, 0, ag.all);
  assert.match(ag.out, /upheld\s+X1 vs alpha/);

  // Dead teams can no longer be reached.
  write(dossier('alpha'), 'accusations.json', {
    team: 'alpha',
    accusations: [{ id: 'X1', against: 'beta', text: 'Beta has no server', evidence: { type: 'file_absent', path: 'server.mjs' } }],
  });
  const aa = cli(['arena', 'accuse', 'alpha'], { cwd: dir });
  assert.equal(aa.code, 0, aa.all);
  assert.match(aa.out, /dismissed\s+X1 vs beta/);

  // Crowning without the auditor is refused.
  const early = cli(['arena', 'crown'], { cwd: dir });
  assert.equal(early.code, 1);
  assert.match(early.err, /auditor/);

  write(path.join(dir, '.skillsmith'), 'judge.json', judgeFor([['alpha', 7], ['gamma', 8]]));
  const j = cli(['arena', 'judge'], { cwd: dir });
  assert.equal(j.code, 0, j.all);

  const s = cli(['arena', 'score', '--json'], { cwd: dir });
  const { rows } = JSON.parse(s.out);
  assert.deepEqual(rows.map((r) => r.team), ['gamma', 'alpha']);
  assert.equal(rows[0].crossPlus, 3);
  assert.equal(rows[1].crossMinus, 4);

  const crown = cli(['arena', 'crown'], { cwd: dir });
  assert.equal(crown.code, 0, crown.all);
  assert.match(crown.out, /gamma \(Spark\) wins/);
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Call Marta/);
  assert.equal(git(dir, 'rev-parse', '--verify', 'refs/heads/skillsmith/retired/alpha').length, 40);
  assert.equal(git(dir, 'status', '--porcelain'), '');

  const arena = JSON.parse(fs.readFileSync(path.join(dir, '.skillsmith', 'arena.json'), 'utf8'));
  assert.equal(arena.status, 'crowned');
  assert.equal(arena.teams.beta.status, 'dead');
  assert.equal(arena.teams.alpha.status, 'retired');

  // Ship: README + report, then the last gate.
  write(dir, 'README.md', '# Bakery orders\n\nRun `node server.mjs` and open http://127.0.0.1:4817\n');
  assert.equal(cli(['report'], { cwd: dir }).code, 0);
  const ship = cli(['advance', 'ship'], { cwd: dir });
  assert.equal(ship.code, 0, ship.all);
  assert.equal(cli(['dashboard'], { cwd: dir }).code, 0);
  const html = fs.readFileSync(path.join(dir, '.skillsmith', 'dashboard.html'), 'utf8');
  assert.match(html, /Graveyard/);
  assert.match(html, /team-dead/);
  assert.match(html, /team-crowned/);

  // The dead do not come back.
  const again = cli(['arena', 'init', '--teams', 'beta'], { cwd: dir });
  assert.equal(again.code, 1);
  assert.match(again.err, /graveyard/);
});

test('arena: tampering with a protected test kills the team', () => {
  const dir = makeProject();
  assert.equal(cli(['arena', 'init', '--count', '1'], { cwd: dir }).code, 0);
  const wt = path.join(dir, '.skillsmith', 'arena', 'alpha');
  write(wt, 'index.html', '<h1>nothing</h1>');
  write(wt, 'tests/acceptance/order.test.mjs', 'process.exit(0)\n');
  commitAll(wt, 'make the test pass the easy way');
  write(path.join(dir, '.skillsmith', 'teams', 'alpha'), 'claims.json', {
    claims: [{ id: 'C1', text: 'The acceptance test passes', evidence: { type: 'acceptance', ids: ['A3'] } }],
  });
  const v = cli(['arena', 'verify', 'alpha', '--no-setup'], { cwd: dir });
  assert.equal(v.code, 1);
  assert.match(v.out, /DEAD \(tampering\)/);
  assert.match(v.out, /tests\/acceptance\/order.test.mjs/);
  const arena = JSON.parse(fs.readFileSync(path.join(dir, '.skillsmith', 'arena.json'), 'utf8'));
  assert.equal(arena.status, 'wiped');
});

test('arena: an accusation the script cannot reproduce kills the accuser', () => {
  const dir = makeProject();
  assert.equal(cli(['arena', 'init', '--count', '2'], { cwd: dir }).code, 0);
  const wt = (t) => path.join(dir, '.skillsmith', 'arena', t);
  write(wt('alpha'), 'index.html', PAGE());
  commitAll(wt('alpha'), 'alpha');
  write(path.join(dir, '.skillsmith', 'teams', 'beta'), 'accusations.json', {
    accusations: [{ id: 'X1', against: 'alpha', text: 'Alpha has no phone field', evidence: { type: 'file_contains', path: 'index.html', pattern: 'no phone field here' } }],
  });
  const r = cli(['arena', 'accuse', 'beta', '--no-setup'], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /false\s+X1 vs alpha/);
  assert.match(r.out, /eliminated/);
  const arena = JSON.parse(fs.readFileSync(path.join(dir, '.skillsmith', 'arena.json'), 'utf8'));
  assert.equal(arena.teams.beta.status, 'dead');
  assert.equal(arena.teams.alpha.status, 'alive');
});
