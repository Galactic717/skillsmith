// Builds throwaway Skillsmith projects for tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = path.join(REPO, 'plugins', 'skillsmith', 'scripts', 'skillsmith.mjs');

export function tmpDir(prefix = 'skillsmith-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cli(args, { cwd, input } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input, env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, out: r.stdout, err: r.stderr, all: `${r.stdout}\n${r.stderr}` };
}

export function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

export function write(dir, rel, content) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
}

export const PORT = 4817;

const BRIEF = `# Brief: Bakery orders

Status: confirmed
Client language: English

<!-- ss:summary -->
## One sentence
A web page where regular customers of Marta's bakery order a cake for a date and leave a phone number, so orders stop getting lost in direct messages.

<!-- ss:audience -->
## Who it is for
About two hundred regular customers a month, mostly ordering birthday cakes from their phones, plus Marta who reads the orders each morning.

<!-- ss:pain -->
## What hurts today
Orders arrive in Instagram messages and get buried. Marta forgets two or three a month and has to apologise.

<!-- ss:done -->
## What done looks like
A customer opens the page, picks a cake and a date, types a phone number and sees a clear confirmation.

<!-- ss:scope -->
## Scope
Must have: order page, phone number, confirmation. Later: payments. Not doing: delivery tracking.

<!-- ss:platform -->
## Where
A website that works on phones.

<!-- ss:look -->
## Look
Warm, simple, honest.

<!-- ss:limits -->
## Limits
No budget for paid services. Marta maintains nothing technical herself.

<!-- ss:data -->
## Data
Phone numbers only. They must never be shown to other customers.

<!-- ss:launch -->
## Launch
The bakery's Instagram profile link.

<!-- ss:risks -->
## Risks
Customers may type the phone number wrongly.

<!-- ss:assumptions -->
## Assumptions
- A1. Orders can be read from a simple list for now.
`;

const RESEARCH = `# Research: Bakery orders

<!-- ss:competitors -->
## Competitors
Instagram direct messages are the competitor today [S1].

<!-- ss:audience -->
## Audience
Regular customers order from phones [S2].

<!-- ss:trends -->
## Trends
Small shops move orders to simple forms [S3].

<!-- ss:niches -->
## Niches
Tiny bakeries without a developer [S4].

<!-- ss:repos -->
## Repositories
Plain HTML is enough [S5].

<!-- ss:implications -->
## Implications
Keep it one page.

<!-- ss:rejected -->
## Rejected
- A blog statistic without a source.
`;

const sources = {
  version: 1,
  sources: [1, 2, 3, 4, 5].map((n) => ({
    id: `S${n}`,
    title: `Source ${n}`,
    url: `https://example.com/source-${n}`,
    accessed: '2026-10-01',
    quote: `Exact quoted sentence number ${n} from the page.`,
    claim: `Claim ${n}`,
    status: 'verified',
  })),
  rejected: [],
};

const HOOKS = `# Hooks: Bakery orders

<!-- ss:platform -->
## Platform
Instagram profile link.

<!-- ss:oneliner -->
## One line
Order your cake in a minute.

<!-- ss:hooks -->
## Hooks
1. "Your cake order, never lost in a chat again." [P]
2. "Two hundred regulars, one page." [S2]

<!-- ss:launch-post -->
## Launch post
We made a page for cake orders. Pick a date, leave your phone, done.

<!-- ss:kill-list -->
## Kill list
<!-- ss:slop-ignore -->
- "Revolutionize your cake experience": empty.
<!-- /ss:slop-ignore -->
`;

const SCREENPLAY = `# Screenplay: Bakery orders

<!-- ss:logline -->
## Logline
Marta stops losing orders.

<!-- ss:cast -->
## Cast
Marta and her customers.

<!-- ss:world -->
## World
One HTML page and a tiny Node server.

<!-- ss:act1 -->
## Act I
### Scene 1.1: Order page
Acceptance: A1, A2

<!-- ss:act2 -->
## Act II
### Scene 2.1: Server
Acceptance: A3, A4

<!-- ss:act3 -->
## Act III
### Scene 3.1: Polish
Acceptance: A1

<!-- ss:acceptance -->
## Acceptance
See 04-acceptance.json.
`;

export const ACCEPTANCE = {
  version: 1,
  setup: [],
  protected: ['tests/acceptance/**'],
  checks: [
    { id: 'A1', title: 'Order page exists', type: 'file_exists', path: 'index.html' },
    { id: 'A2', title: 'Order page asks for a phone number', type: 'file_contains', path: 'index.html', pattern: 'type="tel"' },
    { id: 'A3', title: 'Acceptance test passes', type: 'command', run: 'node tests/acceptance/order.test.mjs', expect: { exit: 0 } },
    { id: 'A4', title: 'Server shows the order page', type: 'http', start: 'node server.mjs', url: `http://127.0.0.1:${PORT}/`, expect: { status: 200, includes: 'Order a cake' }, timeout: 20, weight: 2 },
  ],
};

const ACCEPTANCE_TEST = `import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('Order a cake') || !html.includes('<form')) { console.error('order form missing'); process.exit(1); }
console.log('order form present');
`;

export const SERVER = `import http from 'node:http';
import fs from 'node:fs';
http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(fs.readFileSync('index.html')); }).listen(${PORT}, '127.0.0.1');
`;

// A project that has passed interview, research, hooks and screenplay.
export function makeProject() {
  const dir = tmpDir();
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  const init = cli(['init', '--name', 'Bakery orders', '--lang', 'en'], { cwd: dir });
  if (init.code !== 0) throw new Error(init.all);
  write(dir, '.skillsmith/01-brief.md', BRIEF);
  write(dir, '.skillsmith/02-research.md', RESEARCH);
  write(dir, '.skillsmith/02-sources.json', sources);
  write(dir, '.skillsmith/03-hooks.md', HOOKS);
  write(dir, '.skillsmith/04-screenplay.md', SCREENPLAY);
  write(dir, '.skillsmith/04-acceptance.json', ACCEPTANCE);
  write(dir, 'tests/acceptance/order.test.mjs', ACCEPTANCE_TEST);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'pre-production');
  for (const stage of ['interview', 'research', 'hooks', 'screenplay']) {
    const r = cli(['advance', stage], { cwd: dir });
    if (r.code !== 0) throw new Error(`advance ${stage} failed:\n${r.all}`);
  }
  return dir;
}

export function commitAll(dir, message) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}
