// The arena: rival teams in separate git worktrees, verified in clean rooms.
// Lying, tampering with protected files, or accusing without proof deletes a
// team: worktree and branch are removed and the evidence goes to the graveyard.
import fs from 'node:fs';
import path from 'node:path';
import { ssPath, readJson, writeJson, writeText, readText, exists, now, toPosix, matchGlob, tail, UserError } from './util.mjs';
import * as G from './git.mjs';
import { runCheck, unsafeReason } from './checks.mjs';
import { validateAcceptance, validateClaims, validateAccusations, validateJudge, JUDGE_CRITERIA } from './artifacts.mjs';
import { loadState, saveState } from './pipeline.mjs';

export const PERSONAS = [
  { persona: 'Sprint', motto: 'The smallest product that fully works, shipped first.' },
  { persona: 'Fortress', motto: 'Nothing breaks: tests, edge cases, security, accessibility.' },
  { persona: 'Spark', motto: 'The boldest experience people remember and tell friends about.' },
];
const TEAM_NAMES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

export const SCORING = {
  acceptance: 50,
  claimsCap: 10,
  accusationBonus: 3,
  accusationBonusCap: 9,
  accusationPenalty: 4,
  judgeMax: 30,
};

const arenaFile = (root) => ssPath(root, 'arena.json');
const dossierDir = (root, team) => ssPath(root, 'teams', team);
const worktreeAbs = (root, team) => path.join(root, '.skillsmith', 'arena', team);

export function loadArena(root, { required = true } = {}) {
  const arena = readJson(arenaFile(root), null);
  if (!arena && required) throw new UserError('The arena has not started.', { hint: 'Run `skillsmith arena init` after the screenplay gate passes.' });
  return arena;
}

const saveArena = (root, arena) => writeJson(arenaFile(root), arena);

function addEvent(arena, type, team, detail, data) {
  arena.events.push({ at: now(), round: arena.round, type, team, detail, ...(data ? { data } : {}) });
}

function loadGraveyard(root) {
  return readJson(ssPath(root, 'graveyard.json'), { names: [], entries: [] });
}

function loadAcceptance(root) {
  const data = readJson(ssPath(root, '04-acceptance.json'));
  const v = validateAcceptance(data);
  if (v.errors.length) throw new UserError(`04-acceptance.json is invalid:\n- ${v.errors.join('\n- ')}`);
  return data;
}

const protectedGlobs = (acceptance) => ['.skillsmith/**', ...(acceptance.protected || [])];

function team(arena, name) {
  const t = arena.teams[name];
  if (!t) throw new UserError(`No team "${name}" in this arena. Teams: ${Object.keys(arena.teams).join(', ')}`, { code: 2 });
  return t;
}

function requireAlive(t, name) {
  if (t.status !== 'alive') throw new UserError(`Team ${name} is ${t.status}.`);
}

function ensureIgnored(root) {
  const file = path.join(root, '.gitignore');
  const text = exists(file) ? readText(file) : '';
  if (!text.split(/\r?\n/).some((l) => l.trim() === '.skillsmith/arena/')) {
    writeText(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}# Skillsmith arena worktrees\n.skillsmith/arena/\n`);
  }
}

export function teamPaths(root, name) {
  const d = dossierDir(root, name);
  return {
    team: name,
    branch: `skillsmith/${name}`,
    worktree: worktreeAbs(root, name),
    dossier: d,
    orders: path.join(d, 'orders.md'),
    claims: path.join(d, 'claims.json'),
    accusations: path.join(d, 'accusations.json'),
    probes: path.join(d, 'probes'),
    verdict: path.join(d, 'verdict.json'),
  };
}

