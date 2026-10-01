#!/usr/bin/env node
// Skillsmith conveyor engine. Zero dependencies, Node 18+.
// Agents call it; it never takes an agent's word for anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { c, parseArgs, requireRoot, findRoot, ssPath, readJson, readText, exists, now, UserError, SS_DIR } from './lib/util.mjs';
import { STAGES, STAGE_IDS, newState, loadState, saveState, currentStage, runGate } from './lib/pipeline.mjs';
import { detectSlop } from './lib/slop.mjs';
import { validateSources, validateAcceptance } from './lib/artifacts.mjs';
import { verifyQuotes } from './lib/sources.mjs';
import { runCheck } from './lib/checks.mjs';
import * as G from './lib/git.mjs';
import * as A from './lib/arena.mjs';
import { writeReport, writeDashboard } from './lib/report.mjs';
import { sessionStart, preToolUse } from './lib/hooks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, '..', 'templates');
const VERSION = JSON.parse(fs.readFileSync(path.join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;

const HELP = `skillsmith ${VERSION}: idea in, verified product out.

Pipeline
  init [--name N] [--lang uk|en|...]     start a project in this folder
  status [--json]                        where the conveyor is, what is next
  gate <stage> [--from DIR]              check a station's output without moving on
  advance <stage> [--skip REASON]        pass the gate and mark the station done
                                         (research and hooks can be skipped on request)
  template <name>                        print a template (brief, research, sources,
                                         hooks, screenplay, acceptance, orders, claims,
                                         accusations, judge)
  doctor                                 check node, git and the project

Quality tools
  slop <file...> [--json] [--max-density N]   find AI-slop phrases (en/uk/ru)
  sources check [FILE]                   validate 02-sources.json
  sources verify [FILE]                  fetch every verified source, look for the quote
  acceptance check [FILE]                validate 04-acceptance.json
  verify --acceptance FILE [--dir DIR] [--setup]
                                         run acceptance checks in a folder

Arena
  arena init [--teams a,b,c | --count N] [--force]
  arena status [--json]
  arena paths <team>                     worktree, dossier and claim file locations
  arena precheck <team> [--no-setup]     private dry run: nothing is recorded, nobody dies
  arena verify <team> [--no-setup]       official check; a false claim or tampering kills
  arena accuse <team> [--dry-run]        run the team's accusations; perjury kills
                                         (--dry-run: private test, nothing recorded)
  arena eliminate <team> --reason TEXT
  arena judge                            validate the auditor's judge.json
  arena score [--json]
  arena round                            start the next round
  arena crown [team] [--force]           merge the winner, retire honest losers

Output
  report                                 write .skillsmith/REPORT.md
  dashboard [--out FILE]                 write .skillsmith/dashboard.html
`;

const print = (s = '') => process.stdout.write(`${s}\n`);
const json = (data) => print(JSON.stringify(data, null, 2));
const mark = { pass: c.green('✔'), fail: c.red('✘'), error: c.yellow('!'), unsafe: c.yellow('⛔'), unverifiable: c.dim('?') };

function printList(items, color = (s) => s) {
  for (const it of items) print(`  - ${color(it)}`);
}

function printStatus(root) {
  const state = loadState(root);
  const cur = currentStage(state);
  print(`${c.bold(state.project)}  ${c.dim(root)}`);
  STAGES.forEach((s, i) => {
    const done = state.stages[s.id]?.status === 'done';
    const icon = done ? c.green('✔') : cur?.id === s.id ? c.yellow('▶') : c.dim('·');
    print(`  ${icon} ${i + 1}. ${s.title.padEnd(11)} ${c.dim(s.crew)}`);
  });
  const arena = A.loadArena(root, { required: false });
  if (arena) {
    print(`\n  Arena: ${arena.status}, round ${arena.round}`);
    for (const [n, t] of Object.entries(arena.teams)) print(`    ${n.padEnd(8)} ${t.persona.padEnd(9)} ${t.status}`);
  }
  print(cur ? `\nNext: ${c.bold(`/skillsmith:${cur.id === 'interview' ? 'start' : cur.id}`)} (${cur.title.toLowerCase()} station)` : `\n${c.green('All stations are done.')}`);
}

function printGate(result) {
  if (result.ok) print(`${c.green('✔')} ${result.stage} gate passed`);
  else {
    print(`${c.red('✘')} ${result.stage} gate failed:`);
    printList(result.errors, c.red);
  }
  if (result.warnings.length) {
    print(c.yellow('  warnings:'));
    printList(result.warnings, c.yellow);
  }
}

function printChecks(results, label) {
  for (const r of results) {
    print(`  ${mark[r.status] || mark[r.check] || '·'} ${r.id ? `${r.id} ` : ''}${label ? label(r) : ''}`);
    if (r.status !== 'pass' && r.status !== 'verified' && r.detail) print(c.dim(r.detail.split('\n').map((l) => `      ${l}`).join('\n')));
  }
}

function printVerdict(v) {
  print(`${c.bold(`${v.team} (${v.persona})`)} ${v.mode} at ${v.commit.slice(0, 8)}: ${v.commits} commit(s) since the arena opened`);
  if (v.uncommitted) print(c.yellow(`  ${v.uncommitted} uncommitted change(s) in the worktree were NOT judged. Commit them.`));
  if (v.tampered.length) {
    print(c.red('  Protected files changed:'));
    printList(v.tampered, c.red);
  }
  if (v.setup.length) printChecks(v.setup.map((s) => ({ ...s, id: 'setup' })), (r) => r.run);
  print(`  Acceptance ${v.acceptance.passed}/${v.acceptance.total}:`);
  printChecks(v.acceptance.results, (r) => r.title);
  if (v.claims.errors.length) printList(v.claims.errors.map((e) => `claims: ${e}`), c.yellow);
  if (v.claims.results.length) {
    print(`  Claims: ${v.claims.verified} verified, ${v.claims.false} false, ${v.claims.unverifiable} without proof`);
    printChecks(
      v.claims.results.map((r) => ({ ...r, status: r.status === 'verified' ? 'pass' : r.status === 'false' ? 'fail' : 'unverifiable' })),
      (r) => r.text,
    );
  }
  const outcome = { alive: c.green('ALIVE'), dead: c.red(`DEAD (${v.cause})`), 'no-claims': c.yellow('NO CLAIMS FILED') }[v.outcome];
  print(`  Outcome: ${v.mode === 'precheck' ? c.dim('(precheck) ') : ''}${outcome}`);
  if (v.mode === 'precheck' && v.outcome === 'dead') print(c.yellow('  An official verify would eliminate this team. Fix the work or withdraw the claim.'));
  if (v.mode === 'verify' && v.outcome === 'dead') print(c.red('  Worktree and branch deleted. The evidence is in .skillsmith/graveyard.md'));
  if (v.outcome === 'no-claims') print(c.yellow(`  File claims at .skillsmith/teams/${v.team}/claims.json, then verify again.`));
}

async function readStdin() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

const commands = {
  help() {
    print(HELP);
  },

  version() {
    print(VERSION);
  },

  init({ flags }) {
    const dir = path.resolve(flags.dir || process.cwd());
    if (exists(path.join(dir, SS_DIR, 'state.json'))) {
      print(c.yellow('This folder is already a Skillsmith project.'));
      printStatus(dir);
      return;
    }
    fs.mkdirSync(path.join(dir, SS_DIR), { recursive: true });
    const project = typeof flags.name === 'string' ? flags.name : path.basename(dir);
    saveState(dir, newState({ project, language: typeof flags.lang === 'string' ? flags.lang : 'auto' }));
    const notes = [];
    if (G.hasGit()) {
      if (!G.isRepo(dir)) {
        G.git(['init'], { cwd: dir });
        notes.push('created a git repository (git keeps every version of your project)');
      }
      const added = G.ensureIdentity(dir);
      if (added.length) notes.push(`set a local git name for this project (${added.join(', ')})`);
    } else {
      notes.push(c.yellow('git is not installed; the arena needs it. Get it at https://git-scm.com'));
    }
    print(`${c.green('✔')} Skillsmith project "${project}" created in ${dir}`);
    printList(notes);
    print(`Next: the interview. Run ${c.bold('/skillsmith:start')}`);
  },

  status({ flags }) {
    const root = requireRoot(flags);
    if (flags.json) {
      const state = loadState(root);
      json({ root, state, current: currentStage(state)?.id ?? null, arena: A.loadArena(root, { required: false }) ? A.arenaSummary(root) : null });
      return;
    }
    printStatus(root);
  },

  gate({ positional, flags }) {
    const root = flags.from ? findRoot() || process.cwd() : requireRoot(flags);
    const result = runGate(root, positional[0], { from: flags.from });
    if (flags.json) json(result);
    else printGate(result);
    if (!result.ok) process.exitCode = 1;
  },

  advance({ positional, flags }) {
    const root = requireRoot(flags);
    const stage = positional[0];
    if (!STAGE_IDS.includes(stage)) throw new UserError(`Usage: advance <${STAGE_IDS.join('|')}>`, { code: 2 });
    const state = loadState(root);
    const idx = STAGE_IDS.indexOf(stage);
    const blocked = STAGE_IDS.slice(0, idx).filter((s) => state.stages[s]?.status !== 'done');
    if (blocked.length) throw new UserError(`Earlier stations are not done: ${blocked.join(', ')}`);
    if (flags.skip !== undefined) {
      if (!SKIPPABLE.includes(stage)) throw new UserError(`Only ${SKIPPABLE.join(' and ')} can be skipped; the arena needs the brief and the screenplay.`, { code: 2 });
      if (typeof flags.skip !== 'string' || !flags.skip.trim()) throw new UserError('Say why the client chose to skip: --skip "reason"', { code: 2 });
      state.stages[stage] = { status: 'done', skipped: true, reason: flags.skip, doneAt: now() };
      saveState(root, state);
      print(c.yellow(`${stage} skipped at the client's request: ${flags.skip}`));
      const after = currentStage(state);
      print(after ? `Next station: ${c.bold(after.title)} (${after.crew}).` : c.green('All stations are done.'));
      return;
    }
    const result = runGate(root, stage);
    printGate(result);
    if (!result.ok) {
      process.exitCode = 1;
      return;
    }
    state.stages[stage] = { status: 'done', doneAt: now() };
    saveState(root, state);
    const next = currentStage(state);
    print(next ? `Next station: ${c.bold(next.title)} (${next.crew}).` : c.green('All stations are done.'));
  },

  template({ positional }) {
    const name = positional[0];
    const files = fs.readdirSync(TEMPLATES);
    const file = files.find((f) => f.replace(/\.[^.]+$/, '') === name);
    if (!file) throw new UserError(`No template "${name}". Available: ${files.map((f) => f.replace(/\.[^.]+$/, '')).join(', ')}`, { code: 2 });
    process.stdout.write(readText(path.join(TEMPLATES, file)));
  },

  doctor({ flags }) {
    const rows = [];
    const major = Number(process.versions.node.split('.')[0]);
    rows.push([major >= 18, `Node.js ${process.versions.node}`, major >= 18 ? '' : 'Skillsmith needs Node 18 or newer: https://nodejs.org']);
    const gitOk = G.hasGit();
    rows.push([gitOk, 'git', gitOk ? '' : 'Install git: https://git-scm.com']);
    const root = flags.dir ? path.resolve(flags.dir) : findRoot();
    rows.push([Boolean(root), 'Skillsmith project', root ? root : 'not in a project yet: run `skillsmith init`']);
    if (root && gitOk) rows.push([G.isRepo(root), 'git repository', G.isRepo(root) ? '' : 'run `git init` or `skillsmith init`']);
    for (const [ok, what, note] of rows) print(`  ${ok ? c.green('✔') : c.red('✘')} ${what}${note ? c.dim(`  ${note}`) : ''}`);
    if (rows.some(([ok]) => !ok)) process.exitCode = 1;
  },

  slop({ positional, flags }) {
    if (!positional.length) throw new UserError('Usage: slop <file...>', { code: 2 });
    const maxDensity = flags['max-density'] ? Number(flags['max-density']) : undefined;
    const all = positional.map((f) => ({ file: f, ...detectSlop(readText(f), maxDensity ? { maxDensity } : {}) }));
    if (flags.json) json(all);
    else {
      for (const r of all) {
        print(`${r.pass ? c.green('✔') : c.red('✘')} ${r.file}: ${r.findings.length} finding(s), density ${r.density}/${r.maxDensity}, ${r.words} words`);
        for (const f of r.findings) print(`  ${f.line ? `${r.file}:${f.line}:${f.col}` : r.file} ${f.weight >= 3 ? c.red(`[${f.weight}]`) : c.yellow(`[${f.weight}]`)} "${f.match}"  ${c.dim(f.hint)}`);
      }
    }
    if (all.some((r) => !r.pass)) process.exitCode = 1;
  },

  async sources({ positional, flags }) {
    const [sub, fileArg] = positional;
    const file = fileArg || ssPath(requireRoot(flags), '02-sources.json');
    const data = readJson(file);
    if (sub === 'check') {
      const v = validateSources(data);
      if (flags.json) json(v);
      else {
        print(`${v.errors.length ? c.red('✘') : c.green('✔')} ${v.verified.length} verified source(s)`);
        printList(v.errors, c.red);
        printList(v.warnings, c.yellow);
      }
      if (v.errors.length) process.exitCode = 1;
      return;
    }
    if (sub === 'verify') {
      const results = await verifyQuotes(data);
      if (flags.json) json(results);
      else {
        const icon = { confirmed: c.green('✔'), partial: c.yellow('≈'), 'not-found': c.red('✘'), unreachable: c.dim('?') };
        for (const r of results) print(`  ${icon[r.status]} ${r.id} ${r.status}  ${c.dim(r.url)}${r.detail ? `\n      ${c.dim(r.detail)}` : ''}`);
        print(c.dim('confirmed = quote found; partial = most of it found; unreachable = could not load the page (not proof of anything)'));
      }
      if (results.some((r) => r.status === 'not-found')) process.exitCode = 1;
      return;
    }
    throw new UserError('Usage: sources check|verify [file]', { code: 2 });
  },

  acceptance({ positional, flags }) {
    if (positional[0] !== 'check') throw new UserError('Usage: acceptance check [file]', { code: 2 });
    const file = positional[1] || ssPath(requireRoot(flags), '04-acceptance.json');
    const v = validateAcceptance(readJson(file));
    print(`${v.errors.length ? c.red('✘') : c.green('✔')} ${v.ids.length} acceptance check(s)`);
    printList(v.errors, c.red);
    if (v.errors.length) process.exitCode = 1;
  },

  async verify({ flags }) {
    if (typeof flags.acceptance !== 'string') throw new UserError('Usage: verify --acceptance FILE [--dir DIR] [--setup]', { code: 2 });
    const data = readJson(flags.acceptance);
    const v = validateAcceptance(data);
    if (v.errors.length) throw new UserError(`Invalid acceptance file:\n- ${v.errors.join('\n- ')}`);
    const dir = path.resolve(typeof flags.dir === 'string' ? flags.dir : process.cwd());
    const results = [];
    if (flags.setup) {
      for (const run of data.setup || []) {
        const r = await runCheck({ type: 'command', run, timeout: 900 }, { dir });
        results.push({ id: 'setup', title: run, ...r });
        if (r.status !== 'pass') break;
      }
    }
    for (const check of data.checks) results.push({ id: check.id, title: check.title, ...(await runCheck(check, { dir })) });
    if (flags.json) json(results);
    else printChecks(results, (r) => r.title);
    const failed = results.filter((r) => r.status !== 'pass');
    print(failed.length ? c.red(`${failed.length} of ${results.length} did not pass`) : c.green(`All ${results.length} passed`));
    if (failed.length) process.exitCode = 1;
  },

  async arena({ positional, flags }) {
    const [sub, name] = positional;
    const root = requireRoot(flags);
    const setup = !flags['no-setup'];
    switch (sub) {
      case 'init': {
        const teams = typeof flags.teams === 'string' ? flags.teams.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
        const { arena, identity, strayChanges, paths } = A.arenaInit(root, { teams, count: flags.count, force: Boolean(flags.force), templatesDir: TEMPLATES });
        if (identity.length) print(c.dim(`set a local git identity for this project (${identity.join(', ')})`));
        if (strayChanges.length) print(c.yellow(`Uncommitted files outside .skillsmith/ are not in the teams' copies:\n${strayChanges.join('\n')}`));
        print(`${c.green('✔')} Arena open. Base commit ${arena.base.slice(0, 8)}. Protected: ${arena.protected.join(', ')}`);
        for (const p of paths) {
          const t = arena.teams[p.team];
          print(`\n  ${c.bold(p.team)} (${t.persona}): ${t.motto}`);
          print(`    worktree  ${p.worktree}`);
          print(`    orders    ${p.orders}`);
          print(`    claims    ${p.claims}`);
        }
        return;
      }
      case 'status': {
        const s = A.arenaSummary(root);
        if (flags.json) return json(s);
        print(`Arena ${s.status}, round ${s.round}${s.winner ? `, winner ${s.winner}` : ''}`);
        for (const t of s.teams) {
          print(`  ${t.name.padEnd(8)} ${t.persona.padEnd(9)} ${t.status.padEnd(8)} ${t.verdict ? `acceptance ${t.verdict.acceptance}, claims ✔${t.verdict.verified} ✘${t.verdict.false} ?${t.verdict.unverifiable}` : c.dim('not verified')}`);
        }
        print(c.dim(`\nLast events:`));
        for (const e of s.events.slice(-6)) print(c.dim(`  ${e.at.slice(11, 16)} ${e.detail}`));
        return;
      }
      case 'paths': {
        if (!name) throw new UserError('Usage: arena paths <team>', { code: 2 });
        A.loadArena(root);
        return json(A.teamPaths(root, name));
      }
      case 'precheck':
      case 'verify': {
        if (!name) throw new UserError(`Usage: arena ${sub} <team>`, { code: 2 });
        const v = await A.trial(root, name, { mode: sub, setup });
        if (flags.json) json(v);
        else printVerdict(v);
        if (v.outcome !== 'alive') process.exitCode = 1;
        return;
      }
      case 'accuse': {
        if (!name) throw new UserError('Usage: arena accuse <team>', { code: 2 });
        const r = await A.accuse(root, name, { setup, dryRun: Boolean(flags['dry-run']) });
        if (flags.json) return json(r);
        if (r.dryRun) print(c.dim('Dry run: nothing recorded, nobody dies. "false" here means the official run would eliminate the accuser.'));
        for (const x of r.results) {
          const icon = { upheld: c.green('⚔ upheld'), false: c.red('✘ false'), dismissed: c.dim('· dismissed') }[x.status];
          print(`  ${icon}  ${x.id} vs ${x.against}: ${x.text}`);
          if (x.status !== 'upheld' && x.detail) print(c.dim(x.detail.split('\n').map((l) => `      ${l}`).join('\n')));
        }
        if (r.died) {
          print(c.red(`${name} accused without proof and is eliminated.`));
          process.exitCode = 1;
        }
        return;
      }
      case 'eliminate': {
        if (!name) throw new UserError('Usage: arena eliminate <team> --reason "..."', { code: 2 });
        A.eliminate(root, name, flags.reason);
        print(c.red(`${name} eliminated.`));
        return;
      }
      case 'judge': {
        const errors = A.judge(root);
        if (errors.length) {
          print(c.red('✘ judge.json is not acceptable:'));
          printList(errors, c.red);
          process.exitCode = 1;
        } else print(`${c.green('✔')} judge scores accepted`);
        return;
      }
      case 'score': {
        const { rows, judgeOk } = A.score(root);
        if (flags.json) return json({ rows, judgeOk });
        print(readText(ssPath(root, 'scoreboard.md')));
        return;
      }
      case 'round': {
        print(`Round ${A.nextRound(root)} started.`);
        return;
      }
      case 'crown': {
        const r = A.crown(root, name, { force: Boolean(flags.force) });
        print(`${c.green('♛')} ${r.winner} (${r.persona}) wins. Their work is merged into your project.`);
        return;
      }
      default:
        throw new UserError('Usage: arena init|status|paths|precheck|verify|accuse|eliminate|judge|score|round|crown', { code: 2 });
    }
  },

  report({ flags }) {
    const root = requireRoot(flags);
    print(`${c.green('✔')} ${writeReport(root)}`);
  },

  dashboard({ flags }) {
    const root = requireRoot(flags);
    print(`${c.green('✔')} ${writeDashboard(root, typeof flags.out === 'string' ? flags.out : undefined)}`);
  },

  async hook({ positional }) {
    try {
      const input = await readStdin();
      const out = positional[0] === 'session-start' ? sessionStart(input) : positional[0] === 'pre-tool-use' ? preToolUse(input) : null;
      if (out) process.stdout.write(JSON.stringify(out));
    } catch {
      // A hook must never block the session because of its own bug.
    }
  },
};

const SKIPPABLE = ['research', 'hooks'];

const ALIASES = { '--help': 'help', '-h': 'help', '--version': 'version', '-v': 'version' };

async function main() {
  const [cmdRaw, ...rest] = process.argv.slice(2);
  const cmd = ALIASES[cmdRaw] || cmdRaw || 'help';
  const handler = commands[cmd];
  if (!handler) {
    process.stderr.write(`Unknown command "${cmd}".\n\n${HELP}`);
    process.exitCode = 2;
    return;
  }
  const args = parseArgs(rest);
  if (args.flags.help) return commands.help();
  await handler(args);
}

main().catch((err) => {
  if (err instanceof UserError) {
    process.stderr.write(`${c.red('✘')} ${err.message}\n${err.hint ? `  ${err.hint}\n` : ''}`);
    process.exitCode = err.code || 1;
  } else {
    process.stderr.write(`${c.red('Unexpected error:')} ${err.stack || err.message}\n`);
    process.exitCode = 3;
  }
});
