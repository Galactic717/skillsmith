import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';
import {EXIT} from '../src/core/errors.js';
import {projectStorePath, recordPath} from '../src/core/paths.js';
import {preToolUse, sessionStart, stopGuard} from '../src/hooks/handlers.js';
import {briefText, hooksText, sourcesData} from './fixtures.js';
import {PLUGIN_ROOT, sandbox, write, writeJsonFile} from './helpers.js';

function storeOf(box: {dir: string; env: NodeJS.ProcessEnv}): string {
  const state = JSON.parse(fs.readFileSync(recordPath(box.dir, 'state.json'), 'utf8')) as {
    projectId: string;
  };
  return projectStorePath(box.env, state.projectId);
}

describe('cli', () => {
  it('prints help, version and usage errors', async () => {
    const box = sandbox();
    assert.match((await box.cli([])).out, /your idea in, a verified product out/);
    assert.match((await box.cli(['--version'])).out, /^\d+\.\d+\.\d+$/);
    assert.match((await box.cli(['status', '--help'])).out, /Pipeline/);
    const unknown = await box.cli(['fly']);
    assert.equal(unknown.code, EXIT.usage);
    const noProject = await box.cli(['status']);
    assert.equal(noProject.code, EXIT.usage);
    assert.match(noProject.err, /No Skillsmith project here/);
    assert.equal((await box.cli(['gate', 'nope', '--from', '.'])).code, EXIT.usage);
    assert.equal((await box.cli(['slop'])).code, EXIT.usage);
    assert.equal((await box.cli(['verify'])).code, EXIT.usage);
  });

  it('creates a project, reports status and refuses out-of-order stations', async () => {
    const box = sandbox();
    const init = await box.cli(['init', '--name', 'TrialGuard']);
    assert.equal(init.code, EXIT.ok);
    assert.match(init.out, /created a git repository/);
    assert.match((await box.cli(['init'])).out, /already a Skillsmith project/);
    assert.match(
      fs.readFileSync(path.join(box.dir, '.gitignore'), 'utf8'),
      /\.skillsmith\/holdout\.json/,
    );
    const status = JSON.parse((await box.cli(['status', '--json'])).out) as {
      current: string;
      ledger: {ok: boolean; entries: number};
    };
    assert.equal(status.current, 'interview');
    assert.deepEqual(status.ledger, {ok: true, entries: 1});
    assert.match((await box.cli(['status'])).out, /Next: \/skillsmith:interview/);
    assert.equal((await box.cli(['advance', 'hooks'])).code, EXIT.usage);
    assert.equal((await box.cli(['advance', 'interview', '--skip', 'no time'])).code, EXIT.usage);
    assert.equal((await box.cli(['gate', 'interview'])).code, EXIT.failed);
    write(recordPath(box.dir, '01-brief.md'), briefText());
    assert.equal((await box.cli(['advance', 'interview'])).code, EXIT.ok);
    assert.equal(
      (await box.cli(['advance', 'research', '--skip', 'Founder already knows the market'])).code,
      EXIT.ok,
    );
    assert.match((await box.cli(['status'])).out, /skipped: Founder already knows the market/);
    write(recordPath(box.dir, '01-brief.md'), `${briefText()}\nEdited later.`);
    assert.match(
      (await box.cli(['status'])).out,
      /Edited after approval: \.skillsmith\/01-brief\.md/,
    );
    assert.equal((await box.cli(['doctor'])).code, EXIT.failed);
    const brief = JSON.parse((await box.cli(['brief', '--json'])).out) as {
      verdict: string;
      requirements: unknown[];
    };
    assert.equal(brief.verdict, 'HARDENED');
    assert.equal(brief.requirements.length, 3);
    assert.match((await box.cli(['brief'])).out, /Core flow/);
  });

  it('runs the quality tools', async () => {
    const box = sandbox();
    await box.cli(['init']);
    write(
      path.join(box.dir, 'copy.md'),
      'Buckle up: this game-changer will delve into your trials.',
    );
    const slop = await box.cli(['slop', 'copy.md']);
    assert.equal(slop.code, EXIT.failed);
    assert.match(slop.out, /buckle up/i);
    const slopJson = JSON.parse((await box.cli(['slop', 'copy.md', '--json'])).out) as unknown[];
    assert.equal(slopJson.length, 1);
    writeJsonFile(recordPath(box.dir, '02-sources.json'), sourcesData());
    assert.equal((await box.cli(['sources', 'check'])).code, EXIT.ok);
    assert.equal((await box.cli(['sources', 'nope'])).code, EXIT.usage);
    write(recordPath(box.dir, '03-hooks.md'), hooksText());
    const gate = await box.cli(['gate', 'hooks', '--json']);
    assert.equal(gate.code, EXIT.ok);
    assert.equal((JSON.parse(gate.out) as {ok: boolean}).ok, true);
    assert.match((await box.cli(['template', 'brief'])).out, /ss:coverage/);
    assert.equal((await box.cli(['template', 'nope'])).code, EXIT.usage);
    const acceptance = path.join(PLUGIN_ROOT, 'templates', 'acceptance.json');
    assert.equal((await box.cli(['acceptance', 'check', acceptance])).code, EXIT.ok);
    assert.equal((await box.cli(['acceptance', 'nope'])).code, EXIT.usage);
    write(path.join(box.dir, 'README.md'), 'Run: npm run start');
    const verify = await box.cli(['verify', '--acceptance', acceptance, '--json']);
    assert.equal(verify.code, EXIT.failed);
    assert.equal(
      (JSON.parse(verify.out.split('\n').slice(0, -1).join('\n')) as unknown[]).length,
      4,
    );
    write(path.join(box.dir, 'src', 'pay.js'), `const k = "sk_live_${'b'.repeat(24)}";`);
    const safety = await box.cli(['safety']);
    assert.equal(safety.code, EXIT.failed);
    assert.match(safety.out, /Stripe live key/);
    assert.equal((await box.cli(['holdout', 'status'])).out, 'No hidden checks sealed.');
    assert.equal((await box.cli(['holdout', 'nope'])).code, EXIT.usage);
    assert.equal((await box.cli(['ledger', 'nope'])).code, EXIT.usage);
    assert.equal((await box.cli(['arena', 'status'])).code, EXIT.failed);
    assert.equal((await box.cli(['arena', 'nope'])).code, EXIT.usage);
    assert.equal((await box.cli(['report'])).code, EXIT.ok);
    assert.equal((await box.cli(['dashboard', '--out', 'out.html'])).code, EXIT.ok);
    assert.match(
      fs.readFileSync(path.join(box.dir, 'out.html'), 'utf8'),
      /The arena opens after the screenplay/,
    );
  });

  it('runs the compiled entry point as a real process', () => {
    const entry = path.join(PLUGIN_ROOT, 'engine', 'skillsmith.js');
    const version = spawnSync(process.execPath, [entry, 'version'], {encoding: 'utf8'});
    assert.equal(version.status, 0);
    assert.match(version.stdout, /^\d+\.\d+\.\d+/);
    const hook = spawnSync(process.execPath, [entry, 'hook', 'session-start'], {
      input: '{"cwd": "/"}',
      encoding: 'utf8',
    });
    assert.equal(hook.status, 0);
    assert.equal(hook.stdout, '');
  });
});

