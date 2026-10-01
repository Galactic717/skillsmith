/** dashboard.html: the whole production line on one self-contained page. */
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from '../../core/fs.js';
import { recordPath } from '../../core/paths.js';
import { escapeHtml as esc, nowIso } from '../../core/text.js';
import { CAUSE_TEXT, describeEvent } from '../arena/model.js';
import { currentStation } from '../project.js';
import { STATIONS } from '../stations.js';
import { collectReport } from './collect.js';
const ICON = {
    enter: '→',
    precheck: '◌',
    verify: '✓',
    upheld: '⚔',
    perjury: '✗',
    death: '✝',
    retire: '↘',
    crown: '♛',
    judge: '⚖',
    round: '↻',
    wiped: '∅',
    fuse: '⊕',
};
const STATUS_LABEL = {
    alive: 'In the game',
    dead: 'Eliminated',
    retired: 'Lost honestly',
    crowned: 'Winner',
};
const STAMP = { dead: 'Eliminated', crowned: 'Winner' };
const RECORD_FILES = [
    '01-brief.md',
    '02-research.md',
    '02-sources.json',
    '03-hooks.md',
    '04-screenplay.md',
    '04-acceptance.json',
    '04-vacuity.json',
    'scoreboard.md',
    'graveyard.md',
    'REPORT.md',
];
function stationList(data) {
    const { state } = data.project;
    const now = currentStation(state);
    return STATIONS.map((item, index) => {
        const phase = state.stations[item.id].status === 'done' ? 'done' : now?.id === item.id ? 'now' : 'waiting';
        const label = phase === 'done' ? 'Done' : phase === 'now' ? 'Now' : 'Waiting';
        return `<li class="st st-${phase}" style="--temper: var(--t${index + 1})">
      <span class="node" aria-hidden="true"></span>
      <span class="st-name">${esc(item.title)}</span>
      <span class="st-crew">${esc(item.crew)}</span>
      <span class="st-state">${label}</span>
    </li>`;
    }).join('');
}
function teamCards(data) {
    const { arena } = data;
    if (!arena)
        return '<p class="muted">The arena opens after the screenplay is approved.</p>';
    const scoreBy = new Map((data.board?.rows ?? []).map(row => [row.team, row]));
    return Object.entries(arena.teams)
        .map(([name, team]) => {
        const verdict = data.verdicts[name];
        const row = scoreBy.get(name);
        const pct = verdict && verdict.acceptance.total
            ? Math.round((verdict.acceptance.passed / verdict.acceptance.total) * 100)
            : 0;
        const stamp = STAMP[team.status]
            ? `<span class="stamp">${esc(STAMP[team.status])}</span>`
            : '';
        const hidden = verdict?.holdout.ran
            ? `<div><dt>Hidden checks</dt><dd>${verdict.holdout.passed}/${verdict.holdout.total}</dd></div>`
            : '';
        const safety = verdict
            ? `<div class="${verdict.safety.clean ? '' : 'bad'}"><dt>Safety</dt><dd>${verdict.safety.clean ? 'clean' : 'problem'}</dd></div>`
            : '';
        const stats = verdict
            ? `<div class="bar" role="img" aria-label="Acceptance checks ${verdict.acceptance.passed} of ${verdict.acceptance.total}"><span style="width:${pct}%"></span></div>
           <dl>
             <div><dt>Acceptance checks</dt><dd>${verdict.acceptance.passed}/${verdict.acceptance.total}</dd></div>
             ${hidden}
             <div><dt>Proven claims</dt><dd>${verdict.claims.verified}</dd></div>
             <div class="${verdict.claims.false ? 'bad' : ''}"><dt>False claims</dt><dd>${verdict.claims.false}</dd></div>
             <div><dt>Claims without proof</dt><dd>${verdict.claims.unverifiable}</dd></div>
             ${safety}
             ${row ? `<div class="total"><dt>Points</dt><dd>${row.total}</dd></div>` : ''}
           </dl>`
            : '<p class="muted">Not verified yet</p>';
        return `<article class="team team-${esc(team.status)}">
        <header><h3>${esc(team.persona)}</h3><code>${esc(name)}</code></header>
        <p class="motto">${esc(team.motto)}</p>
        <p class="state">${esc(STATUS_LABEL[team.status])}</p>
        ${stats}
        ${stamp}
      </article>`;
    })
        .join('');
}
function fightLog(data) {
    const events = data.arena?.events ?? [];
    if (events.length === 0)
        return '<p class="muted">Nothing has happened yet.</p>';
    const items = events
        .slice()
        .reverse()
        .map(event => `<li class="ev ev-${esc(event.type)}"><span class="ev-icon" aria-hidden="true">${ICON[event.type]}</span><time>${esc(event.at.slice(11, 16))}</time><span>${esc(describeEvent(event))}</span></li>`)
        .join('');
    return `<ol class="log">${items}</ol>`;
}
function graves(data) {
    if (data.graveyard.entries.length === 0)
        return '<p class="muted">Nobody has died. Yet.</p>';
    return data.graveyard.entries
        .map(entry => `<article class="grave">
        <h3>${esc(entry.persona)} <code>${esc(entry.team)}</code></h3>
        <p>${esc(CAUSE_TEXT[entry.cause])}</p>
        ${entry.evidence.map(item => `<p class="lie">${esc(item.label)}</p>${item.detail ? `<pre>${esc(item.detail)}</pre>` : ''}`).join('')}
      </article>`)
        .join('');
}
function notices(data) {
    const items = [];
    if (data.integrityProblem)
        items.push(`<p class="notice bad">Integrity problem: ${esc(data.integrityProblem)}</p>`);
    if (!data.ledger.ok)
        items.push(`<p class="notice bad">The ledger failed its check: ${esc(data.ledger.problems.join('; '))}</p>`);
    if (data.drift.length)
        items.push(`<p class="notice">Edited after approval: ${esc(data.drift.join(', '))}</p>`);
    if (data.board?.tooCloseToCall)
        items.push('<p class="notice">The top two are within 2 points: too close to call.</p>');
    return items.join('');
}
/** Renders the dashboard as one HTML string. */
export function renderDashboard(project) {
    const data = collectReport(project);
    const { state, root } = project;
    const now = currentStation(state);
    const alive = data.arena
        ? Object.values(data.arena.teams).filter(team => team.status === 'alive').length
        : 0;
    const total = data.arena ? Object.keys(data.arena.teams).length : 0;
    const where = now
        ? `Now at: ${now.title}${now.id === 'arena' && data.arena ? ` · ${alive}/${total} teams alive` : ''}`
        : 'All stations done';
    const files = RECORD_FILES.filter(file => fs.existsSync(recordPath(root, file)))
        .map(file => `<li><a href="./${esc(file)}">${esc(file)}</a></li>`)
        .join('');
    const ledger = data.ledger.ok
        ? `Ledger: ${data.ledger.entries} signed entries, intact${data.ledger.macChecked ? '' : ' (chain only)'}`
        : 'Ledger: FAILED its check';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(state.project)} · Skillsmith</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geologica:wght@300..800&family=Dela+Gothic+One&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #F1F2F4; --surface: #FFFFFF; --line: #D5D9DE; --text: #17191C; --muted: #5D646D;
  --molten: #C2470A; --pass: #1F7F6E; --dead: #C2362C;
  --t1: #C79A3E; --t2: #A86A2F; --t3: #7B4C99; --t4: #2F5FA6; --t5: #4E8CC4; --t6: #8B98A6;
  --display: "Geologica", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace; --stamp: "Dela Gothic One", var(--display);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #16181B; --surface: #1F2226; --line: #343940; --text: #ECEDEF; --muted: #9AA1AA;
    --molten: #FF7A2F; --pass: #4CC1A9; --dead: #FF5A4E;
    --t1: #E2C277; --t2: #CC8A4A; --t3: #A47BC4; --t4: #5B8BD6; --t5: #86B8E3; --t6: #C9D2DC;
  }
}
:root[data-theme="dark"] {
  --bg: #16181B; --surface: #1F2226; --line: #343940; --text: #ECEDEF; --muted: #9AA1AA;
  --molten: #FF7A2F; --pass: #4CC1A9; --dead: #FF5A4E;
  --t1: #E2C277; --t2: #CC8A4A; --t3: #A47BC4; --t4: #5B8BD6; --t5: #86B8E3; --t6: #C9D2DC;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 400 16px/1.55 var(--display); }
main { max-width: 1120px; margin: 0 auto; padding: 40px 16px 64px; }
a { color: inherit; }
code, pre, time { font-family: var(--mono); }
.top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; border-bottom: 1px solid var(--line); padding-bottom: 20px; }
.brand { font-weight: 600; color: var(--muted); }
h1 { font-size: clamp(32px, 6vw, 56px); line-height: 1.05; font-weight: 750; margin: 8px 0 0; letter-spacing: -0.02em; }
.where { font-size: 18px; color: var(--molten); font-weight: 600; margin: 0; }
.summary { max-width: 70ch; color: var(--muted); margin: 16px 0 0; }
.notice { margin: 12px 0 0; padding: 10px 14px; border: 1px solid var(--line); border-left: 4px solid var(--molten); background: var(--surface); border-radius: 4px; }
.notice.bad { border-left-color: var(--dead); }
h2 { font-size: 22px; font-weight: 700; margin: 48px 0 16px; }
.line { list-style: none; margin: 32px 0 0; padding: 0; display: grid; grid-template-columns: repeat(6, 1fr); position: relative; }
.line::before { content: ""; position: absolute; left: 8%; right: 8%; top: 13px; height: 2px; background: var(--line); }
.st { position: relative; display: grid; justify-items: center; text-align: center; gap: 2px; padding: 0 4px; }
.node { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--line); background: var(--bg); position: relative; z-index: 1; margin-bottom: 8px; }
.st-done .node { background: var(--temper); border-color: var(--temper); }
.st-now .node { border-color: var(--molten); background: radial-gradient(circle, var(--molten) 0 35%, transparent 36%); box-shadow: 0 0 0 6px color-mix(in srgb, var(--molten) 18%, transparent); animation: glow 1.8s ease-in-out infinite; }
@keyframes glow { 50% { box-shadow: 0 0 0 11px color-mix(in srgb, var(--molten) 6%, transparent); } }
.st-name { font-weight: 650; }
.st-crew { font-size: 13px; color: var(--muted); }
.st-state { font-size: 12px; font-family: var(--mono); color: var(--muted); }
.st-now .st-state { color: var(--molten); }
.teams { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.team { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 20px; overflow: hidden; }
.team header { display: flex; justify-content: space-between; align-items: baseline; }
.team h3 { margin: 0; font-size: 24px; font-weight: 750; }
.team code { color: var(--muted); font-size: 13px; }
.motto { color: var(--muted); margin: 6px 0 12px; min-height: 3em; }
.state { margin: 0 0 12px; font-weight: 600; }
.team-alive .state { color: var(--pass); }
.team-dead .state { color: var(--dead); }
.team-crowned { border-color: var(--molten); }
.team-crowned .state { color: var(--molten); }
.team-dead > :not(.stamp) { opacity: 0.45; filter: grayscale(1); }
.bar { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--pass); }
dl { margin: 12px 0 0; display: grid; gap: 4px; }
dl div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
dt { color: var(--muted); }
dd { margin: 0; font-family: var(--mono); font-weight: 600; }
dl .bad dd, dl .bad dt { color: var(--dead); }
dl .total { border-top: 1px solid var(--line); padding-top: 6px; margin-top: 4px; font-size: 16px; }
.team-dead, .team-crowned { padding-bottom: 88px; }
.stamp { position: absolute; right: 16px; bottom: 20px; transform: rotate(-9deg); font-family: var(--stamp); font-size: 26px; text-transform: uppercase; padding: 4px 12px; border: 3px solid currentColor; border-radius: 4px; color: var(--dead); opacity: 0.92; }
.team-crowned .stamp { color: var(--molten); }
.cols { display: grid; grid-template-columns: 3fr 2fr; gap: 32px; }
.log { list-style: none; padding: 0; margin: 0; border-left: 2px solid var(--line); }
.ev { display: grid; grid-template-columns: 28px 48px 1fr; gap: 8px; padding: 8px 0 8px 12px; font-size: 15px; }
.ev time { color: var(--muted); font-size: 13px; padding-top: 2px; }
.ev-icon { font-weight: 700; color: var(--muted); }
.ev-death .ev-icon, .ev-perjury .ev-icon { color: var(--dead); }
.ev-crown .ev-icon, .ev-upheld .ev-icon, .ev-fuse .ev-icon { color: var(--molten); }
.ev-verify .ev-icon { color: var(--pass); }
.grave { border-left: 3px solid var(--dead); padding: 4px 0 4px 16px; margin-bottom: 20px; }
.grave h3 { margin: 0; font-size: 18px; }
.grave p { margin: 4px 0; }
.lie { font-weight: 600; }
pre { background: var(--surface); border: 1px solid var(--line); padding: 10px 12px; border-radius: 4px; font-size: 12.5px; overflow-x: auto; white-space: pre-wrap; }
.files { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; font-family: var(--mono); font-size: 14px; }
.muted { color: var(--muted); }
footer { margin-top: 56px; color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px 24px; }
@media (max-width: 760px) {
  .line { grid-template-columns: 1fr; gap: 14px; }
  .line::before { left: 13px; right: auto; top: 14px; bottom: 14px; width: 2px; height: auto; }
  .st { grid-template-columns: 28px 1fr; justify-items: start; text-align: left; column-gap: 12px; }
  .node { grid-row: span 3; margin: 0; }
  .cols { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .st-now .node { animation: none; } }
</style>
</head>
<body>
<main>
  <div class="top">
    <div>
      <span class="brand">Skillsmith</span>
      <h1>${esc(state.project)}</h1>
    </div>
    <p class="where">${esc(where)}</p>
  </div>
  ${data.summary ? `<p class="summary">${esc(data.summary)}</p>` : ''}
  ${notices(data)}
  <ol class="line">${stationList(data)}</ol>
  <h2>Arena</h2>
  <div class="teams">${teamCards(data)}</div>
  <div class="cols">
    <section><h2>Fight log</h2>${fightLog(data)}</section>
    <section><h2>Graveyard</h2>${graves(data)}</section>
  </div>
  <h2>Files</h2>
  <ul class="files">${files}</ul>
  <footer><span>Generated ${esc(nowIso().slice(0, 16).replace('T', ' '))} UTC</span><span>${esc(ledger)}</span></footer>
</main>
</body>
</html>
`;
}
/** Writes the dashboard (default `.skillsmith/dashboard.html`) and returns its path. */
export function writeDashboard(project, out) {
    const file = out ? path.resolve(out) : recordPath(project.root, 'dashboard.html');
    writeFileAtomic(file, renderDashboard(project));
    return file;
}