export function arenaInit(root, { teams: requested, count, force = false, templatesDir } = {}) {
  const existing = loadArena(root, { required: false });
  if (existing && existing.status === 'running') {
    throw new UserError('An arena is already running.', { hint: 'Finish it with `skillsmith arena crown`, or eliminate the remaining teams.' });
  }
  const state = loadState(root);
  if (!force && state.stages.screenplay?.status !== 'done') {
    throw new UserError('The screenplay is not approved yet.', { hint: 'Pass the screenplay gate first: `skillsmith advance screenplay`.' });
  }
  const acceptance = loadAcceptance(root);
  const graveyard = loadGraveyard(root);

  let names = requested;
  if (!names) {
    const n = Math.max(1, Math.min(Number(count) || 3, 5));
    names = TEAM_NAMES.filter((t) => !graveyard.names.includes(t)).slice(0, n);
  }
  for (const n of names) {
    if (!/^[a-z][a-z0-9-]{1,20}$/.test(n)) throw new UserError(`Bad team name "${n}": use lowercase letters, digits, dashes.`, { code: 2 });
    if (graveyard.names.includes(n)) throw new UserError(`Team name "${n}" is in the graveyard. The dead do not come back; pick another name.`);
  }

  if (!G.isRepo(root)) G.git(['init'], { cwd: root });
  const identity = G.ensureIdentity(root);
  ensureIgnored(root);

  if (existing) {
    const history = ssPath(root, 'history');
    fs.mkdirSync(history, { recursive: true });
    fs.renameSync(arenaFile(root), path.join(history, `arena-${Date.now()}.json`));
  }

  const uncommittedProtected = G.statusLines(root)
    .map((l) => l.slice(3).replace(/^"|"$/g, ''))
    .filter((f) => !f.startsWith('.skillsmith/') && (acceptance.protected || []).some((g) => matchGlob(f, g)));
  if (uncommittedProtected.length) {
    throw new UserError(`Acceptance files are not committed, so the teams would not get them:\n${uncommittedProtected.join('\n')}`, {
      hint: 'Commit them first: git add <files> && git commit -m "acceptance tests"',
    });
  }

  G.git(['add', '--', '.skillsmith', '.gitignore'], { cwd: root });
  const staged = G.git(['diff', '--cached', '--quiet'], { cwd: root, allowFail: true });
  if (!staged.ok) G.git(['commit', '-m', 'skillsmith: pre-production records', '--', '.skillsmith', '.gitignore'], { cwd: root });
  const strayChanges = G.statusLines(root).filter((l) => !l.slice(3).startsWith('.skillsmith/'));

  const base = G.revParse(root, 'HEAD');
  const arena = {
    version: 1,
    status: 'running',
    base,
    round: 1,
    createdAt: now(),
    protected: protectedGlobs(acceptance),
    teams: {},
    events: [],
  };

  names.forEach((name, i) => {
    const p = teamPaths(root, name);
    if (G.branchExists(root, p.branch)) throw new UserError(`Branch ${p.branch} already exists.`, { hint: `Rename or delete it: git branch -m ${p.branch} ${p.branch}-old` });
    G.addWorktree(root, p.worktree, { branch: p.branch, base });
    fs.mkdirSync(p.probes, { recursive: true });
    const { persona, motto } = PERSONAS[i % PERSONAS.length];
    if (!exists(p.orders) && templatesDir) {
      const tpl = readText(path.join(templatesDir, 'orders.md'));
      writeText(p.orders, tpl.replaceAll('{{team}}', name).replaceAll('{{persona}}', persona).replaceAll('{{motto}}', motto));
    }
    arena.teams[name] = {
      persona,
      motto,
      status: 'alive',
      branch: p.branch,
      worktree: toPosix(path.relative(root, p.worktree)),
      dossier: toPosix(path.relative(root, p.dossier)),
    };
    addEvent(arena, 'enter', name, `${persona} enters the arena: ${motto}`, { persona });
  });
  saveArena(root, arena);
  return { arena, identity, strayChanges, paths: names.map((n) => teamPaths(root, n)) };
}

