// REPORT.md and dashboard.html: what happened, in words the client understands.
import path from 'node:path';
import { ssPath, readJson, readText, writeText, exists, now } from './util.mjs';
import { STAGES, loadState, currentStage, section } from './pipeline.mjs';
import { loadArena, score } from './arena.mjs';

const T = {
  en: {
    stations: { interview: 'Interview', research: 'Research', hooks: 'Hooks', screenplay: 'Screenplay', arena: 'Arena', ship: 'Ship' },
    crew: { interview: 'Interviewer', research: 'Researcher', hooks: 'Hook writer', screenplay: 'Screenwriter', arena: 'Managers, developers, designers, auditor', ship: 'Conveyor' },
    done: 'Done',
    now: 'Now',
    waiting: 'Waiting',
    nowAt: 'Now at',
    allDone: 'All stations done',
    arena: 'Arena',
    noArena: 'The arena opens after the screenplay is approved.',
    status: { alive: 'In the game', dead: 'Eliminated', retired: 'Lost honestly', crowned: 'Winner' },
    stamp: { dead: 'Eliminated', crowned: 'Winner' },
    acceptance: 'Acceptance checks',
    verified: 'Verified claims',
    lies: 'False claims',
    unverifiable: 'Claims without proof',
    points: 'Points',
    notVerified: 'Not verified yet',
    log: 'Fight log',
    graveyard: 'Graveyard',
    nobody: 'Nobody has died. Yet.',
    files: 'Files',
    generated: 'Generated',
    reportTitle: 'Skillsmith report',
    oneSentence: 'In one sentence',
    winner: 'Winner',
    next: 'What to do next',
    nextSteps: ['Open README.md: it explains how to run the product.', 'Your launch copy is in .skillsmith/03-hooks.md.', 'Open .skillsmith/dashboard.html to see the whole story.'],
    station: 'Station',
    output: 'Output',
  },
  uk: {
    stations: { interview: 'Інтерв’ю', research: 'Дослідження', hooks: 'Хуки', screenplay: 'Сценарій', arena: 'Арена', ship: 'Запуск' },
    crew: { interview: 'Інтерв’юер', research: 'Дослідник', hooks: 'Автор хуків', screenplay: 'Сценарист', arena: 'Менеджери, розробники, дизайнери, аудитор', ship: 'Конвеєр' },
    done: 'Готово',
    now: 'Зараз',
    waiting: 'Чекає',
    nowAt: 'Зараз',
    allDone: 'Усі станції пройдено',
    arena: 'Арена',
    noArena: 'Арена відкриється, коли сценарій буде затверджено.',
    status: { alive: 'У грі', dead: 'Вибув', retired: 'Чесно програв', crowned: 'Переможець' },
    stamp: { dead: 'Вибув', crowned: 'Переможець' },
    acceptance: 'Перевірки приймання',
    verified: 'Підтверджені заяви',
    lies: 'Хибні заяви',
    unverifiable: 'Заяви без доказу',
    points: 'Бали',
    notVerified: 'Ще не перевірено',
    log: 'Хроніка бою',
    graveyard: 'Кладовище',
    nobody: 'Ніхто не загинув. Поки що.',
    files: 'Файли',
    generated: 'Згенеровано',
    reportTitle: 'Звіт Skillsmith',
    oneSentence: 'Одним реченням',
    winner: 'Переможець',
    next: 'Що далі',
    nextSteps: ['Відкрийте README.md: там написано, як запустити продукт.', 'Тексти для запуску — у .skillsmith/03-hooks.md.', 'Відкрийте .skillsmith/dashboard.html, щоб побачити всю історію.'],
    station: 'Станція',
    output: 'Результат',
  },
};

const pickLang = (lang) => (T[String(lang || '').slice(0, 2)] ? String(lang).slice(0, 2) : 'en');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function oneSentence(root) {
  const file = ssPath(root, '01-brief.md');
  if (!exists(file)) return '';
  const body = section(readText(file), 'summary')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('<!--'));
  return body.join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function collect(root) {
  const state = loadState(root);
  const lang = pickLang(state.language);
  const arena = loadArena(root, { required: false });
  let rows = [];
  if (arena) {
    try {
      rows = score(root).rows;
    } catch {
      rows = [];
    }
  }
  const verdicts = {};
  if (arena) {
    for (const name of Object.keys(arena.teams)) verdicts[name] = readJson(ssPath(root, 'teams', name, 'verdict.json'), null);
  }
  const graveyard = readJson(ssPath(root, 'graveyard.json'), { names: [], entries: [] });
  return { state, lang, t: T[lang], arena, rows, verdicts, graveyard, summary: oneSentence(root) };
}