describe('hooks', () => {
  it('gives session context and stays silent outside projects', async () => {
    const box = sandbox();
    assert.equal(sessionStart({cwd: box.dir}, box.env), undefined);
    await box.cli(['init', '--name', 'TrialGuard']);
    const output = sessionStart({cwd: box.dir}, box.env) as {
      hookSpecificOutput: {additionalContext: string};
    };
    assert.match(output.hookSpecificOutput.additionalContext, /TrialGuard.*Interview/);
    const viaCli = await box.cli(['hook', 'session-start'], JSON.stringify({cwd: box.dir}));
    assert.match(viaCli.out, /additionalContext/);
    assert.equal((await box.cli(['hook', 'pre-tool-use'], 'not json')).out, '');
  });

  it('guards records, the private store and the shell', async () => {
    const box = sandbox();
    await box.cli(['init']);
    const store = storeOf(box);
    const decision = (input: Record<string, unknown>): string | undefined => {
      const output = preToolUse({cwd: box.dir, ...input}, box.env) as
        {hookSpecificOutput?: {permissionDecision: string}} | undefined;
      return output?.hookSpecificOutput?.permissionDecision;
    };
    assert.equal(
      decision({tool_name: 'Write', tool_input: {file_path: '.skillsmith/state.json'}}),
      'deny',
    );
    assert.equal(
      decision({tool_name: 'Edit', tool_input: {file_path: '.skillsmith/ledger.jsonl'}}),
      'deny',
    );
    assert.equal(
      decision({tool_name: 'Write', tool_input: {file_path: '.skillsmith/01-brief.md'}}),
      undefined,
    );
    assert.equal(
      decision({tool_name: 'Read', tool_input: {file_path: path.join(store, 'holdout.json')}}),
      'deny',
    );
    assert.equal(decision({tool_name: 'Grep', tool_input: {path: store}}), 'deny');
    assert.equal(decision({tool_name: 'Read', tool_input: {file_path: 'README.md'}}), undefined);
    assert.equal(
      decision({tool_name: 'Bash', tool_input: {command: `cat ${store}/ledger.key`}}),
      'deny',
    );
    assert.equal(
      decision({
        tool_name: 'Bash',
        tool_input: {command: 'echo {} > .skillsmith/teams/a/verdict.json'},
      }),
      'deny',
    );
    assert.equal(
      decision({tool_name: 'Bash', tool_input: {command: 'cat .skillsmith/arena.json'}}),
      undefined,
    );
    assert.equal(decision({tool_name: 'Bash', tool_input: {}}), undefined);
    assert.equal(decision({tool_name: 'Write', tool_input: {}}), undefined);
    assert.equal(
      preToolUse({cwd: '/', tool_name: 'Write', tool_input: {file_path: '/tmp/x'}}, box.env),
      undefined,
    );
  });

  it('freezes protected files while the arena runs and blocks a stop with unverified claims', async () => {
    const box = sandbox();
    await box.cli(['init']);
    writeJsonFile(recordPath(box.dir, '04-acceptance.json'), {
      setup: [],
      protected: ['tests/acceptance/**'],
      checks: [1, 2, 3].map(index => ({
        id: `A${index}`,
        title: 't',
        covers: ['R1'],
        type: 'file_exists',
        path: `f${index}`,
      })),
    });
    write(path.join(box.dir, 'tests', 'acceptance', 'a.mjs'), '');
    write(path.join(box.dir, 'README.md'), '');
    const {commitAll} = await import('./helpers.js');
    commitAll(box.dir, 'start');
    assert.equal((await box.cli(['arena', 'init', '--teams', 'alpha', '--force'])).code, EXIT.ok);
    const decision = (file: string, tool = 'Write'): string | undefined =>
      (
        preToolUse({cwd: box.dir, tool_name: tool, tool_input: {file_path: file}}, box.env) as
          {hookSpecificOutput?: {permissionDecision: string}} | undefined
      )?.hookSpecificOutput?.permissionDecision;
    assert.equal(decision('.skillsmith/arena/alpha/tests/acceptance/a.mjs'), 'deny');
    assert.equal(decision('.skillsmith/arena/alpha/src/app.mjs'), undefined);
    assert.equal(decision('.skillsmith/04-acceptance.json'), 'deny');
    assert.equal(decision('tests/acceptance/a.mjs'), 'deny');
    assert.equal(decision('.skillsmith/holdout.json', 'Read'), 'deny');
    assert.equal(stopGuard({cwd: box.dir}, box.env), undefined);
    writeJsonFile(recordPath(box.dir, 'teams', 'alpha', 'claims.json'), {claims: []});
    const blocked = stopGuard({cwd: box.dir}, box.env) as {decision: string; reason: string};
    assert.equal(blocked.decision, 'block');
    assert.match(blocked.reason, /arena verify alpha/);
    assert.equal(stopGuard({cwd: box.dir, stop_hook_active: true}, box.env), undefined);
    const session = sessionStart({cwd: box.dir}, box.env) as {
      hookSpecificOutput: {additionalContext: string};
    };
    assert.match(session.hookSpecificOutput.additionalContext, /Arena round 1 is running/);
  });
});