// Output from a clean room mentions its temporary path; show it as "./".
const scrub = (text, dir) => String(text || '').split(`${dir}${path.sep}`).join('./').split(dir).join('.');

async function withCleanroom(root, label, commit, fn) {
  const dir = path.join(root, '.skillsmith', 'arena', `.cleanroom-${label}-${Date.now()}`);
  G.addWorktree(root, dir, { base: commit, detach: true });
  try {
    return await fn(dir);
  } finally {
    G.removeWorktree(root, dir);
  }
}

async function runSetup(commands = [], dir) {
  const out = [];
  for (const run of commands) {
    const reason = unsafeReason(run);
    if (reason) {
      out.push({ run, status: 'unsafe', detail: `Refused (${reason})` });
      break;
    }
    const r = await runCheck({ type: 'command', run, timeout: 900 }, { dir });
    out.push({ run, status: r.status, detail: tail(scrub(r.detail, dir), 400) });
    if (r.status !== 'pass') break;
  }
  return out;
}

const CLAIM_STATUS = { pass: 'verified', fail: 'false' };

function writeGraveyardMd(root, graveyard) {
  const lines = [
    '# Graveyard',
    '',
    'Teams here filed a claim that failed its own check, changed a protected file, or accused a rival without proof.',
    'Their branch and worktree were deleted. The evidence stays here for good.',
    '',
  ];
  if (graveyard.entries.length === 0) lines.push('Nobody has died. Yet.', '');
  for (const e of graveyard.entries) {
    lines.push(`## ${e.team} (${e.persona}) — ${e.at.slice(0, 16).replace('T', ' ')}`, '', `**Cause:** ${e.causeText}`, '');
    for (const item of e.evidence || []) {
      lines.push(`- ${item.label}`);
      if (item.detail) lines.push('', '  ```', ...String(item.detail).split('\n').map((l) => `  ${l}`), '  ```', '');
    }
    lines.push('');
  }
  writeText(ssPath(root, 'graveyard.md'), `${lines.join('\n').trimEnd()}\n`);
}

const CAUSE_TEXT = {
  'false-claim': 'claimed something that its own evidence check proved false',
  tampering: 'changed protected files (tests or Skillsmith records)',
  'false-accusation': 'accused a rival with evidence that did not hold up',
  manual: 'eliminated by the client',
};

export function kill(root, arena, name, cause, evidence) {
  const t = team(arena, name);
  G.removeWorktree(root, worktreeAbs(root, name));
  G.git(['branch', '-D', t.branch], { cwd: root, allowFail: true });
  t.status = 'dead';
  t.diedAt = now();
  t.cause = cause;
  const graveyard = loadGraveyard(root);
  if (!graveyard.names.includes(name)) graveyard.names.push(name);
  const causeText = CAUSE_TEXT[cause] || cause;
  graveyard.entries.push({ team: name, persona: t.persona, at: t.diedAt, cause, causeText, evidence });
  writeJson(ssPath(root, 'graveyard.json'), graveyard);
  writeGraveyardMd(root, graveyard);
  addEvent(arena, 'death', name, `${t.persona} is out: ${causeText}.`, { persona: t.persona, cause });
  if (Object.values(arena.teams).every((x) => x.status !== 'alive')) {
    arena.status = 'wiped';
    addEvent(arena, 'wiped', null, 'No team survived. Start a new arena with fresh names.', {});
  }
}