export function writeReport(root) {
  const { state, t, arena, rows, graveyard, summary } = collect(root);
  const lines = [`# ${state.project}: ${t.reportTitle}`, '', `${t.generated}: ${now().slice(0, 16).replace('T', ' ')}`, ''];
  if (summary) lines.push(`## ${t.oneSentence}`, '', summary, '');
  lines.push(`| ${t.station} | | ${t.output} |`, '|---|---|---|');
  for (const s of STAGES) lines.push(`| ${t.stations[s.id]} | ${state.stages[s.id]?.status === 'done' ? '✔' : '·'} | ${s.output} |`);
  lines.push('');
  if (arena) {
    lines.push(`## ${t.arena}`, '');
    if (arena.winner) lines.push(`**${t.winner}:** ${arena.winner} (${arena.teams[arena.winner].persona})`, '');
    if (rows.length) {
      lines.push(`| Team | Manager | ${t.points} |`, '|---|---|---|', ...rows.map((r) => `| ${r.team} | ${r.persona} | ${r.total} |`), '');
    }
    lines.push(`### ${t.log}`, '', ...arena.events.map((e) => `- ${e.at.slice(11, 16)} ${e.detail}`), '');
  }
  lines.push(`## ${t.graveyard}`, '');
  if (!graveyard.entries.length) lines.push(t.nobody, '');
  for (const e of graveyard.entries) lines.push(`- **${e.team} (${e.persona})**: ${e.causeText}. ${(e.evidence || []).map((x) => x.label).join('; ')}`);
  lines.push('', `## ${t.next}`, '', ...t.nextSteps.map((s) => `- ${s}`), '');
  writeText(ssPath(root, 'REPORT.md'), lines.join('\n'));
  return ssPath(root, 'REPORT.md');
}

const ICON = { enter: '→', precheck: '◌', verify: '✓', upheld: '⚔', perjury: '✗', death: '✝', retire: '↘', crown: '♛', judge: '⚖', round: '↻', wiped: '∅' };

