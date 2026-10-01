#!/usr/bin/env node
// Runs the real production line on the TrialGuard example and leaves the
// project on disk. The dashboard and the terminal lines in the videos come
// from this run.
//   node scripts/demo-arena.mjs [--out DIR]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'plugins', 'skillsmith', 'engine', 'skillsmith.js');
const EXAMPLE = path.join(ROOT, 'examples', 'trialguard');
const args = process.argv.slice(2);
const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : undefined;

const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trialguard-')));
const env = {
  ...process.env,
  SKILLSMITH_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'skillsmith-home-')),
  SKILLSMITH_OFFLINE: '1',
  NO_COLOR: '1',
};

function skillsmith(...argv) {
  const result = spawnSync(process.execPath, [ENGINE, ...argv], {cwd: dir, env, encoding: 'utf8'});
  process.stdout.write(`\n$ skillsmith ${argv.join(' ')}\n${result.stdout}${result.stderr}`);
  return result.status;
}

function git(cwd, ...argv) {
  const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...argv], {cwd, encoding: 'utf8'});
  if (result.status !== 0) throw new Error(`git ${argv.join(' ')}: ${result.stderr}`);
}

function write(base, file, content) {
  const target = path.join(base, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(
    target,
    typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`,
  );
}

function copy(file, to = `.skillsmith/${file}`) {
  write(dir, to, fs.readFileSync(path.join(EXAMPLE, file), 'utf8'));
}

function commit(cwd, message) {
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
}

// Stations 1 to 4, through the real gates.
skillsmith('init', '--name', 'TrialGuard');
copy('01-brief.md');
skillsmith('advance', 'interview');
skillsmith(
  'advance',
  'research',
  '--skip',
  'Demo run: research sources must be real and checked, so this example skips them',
);
copy('03-hooks.md');
skillsmith('advance', 'hooks');
copy('04-screenplay.md');
copy('04-acceptance.json');
copy('tests/acceptance/add-trial.mjs', 'tests/acceptance/add-trial.mjs');
write(dir, 'README.md', '# TrialGuard\n');
commit(dir, 'Add acceptance checks');
skillsmith('acceptance', 'vacuity');
skillsmith('advance', 'screenplay');
copy('holdout.json');
skillsmith('holdout', 'seal');

// Station 5: the arena.
skillsmith('arena', 'init', '--count', '3');
const worktree = team => path.join(dir, '.skillsmith', 'arena', team);
const dossier = team => path.join(dir, '.skillsmith', 'teams', team);

const page = style => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TrialGuard</title><style>${style}</style></head>
<body><main><h1>Never pay for a forgotten trial</h1>
<form><label>Trial <input name="name" required></label><label>Ends on <input type="date" name="endsOn" required></label><button>Add trial</button></form>
<p>No trials yet. Add the one you started today.</p></main></body></html>
`;
const server = `import http from 'node:http';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('./index.html', import.meta.url));
http.createServer((req, res) => res.writeHead(200, {'content-type': 'text/html'}).end(html))
  .listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
`;
const sortOnly = `export function addTrial(list, trial) {
  return [...list, trial].sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}
`;
const validated = `/** Adds a trial and returns a new list sorted by end date. */
export function addTrial(list, {name, endsOn}) {
  if (!name || !name.trim()) throw new Error('Give the trial a name.');
  const end = new Date(endsOn);
  if (Number.isNaN(end.getTime())) throw new Error('Pick a real end date.');
  if (end < new Date(new Date().toDateString())) throw new Error('That end date has already passed.');
  return [...list, {name: name.trim(), endsOn}].sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}
`;
const readme = '# TrialGuard\n\nStart it with `node server.mjs`, then open http://127.0.0.1:3000\n';

// Sprint: small and complete, but no input validation.
write(worktree('alpha'), 'src/trials.mjs', sortOnly);
write(worktree('alpha'), 'server.mjs', server);
write(worktree('alpha'), 'index.html', page('body{font-family:system-ui;margin:2rem}'));
write(worktree('alpha'), 'README.md', readme);
commit(worktree('alpha'), 'Add the trial list, home page and README');
write(dossier('alpha'), 'claims.json', {
  team: 'alpha',
  claims: [
    {
      id: 'C1',
      text: 'Every acceptance check passes',
      evidence: {type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4']},
    },
    {
      id: 'C2',
      text: 'Fits a 375px phone screen',
      evidence: {type: 'manual', note: 'Checked by eye.'},
    },
  ],
  known_issues: ['No input validation yet.'],
});

// Fortress: validated, tested.
write(worktree('beta'), 'src/trials.mjs', validated);
write(worktree('beta'), 'server.mjs', server);
write(
  worktree('beta'),
  'index.html',
  page(
    'body{font-family:system-ui;margin:2rem;max-width:36rem}label{display:block;margin:.5rem 0}',
  ),
);
write(worktree('beta'), 'README.md', readme);
write(
  worktree('beta'),
  'tests/trials.test.mjs',
  `import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addTrial} from '../src/trials.mjs';
test('sorts by end date', () => assert.deepEqual(addTrial([{name: 'B', endsOn: '2099-02-01'}], {name: 'A', endsOn: '2099-01-01'}).map(t => t.name), ['A', 'B']));
test('rejects a past end date', () => assert.throws(() => addTrial([], {name: 'Old', endsOn: '2001-01-01'})));
test('rejects an empty name', () => assert.throws(() => addTrial([], {name: ' ', endsOn: '2099-01-01'})));
`,
);
commit(worktree('beta'), 'Add a validated trial list with tests');
write(dossier('beta'), 'claims.json', {
  team: 'beta',
  claims: [
    {
      id: 'C1',
      text: 'Every acceptance check passes',
      evidence: {type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4']},
    },
    {
      id: 'C2',
      text: 'Our own tests pass',
      evidence: {type: 'command', run: 'node --test tests/trials.test.mjs'},
    },
    {
      id: 'C3',
      text: 'A trial that already ended is rejected',
      evidence: {type: 'file_contains', path: 'src/trials.mjs', pattern: 'already passed'},
    },
  ],
  known_issues: [],
});

// Spark: a bold page and a claim nobody ran.
write(worktree('gamma'), 'src/trials.mjs', sortOnly);
write(worktree('gamma'), 'server.mjs', server);
write(
  worktree('gamma'),
  'index.html',
  page(
    'body{background:linear-gradient(135deg,#ff6ec4,#7873f5);color:#fff;font-family:system-ui;margin:2rem}',
  ),
);
write(worktree('gamma'), 'README.md', readme);
commit(worktree('gamma'), 'Add a bold home page');
write(dossier('gamma'), 'claims.json', {
  team: 'gamma',
  claims: [
    {
      id: 'C1',
      text: 'Every acceptance check passes',
      evidence: {type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4']},
    },
    {
      id: 'C2',
      text: 'All our unit tests pass',
      evidence: {type: 'command', run: 'node --test tests/trials.test.mjs'},
    },
  ],
});

skillsmith('arena', 'verify', '--all');

// Cross-examination: Fortress proves Sprint accepts a trial that already ended.
write(
  path.join(dossier('beta'), 'probes'),
  'past-date.mjs',
  `const {addTrial} = await import(new URL('src/trials.mjs', 'file://' + process.cwd() + '/').href);
try { addTrial([], {name: 'Old', endsOn: '2001-01-01'}); console.log('DEFECT: a trial that already ended was accepted'); }
catch { console.log('rejected'); process.exit(1); }
`,
);
write(dossier('beta'), 'accusations.json', {
  team: 'beta',
  accusations: [
    {
      id: 'X1',
      against: 'alpha',
      text: 'Sprint accepts a trial that already ended',
      evidence: {
        type: 'command',
        run: 'node "$SKILLSMITH_PROBES/past-date.mjs"',
        expect: {includes: 'DEFECT'},
      },
    },
  ],
});
skillsmith('arena', 'accuse', 'beta');

write(path.join(dir, '.skillsmith'), 'judge.json', {
  judge: 'auditor',
  round: 1,
  scores: {
    alpha: {
      fit: {
        score: 6,
        evidence:
          'R1-R3 work (A1-A4 pass), but a past end date is accepted: hidden check H1 failed and X1 was upheld.',
      },
      experience: {
        score: 7,
        evidence:
          'Added Netflix as Sam on a 375px screen in 3 taps; no message when a date is wrong.',
      },
      craft: {score: 5, evidence: 'No tests of its own; src/trials.mjs has no validation at all.'},
    },
    beta: {
      fit: {
        score: 9,
        evidence: 'R1-R3 work; past dates and empty names are rejected (hidden H1 and H2 pass).',
      },
      experience: {
        score: 8,
        evidence: 'Clear labels; the error copy from 03-hooks.md appears for a past date.',
      },
      craft: {
        score: 9,
        evidence: 'tests/trials.test.mjs covers sorting and both validations; node --test passes.',
      },
    },
  },
});
skillsmith('arena', 'judge');
skillsmith('arena', 'score');
skillsmith('arena', 'crown');
skillsmith('ledger', 'verify');
skillsmith('report');
skillsmith('advance', 'ship');
skillsmith('dashboard');

let final = dir;
if (out) {
  fs.rmSync(out, {recursive: true, force: true});
  fs.cpSync(dir, out, {recursive: true});
  final = out;
}
process.stdout.write(
  `\nDemo project: ${final}\nDashboard: ${path.join(final, '.skillsmith', 'dashboard.html')}\n`,
);