export async function trial(root, name, { mode = 'verify', setup = true } = {}) {
  const arena = loadArena(root);
  const t = team(arena, name);
  requireAlive(t, name);
  const acceptance = loadAcceptance(root);
  const p = teamPaths(root, name);
  const head = G.revParse(root, t.branch);
  const dirty = exists(p.worktree) ? G.statusLines(p.worktree) : [];
  const commits = G.commitCount(root, arena.base, head);
  const globs = protectedGlobs(acceptance);
  const tampered = G.changedFiles(root, arena.base, head).filter((f) => globs.some((g) => matchGlob(f, g)));
  const claimsData = readJson(p.claims, null);
  const claimErrors = claimsData ? validateClaims(claimsData) : ['no claims.json filed yet'];
  const claimsList = Array.isArray(claimsData?.claims) ? claimsData.claims : [];

  const verdict = await withCleanroom(root, name, head, async (dir) => {
    const setupResults = setup ? await runSetup(acceptance.setup, dir) : [];
    const accResults = [];
    for (const check of acceptance.checks) {
      const r = await runCheck(check, { dir });
      accResults.push({ id: check.id, title: check.title, weight: check.weight ?? 1, status: r.status, detail: tail(scrub(r.detail, dir), 500) });
    }
    const accMap = Object.fromEntries(accResults.map((r) => [r.id, r.status]));
    const claimResults = [];
    for (const cl of claimsList) {
      const r = await runCheck(cl?.evidence, { dir, acceptance: accMap });
      claimResults.push({ id: cl?.id, text: cl?.text, evidence: cl?.evidence, status: CLAIM_STATUS[r.status] || 'unverifiable', check: r.status, detail: tail(scrub(r.detail, dir), 500) });
    }
    const passed = accResults.filter((r) => r.status === 'pass');
    return {
      team: name,
      persona: t.persona,
      mode,
      round: arena.round,
      at: now(),
      commit: head,
      commits,
      uncommitted: dirty.length,
      tampered,
      setup: setupResults,
      acceptance: {
        results: accResults,
        passed: passed.length,
        total: accResults.length,
        weightPassed: passed.reduce((s, r) => s + r.weight, 0),
        weightTotal: accResults.reduce((s, r) => s + r.weight, 0),
      },
      claims: {
        filed: Boolean(claimsData),
        errors: claimErrors,
        results: claimResults,
        verified: claimResults.filter((r) => r.status === 'verified').length,
        false: claimResults.filter((r) => r.status === 'false').length,
        unverifiable: claimResults.filter((r) => r.status === 'unverifiable').length,
      },
      knownIssues: Array.isArray(claimsData?.known_issues) ? claimsData.known_issues : [],
    };
  });

  let cause = null;
  let evidence = [];
  if (tampered.length) {
    cause = 'tampering';
    evidence = tampered.map((f) => ({ label: `changed protected file \`${f}\`` }));
  } else if (verdict.claims.false > 0) {
    cause = 'false-claim';
    evidence = verdict.claims.results
      .filter((r) => r.status === 'false')
      .map((r) => ({ label: `${r.id}: "${r.text}"`, detail: r.detail }));
  }
  verdict.outcome = cause ? 'dead' : verdict.claims.filed && verdict.claims.results.length ? 'alive' : 'no-claims';
  verdict.cause = cause;

  if (mode === 'precheck') {
    writeJson(path.join(p.dossier, 'precheck.json'), verdict);
    addEvent(arena, 'precheck', name, `${t.persona} ran a private precheck: ${verdict.acceptance.passed}/${verdict.acceptance.total} acceptance checks pass.`, {
      persona: t.persona,
      passed: verdict.acceptance.passed,
      total: verdict.acceptance.total,
    });
    saveArena(root, arena);
    return verdict;
  }

  writeJson(p.verdict, verdict);
  addEvent(
    arena,
    'verify',
    name,
    `${t.persona}: ${verdict.acceptance.passed}/${verdict.acceptance.total} acceptance checks, ${verdict.claims.verified} verified claim(s), ${verdict.claims.false} false.`,
    { persona: t.persona, passed: verdict.acceptance.passed, total: verdict.acceptance.total, verified: verdict.claims.verified, false: verdict.claims.false },
  );
  if (cause) kill(root, arena, name, cause, evidence);
  saveArena(root, arena);
  return verdict;
}