export function renderDashboard(root) {
  const { state, t, arena, rows, verdicts, graveyard, summary } = collect(root);
  const cur = currentStage(state);
  const scoreBy = Object.fromEntries(rows.map((r) => [r.team, r]));
  const alive = arena ? Object.values(arena.teams).filter((x) => x.status === 'alive').length : 0;

  const stations = STAGES.map((s, i) => {
    const st = state.stages[s.id]?.status === 'done' ? 'done' : cur && cur.id === s.id ? 'now' : 'waiting';
    return `<li class="st st-${st}" style="--temper: var(--t${i + 1})">
      <span class="node" aria-hidden="true"></span>
      <span class="st-name">${esc(t.stations[s.id])}</span>
      <span class="st-crew">${esc(t.crew[s.id])}</span>
      <span class="st-state">${esc(t[st])}</span>
    </li>`;
  }).join('');

  const teams = arena
    ? Object.entries(arena.teams)
        .map(([name, team]) => {
          const v = verdicts[name];
          const r = scoreBy[name];
          const pct = v && v.acceptance.total ? Math.round((v.acceptance.passed / v.acceptance.total) * 100) : 0;
          const stamp = t.stamp[team.status] ? `<span class="stamp">${esc(t.stamp[team.status])}</span>` : '';
          const stats = v
            ? `<div class="bar" role="img" aria-label="${esc(t.acceptance)} ${v.acceptance.passed}/${v.acceptance.total}"><span style="width:${pct}%"></span></div>
               <dl>
                 <div><dt>${esc(t.acceptance)}</dt><dd>${v.acceptance.passed}/${v.acceptance.total}</dd></div>
                 <div><dt>${esc(t.verified)}</dt><dd>${v.claims.verified}</dd></div>
                 <div class="${v.claims.false ? 'bad' : ''}"><dt>${esc(t.lies)}</dt><dd>${v.claims.false}</dd></div>
                 <div><dt>${esc(t.unverifiable)}</dt><dd>${v.claims.unverifiable}</dd></div>
                 ${r ? `<div class="total"><dt>${esc(t.points)}</dt><dd>${r.total}</dd></div>` : ''}
               </dl>`
            : `<p class="muted">${esc(t.notVerified)}</p>`;
          return `<article class="team team-${esc(team.status)}">
            <header><h3>${esc(team.persona)}</h3><code>${esc(name)}</code></header>
            <p class="motto">${esc(team.motto)}</p>
            <p class="state">${esc(t.status[team.status] || team.status)}</p>
            ${stats}
            ${stamp}
          </article>`;
        })
        .join('')
    : `<p class="muted">${esc(t.noArena)}</p>`;

  const log = arena
    ? arena.events
        .slice()
        .reverse()
        .map((e) => `<li class="ev ev-${esc(e.type)}"><span class="ev-icon" aria-hidden="true">${ICON[e.type] || '•'}</span><time>${esc(e.at.slice(11, 16))}</time><span>${esc(e.detail)}</span></li>`)
        .join('')
    : '';

  const graves = graveyard.entries.length
    ? graveyard.entries
        .map(
          (e) => `<article class="grave">
          <h3>${esc(e.persona)} <code>${esc(e.team)}</code></h3>
          <p>${esc(e.causeText)}</p>
          ${(e.evidence || []).map((x) => `<p class="lie">${esc(x.label)}</p>${x.detail ? `<pre>${esc(x.detail)}</pre>` : ''}`).join('')}
        </article>`,
        )
        .join('')
    : `<p class="muted">${esc(t.nobody)}</p>`;

  const files = ['01-brief.md', '02-research.md', '02-sources.json', '03-hooks.md', '04-screenplay.md', '04-acceptance.json', 'scoreboard.md', 'graveyard.md', 'REPORT.md']
    .filter((f) => exists(ssPath(root, f)))
    .map((f) => `<li><a href="./${esc(f)}">${esc(f)}</a></li>`)
    .join('');

  const where = cur ? `${t.nowAt}: ${t.stations[cur.id]}${cur.id === 'arena' && arena ? ` · ${alive}/${Object.keys(arena.teams).length}` : ''}` : t.allDone;

  return `<!doctype html>
<html lang="${esc(state.language && state.language !== 'auto' ? state.language : 'en')}">
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
  --molten: #D4500A; --pass: #1F7F6E; --dead: #C2362C;
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
.stamp { position: absolute; right: 14px; bottom: 18px; transform: rotate(-9deg); font-family: var(--stamp); font-size: 26px; text-transform: uppercase; padding: 4px 12px; border: 3px solid currentColor; border-radius: 4px; color: var(--dead); opacity: 0.92; }
.team-crowned .stamp { color: var(--molten); }
.cols { display: grid; grid-template-columns: 3fr 2fr; gap: 32px; }
.log { list-style: none; padding: 0; margin: 0; border-left: 2px solid var(--line); }
.ev { display: grid; grid-template-columns: 28px 48px 1fr; gap: 8px; padding: 8px 0 8px 12px; font-size: 15px; }
.ev time { color: var(--muted); font-size: 13px; padding-top: 2px; }
.ev-icon { font-weight: 700; color: var(--muted); }
.ev-death .ev-icon, .ev-perjury .ev-icon { color: var(--dead); }
.ev-crown .ev-icon, .ev-upheld .ev-icon { color: var(--molten); }
.ev-verify .ev-icon { color: var(--pass); }
.grave { border-left: 3px solid var(--dead); padding: 4px 0 4px 16px; margin-bottom: 20px; }
.grave h3 { margin: 0; font-size: 18px; }
.grave p { margin: 4px 0; }
.lie { font-weight: 600; }
pre { background: var(--surface); border: 1px solid var(--line); padding: 10px 12px; border-radius: 4px; font-size: 12.5px; overflow-x: auto; white-space: pre-wrap; }
.files { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; font-family: var(--mono); font-size: 14px; }
.muted { color: var(--muted); }
footer { margin-top: 56px; color: var(--muted); font-size: 13px; }
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
  ${summary ? `<p class="summary">${esc(summary)}</p>` : ''}
  <ol class="line">${stations}</ol>
  <h2>${esc(t.arena)}</h2>
  <div class="teams">${teams}</div>
  <div class="cols">
    <section><h2>${esc(t.log)}</h2>${log ? `<ol class="log">${log}</ol>` : `<p class="muted">—</p>`}</section>
    <section><h2>${esc(t.graveyard)}</h2>${graves}</section>
  </div>
  <h2>${esc(t.files)}</h2>
  <ul class="files">${files}</ul>
  <footer>${esc(t.generated)}: ${esc(now().slice(0, 16).replace('T', ' '))} UTC</footer>
</main>
</body>
</html>
`;
}

export function writeDashboard(root, out) {
  const file = out ? path.resolve(out) : ssPath(root, 'dashboard.html');
  writeText(file, renderDashboard(root));
  return file;
}
