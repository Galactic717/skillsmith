#!/usr/bin/env node
// Runs a real, scripted arena on a demo bakery project and leaves it on disk.
// The dashboard and terminal output used in marketing come from this run.
//   node scripts/demo-arena.mjs [--lang en|uk] [--out DIR]
import fs from 'node:fs';
import path from 'node:path';
import { makeProject, cli, write, commitAll, SERVER } from '../tests/helpers.mjs';

const args = process.argv.slice(2);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : null;

const SUMMARY = {
  en: 'A page where regular customers of Marta’s bakery order a cake for a date and leave a phone number, so orders stop getting lost in direct messages.',
  uk: 'Сторінка, де постійні клієнти пекарні Марти замовляють торт на дату і залишають телефон, щоб замовлення більше не губилися в Direct.',
};

const page = ({ title, extra = '', style = '' }) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${style}</style></head>
<body><main><h1>Order a cake</h1>
<form><label>Date <input type="date" name="date" required></label>
<label>Phone <input type="tel" name="phone" required pattern="[+0-9 ]{9,}"></label>${extra}
<button>Order the cake</button></form></main></body></html>
`;

function run(argv, cwd) {
  const r = cli(argv, { cwd });
  process.stdout.write(`\n$ skillsmith ${argv.join(' ')}\n${r.out}${r.err}`);
  return r;
}

const dir = makeProject();
const statePath = path.join(dir, '.skillsmith', 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
state.language = lang;
state.project = lang === 'uk' ? 'Замовлення тортів' : 'Bakery orders';
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const briefPath = path.join(dir, '.skillsmith', '01-brief.md');
fs.writeFileSync(briefPath, fs.readFileSync(briefPath, 'utf8').replace(/(<!-- ss:summary -->\n## One sentence\n)[^\n]+/, `$1${SUMMARY[lang] || SUMMARY.en}`));

run(['arena', 'init'], dir);
const wt = (t) => path.join(dir, '.skillsmith', 'arena', t);
const dossier = (t) => path.join(dir, '.skillsmith', 'teams', t);

// Sprint: small and complete, no tap-to-call link.
write(wt('alpha'), 'index.html', page({ title: 'Bakery' }));
write(wt('alpha'), 'server.mjs', SERVER);
commitAll(wt('alpha'), 'feat: order page and server');
write(dossier('alpha'), 'claims.json', {
  team: 'alpha',
  summary: 'Order page with date and phone, served locally.',
  claims: [
    { id: 'C1', text: 'Every acceptance check passes', evidence: { type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4'] } },
    { id: 'C2', text: 'The phone field is required', evidence: { type: 'file_contains', path: 'index.html', pattern: 'name="phone" required' } },
    { id: 'C3', text: 'Fits a 375px phone screen', evidence: { type: 'manual', note: 'Checked by eye.' } },
  ],
  known_issues: ['No tap-to-call link yet.'],
});

// Fortress: tested, validated, with a call link.
write(wt('beta'), 'index.html', page({ title: 'Bakery', extra: '\n<p><a href="tel:+380000000000">Call Marta</a></p>' }));
write(wt('beta'), 'server.mjs', SERVER);
write(wt('beta'), 'tests/unit.test.mjs', `import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const checks = { 'phone required': /name="phone" required/.test(html), 'date required': /name="date" required/.test(html), 'call link': html.includes('href="tel:') };
for (const [name, ok] of Object.entries(checks)) { console.log((ok ? 'ok ' : 'FAIL ') + name); if (!ok) process.exitCode = 1; }
`);
commitAll(wt('beta'), 'feat: validated order form, call link, tests');
write(dossier('beta'), 'claims.json', {
  team: 'beta',
  summary: 'Validated order form, tap-to-call, own tests.',
  claims: [
    { id: 'C1', text: 'Every acceptance check passes', evidence: { type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4'] } },
    { id: 'C2', text: 'Our unit tests pass', evidence: { type: 'command', run: 'node tests/unit.test.mjs' } },
    { id: 'C3', text: 'Customers can tap to call Marta', evidence: { type: 'file_contains', path: 'index.html', pattern: 'href="tel:' } },
    { id: 'C4', text: 'Keyboard navigation works', evidence: { type: 'manual', note: 'Tabbed through the form.' } },
  ],
  known_issues: [],
});

// Spark: a flashy page and a claim nobody checked.
write(wt('gamma'), 'index.html', page({ title: 'Bakery', style: 'body{background:linear-gradient(135deg,#ff6ec4,#7873f5)}' }));
write(wt('gamma'), 'server.mjs', SERVER);
commitAll(wt('gamma'), 'feat: bold order page');
write(dossier('gamma'), 'claims.json', {
  team: 'gamma',
  summary: 'Bold, memorable order page.',
  claims: [
    { id: 'C1', text: 'Every acceptance check passes', evidence: { type: 'acceptance', ids: ['A1', 'A2', 'A3', 'A4'] } },
    { id: 'C2', text: 'All our unit tests pass', evidence: { type: 'command', run: 'node tests/unit.test.mjs' } },
  ],
});

run(['arena', 'verify', 'alpha'], dir);
run(['arena', 'verify', 'beta'], dir);
run(['arena', 'verify', 'gamma'], dir);

// Cross-examination: Fortress proves Sprint has no tap-to-call link.
write(path.join(dossier('beta'), 'probes'), 'no-call-link.mjs', `import fs from 'node:fs';
if (fs.readFileSync('index.html', 'utf8').includes('href="tel:')) process.exit(1);
console.log('DEFECT: no tap-to-call link');
`);
write(dossier('beta'), 'accusations.json', {
  team: 'beta',
  accusations: [
    { id: 'X1', against: 'alpha', text: 'Customers cannot tap to call Marta', evidence: { type: 'command', run: 'node "$SKILLSMITH_PROBES/no-call-link.mjs"', expect: { exit: 0, includes: 'DEFECT' } } },
  ],
});
run(['arena', 'accuse', 'beta'], dir);

write(path.join(dir, '.skillsmith'), 'judge.json', {
  judge: 'auditor',
  round: 1,
  scores: {
    alpha: {
      fit: { score: 7, evidence: 'Order, date and phone work (A1-A4 pass); no way to call the bakery, which the brief implies.' },
      experience: { score: 7, evidence: 'Ordered as a customer at 375px in 3 taps; plain but clear.' },
      craft: { score: 6, evidence: 'No own tests; server.mjs is minimal and fine.' },
    },
    beta: {
      fit: { score: 9, evidence: 'All must-haves plus tap-to-call from the brief (index.html).' },
      experience: { score: 8, evidence: 'Clear labels; invalid phone is rejected by the pattern attribute.' },
      craft: { score: 9, evidence: 'tests/unit.test.mjs covers phone, date and call link; all pass.' },
    },
  },
});
run(['arena', 'judge'], dir);
run(['arena', 'score'], dir);
run(['arena', 'crown'], dir);
write(dir, 'README.md', '# Bakery orders\n\nRun `node server.mjs`, then open http://127.0.0.1:4817\n');
run(['report'], dir);
run(['advance', 'ship'], dir);
run(['dashboard'], dir);

let final = dir;
if (out) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(dir, out, { recursive: true });
  final = out;
}
process.stdout.write(`\nDemo project: ${final}\nDashboard: ${path.join(final, '.skillsmith', 'dashboard.html')}\n`);