export async function accuse(root, accuser, { setup = true, dryRun = false } = {}) {
  const arena = loadArena(root);
  const t = team(arena, accuser);
  requireAlive(t, accuser);
  const p = teamPaths(root, accuser);
  const data = readJson(p.accusations);
  const errors = validateAccusations(data, { accuser, teams: Object.keys(arena.teams) });
  if (errors.length) throw new UserError(`accusations.json is invalid:\n- ${errors.join('\n- ')}`);
  const acceptance = loadAcceptance(root);
  fs.mkdirSync(p.probes, { recursive: true });

  const results = [];
  const targets = [...new Set(data.accusations.map((a) => a.against))];
  for (const target of targets) {
    const list = data.accusations.filter((a) => a.against === target);
    const tt = arena.teams[target];
    if (tt.status !== 'alive') {
      list.forEach((a) => results.push({ id: a.id, against: target, text: a.text, status: 'dismissed', detail: `${target} is already ${tt.status}` }));
      continue;
    }
    const head = G.revParse(root, tt.branch);
    await withCleanroom(root, `${accuser}-vs-${target}`, head, async (dir) => {
      if (setup) await runSetup(acceptance.setup, dir);
      for (const a of list) {
        const r = await runCheck(a.evidence, { dir, env: { SKILLSMITH_PROBES: p.probes } });
        const status = r.status === 'pass' ? 'upheld' : r.status === 'fail' ? 'false' : 'dismissed';
        results.push({ id: a.id, against: target, text: a.text, status, commit: head, detail: tail(scrub(r.detail, dir), 500) });
      }
    });
  }

  if (dryRun) {
    writeJson(path.join(p.dossier, 'accusations-dryrun.json'), { accuser, round: arena.round, at: now(), results });
    return { accuser, results, died: false, dryRun: true };
  }
  writeJson(path.join(p.dossier, 'accusations-verdict.json'), { accuser, round: arena.round, at: now(), results });
  for (const r of results) {
    const data = { persona: t.persona, target: arena.teams[r.against].persona, text: r.text };
    if (r.status === 'upheld') addEvent(arena, 'upheld', accuser, `${t.persona} proved a defect in ${data.target}: ${r.text}`, data);
    if (r.status === 'false') addEvent(arena, 'perjury', accuser, `${t.persona} accused ${data.target} without proof: ${r.text}`, data);
  }
  const perjury = results.filter((r) => r.status === 'false');
  if (perjury.length) {
    kill(root, arena, accuser, 'false-accusation', perjury.map((r) => ({ label: `${r.id} against ${r.against}: "${r.text}"`, detail: r.detail })));
  }
  saveArena(root, arena);
  return { accuser, results, died: perjury.length > 0 };
}

export function eliminate(root, name, reason) {
  if (!reason || reason === true) throw new UserError('Say why: --reason "..."', { code: 2 });
  const arena = loadArena(root);
  const t = team(arena, name);
  requireAlive(t, name);
  kill(root, arena, name, 'manual', [{ label: String(reason) }]);
  saveArena(root, arena);
}

const aliveTeams = (arena) => Object.entries(arena.teams).filter(([, t]) => t.status === 'alive').map(([n]) => n);

export function judge(root) {
  const arena = loadArena(root);
  const data = readJson(ssPath(root, 'judge.json'));
  const errors = validateJudge(data, aliveTeams(arena));
  if (!errors.length) {
    addEvent(arena, 'judge', null, `The auditor scored ${aliveTeams(arena).join(', ')} with evidence.`, { teams: aliveTeams(arena) });
    saveArena(root, arena);
  }
  return errors;
}

