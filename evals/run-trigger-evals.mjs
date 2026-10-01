#!/usr/bin/env node
// Live trigger evals: runs each query through headless Claude Code with the
// plugin loaded and records whether the Skillsmith skill was invoked.
//   node evals/run-trigger-evals.mjs [--parallel N] [--split train|test]
// Needs the `claude` CLI, logged in. Each query is a real model call.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(ROOT, 'plugins', 'skillsmith');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'triggers.json'), 'utf8'));
const args = process.argv.slice(2);
const parallel = Number(args.includes('--parallel') ? args[args.indexOf('--parallel') + 1] : 4);
const split = args.includes('--split') ? args[args.indexOf('--split') + 1] : undefined;
const TIMEOUT_MS = 180_000;

/** Runs one query; resolves with whether a Skillsmith skill was invoked. */
function runQuery(query) {
  return new Promise(resolve => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skillsmith-eval-'));
    const child = spawn(
      'claude',
      [
        '-p',
        query,
        '--plugin-dir',
        PLUGIN,
        '--output-format',
        'stream-json',
        '--verbose',
        '--permission-mode',
        'default',
      ],
      {cwd, stdio: ['ignore', 'pipe', 'pipe']},
    );
    let buffer = '';
    let skill;
    let firstTool;
    const finish = reason => {
      clearTimeout(timer);
      child.kill('SIGKILL');
      fs.rmSync(cwd, {recursive: true, force: true});
      resolve({
        triggered: Boolean(skill && skill.startsWith('skillsmith')),
        skill,
        firstTool,
        reason,
      });
    };
    const timer = setTimeout(() => finish('timeout'), TIMEOUT_MS);
    child.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        const blocks = event?.message?.content;
        if (event.type === 'assistant' && Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block.type !== 'tool_use') continue;
            firstTool ??= block.name;
            if (block.name === 'Skill') {
              skill = String(block.input?.skill ?? block.input?.command ?? '');
              return finish('skill');
            }
          }
          // The first tool call that is not a skill means the model chose to work without one.
          if (firstTool) return finish('other-tool');
        }
        if (event.type === 'result') return finish('result');
      }
    });
    child.on('close', () => finish('closed'));
  });
}

const queries = spec.queries.filter(item => !split || item.split === split);
const results = new Array(queries.length);
let next = 0;
await Promise.all(
  Array.from({length: Math.min(parallel, queries.length)}, async () => {
    while (next < queries.length) {
      const index = next++;
      const item = queries[index];
      const outcome = await runQuery(item.q);
      results[index] = {...item, ...outcome, pass: outcome.triggered === item.expect};
      process.stdout.write(
        `${results[index].pass ? 'pass' : 'FAIL'}  expect=${item.expect} triggered=${outcome.triggered} (${outcome.reason}${outcome.skill ? `: ${outcome.skill}` : ''})  ${item.q.slice(0, 70)}\n`,
      );
    }
  }),
);

const summary = {};
for (const name of ['train', 'test']) {
  const rows = results.filter(row => row.split === name);
  if (rows.length) summary[name] = `${rows.filter(row => row.pass).length}/${rows.length}`;
}
const outDir = path.join(ROOT, 'evals', 'results');
fs.mkdirSync(outDir, {recursive: true});
const file = path.join(outDir, `triggers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, `${JSON.stringify({skill: spec.skill, summary, results}, null, 2)}\n`);
console.log(
  `\ntrain ${summary.train ?? '-'}  test ${summary.test ?? '-'}  ->  ${path.relative(ROOT, file)}`,
);
process.exitCode = results.every(row => row.pass) ? 0 : 1;