export function score(root) {
  const arena = loadArena(root);
  const judgeData = readJson(ssPath(root, 'judge.json'), null);
  const contenders = Object.entries(arena.teams).filter(([, t]) => t.status !== 'dead').map(([n]) => n);
  const judgeOk = judgeData && validateJudge(judgeData, contenders).length === 0;
  const accusationFiles = Object.keys(arena.teams)
    .map((n) => readJson(path.join(dossierDir(root, n), 'accusations-verdict.json'), null))
    .filter(Boolean);

  const rows = contenders.map((name) => {
    const t = arena.teams[name];
    const verdict = readJson(path.join(dossierDir(root, name), 'verdict.json'), null);
    const notes = [];
    let acceptancePts = 0;
    let claimPts = 0;
    if (verdict) {
      const { weightPassed, weightTotal } = verdict.acceptance;
      acceptancePts = weightTotal ? Math.round((SCORING.acceptance * weightPassed) / weightTotal) : 0;
      claimPts = Math.min(SCORING.claimsCap, verdict.claims.verified);
      if (t.status === 'alive' && G.branchExists(root, t.branch) && G.revParse(root, t.branch) !== verdict.commit) notes.push('code changed after verification');
    } else {
      notes.push('not verified yet');
    }
    const made = accusationFiles.filter((f) => f.accuser === name).flatMap((f) => f.results).filter((r) => r.status === 'upheld').length;
    const received = accusationFiles.flatMap((f) => f.results).filter((r) => r.against === name && r.status === 'upheld').length;
    const crossPlus = Math.min(SCORING.accusationBonusCap, SCORING.accusationBonus * made);
    const crossMinus = SCORING.accusationPenalty * received;
    const judgePts = judgeOk ? JUDGE_CRITERIA.reduce((s, c) => s + judgeData.scores[name][c].score, 0) : 0;
    if (!judgeOk) notes.push('no valid judge scores yet');
    const total = acceptancePts + claimPts + crossPlus - crossMinus + judgePts;
    return { team: name, persona: t.persona, status: t.status, acceptancePts, claimPts, crossPlus, crossMinus, judgePts, total, verified: Boolean(verdict), notes };
  });
  rows.sort((a, b) => b.total - a.total || b.judgePts - a.judgePts || b.acceptancePts - a.acceptancePts);

  const dead = Object.entries(arena.teams).filter(([, t]) => t.status === 'dead');
  const md = [
    '# Scoreboard',
    '',
    `Acceptance ${SCORING.acceptance} + verified claims up to ${SCORING.claimsCap} + proven accusations (+${SCORING.accusationBonus} each, up to ${SCORING.accusationBonusCap}) − defects proven against you (−${SCORING.accusationPenalty} each) + auditor up to ${SCORING.judgeMax}.`,
    '',
    '| # | Team | Manager | Acceptance | Claims | Accused others | Accused by others | Auditor | Total | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r, i) => `| ${i + 1} | ${r.team} | ${r.persona} | ${r.acceptancePts} | ${r.claimPts} | +${r.crossPlus} | −${r.crossMinus} | ${r.judgePts} | **${r.total}** | ${r.notes.join('; ')} |`),
    '',
    ...(dead.length ? ['Out of the game:', '', ...dead.map(([n, t]) => `- ${n} (${t.persona}): ${CAUSE_TEXT[t.cause] || t.cause}`), ''] : []),
  ];
  writeText(ssPath(root, 'scoreboard.md'), md.join('\n'));
  return { rows, judgeOk };
}

export function crown(root, requested, { force = false } = {}) {
  const arena = loadArena(root);
  if (arena.status !== 'running') throw new UserError(`The arena is ${arena.status}; nothing to crown.`);
  const { rows, judgeOk } = score(root);
  if (!rows.length) throw new UserError('No team is alive.', { hint: 'Start a new arena: `skillsmith arena init`.' });
  if (!judgeOk && !force) throw new UserError('The auditor has not scored every surviving team with evidence.', { hint: 'Write .skillsmith/judge.json and run `skillsmith arena judge`.' });
  const winner = requested || rows[0].team;
  const t = team(arena, winner);
  requireAlive(t, winner);
  const verdict = readJson(path.join(dossierDir(root, winner), 'verdict.json'), null);
  if (!verdict || verdict.outcome !== 'alive') throw new UserError(`Team ${winner} has no passing verification.`, { hint: `Run \`skillsmith arena verify ${winner}\`.` });
  if (G.revParse(root, t.branch) !== verdict.commit) throw new UserError(`Team ${winner} changed code after verification.`, { hint: `Verify again: \`skillsmith arena verify ${winner}\`.` });
  if (G.currentBranch(root) === 'HEAD') throw new UserError('The main checkout is on a detached HEAD; switch to your main branch first.');
  const stray = G.statusLines(root).filter((l) => !l.slice(3).startsWith('.skillsmith/'));
  if (stray.length) throw new UserError(`Uncommitted changes outside .skillsmith/ would mix with the winner:\n${stray.join('\n')}`, { hint: 'Commit or stash them first.' });

  for (const name of aliveTeams(arena).filter((n) => n !== winner)) {
    const other = arena.teams[name];
    G.removeWorktree(root, worktreeAbs(root, name));
    let retired = `skillsmith/retired/${name}`;
    if (G.branchExists(root, retired)) retired = `${retired}-${Date.now()}`;
    G.git(['branch', '-m', other.branch, retired], { cwd: root });
    other.status = 'retired';
    other.branch = retired;
    addEvent(arena, 'retire', name, `${other.persona} lost honestly. Branch kept as ${retired}.`, { persona: other.persona, branch: retired });
  }

  saveArena(root, arena);
  G.ensureIdentity(root);
  const commitRecords = (message) => {
    G.git(['add', '--', '.skillsmith'], { cwd: root });
    if (!G.git(['diff', '--cached', '--quiet'], { cwd: root, allowFail: true }).ok) {
      G.git(['commit', '-m', message, '--', '.skillsmith'], { cwd: root });
    }
  };
  commitRecords('skillsmith: arena records');

  G.removeWorktree(root, worktreeAbs(root, winner));
  const merge = G.git(['merge', '--no-ff', t.branch, '-m', `skillsmith: crown team ${winner} (${t.persona})`], { cwd: root, allowFail: true });
  if (!merge.ok) {
    G.git(['merge', '--abort'], { cwd: root, allowFail: true });
    throw new UserError(`Merging ${t.branch} failed: ${merge.err || merge.out}`, { hint: `Resolve by hand: git merge --no-ff ${t.branch}` });
  }
  G.git(['branch', '-d', t.branch], { cwd: root, allowFail: true });

  t.status = 'crowned';
  arena.status = 'crowned';
  arena.winner = winner;
  arena.crownedAt = now();
  addEvent(arena, 'crown', winner, `${t.persona} wins. Their work is merged.`, { persona: t.persona });
  saveArena(root, arena);
  const state = loadState(root);
  state.stages.arena = { status: 'done', doneAt: now() };
  saveState(root, state);
  commitRecords(`skillsmith: ${winner} crowned`);
  return { winner, persona: t.persona, rows };
}

export function arenaSummary(root) {
  const arena = loadArena(root);
  const teams = Object.entries(arena.teams).map(([name, t]) => {
    const verdict = readJson(path.join(dossierDir(root, name), 'verdict.json'), null);
    return {
      name,
      ...t,
      verdict: verdict
        ? { acceptance: `${verdict.acceptance.passed}/${verdict.acceptance.total}`, verified: verdict.claims.verified, false: verdict.claims.false, unverifiable: verdict.claims.unverifiable, at: verdict.at }
        : null,
    };
  });
  return { status: arena.status, round: arena.round, base: arena.base, winner: arena.winner, teams, events: arena.events };
}

export function nextRound(root) {
  const arena = loadArena(root);
  if (arena.status !== 'running') throw new UserError(`The arena is ${arena.status}.`);
  arena.round += 1;
  addEvent(arena, 'round', null, `Round ${arena.round} begins.`, { round: arena.round });
  saveArena(root, arena);
  return arena.round;
}
