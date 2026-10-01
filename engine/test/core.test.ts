import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';
import {parseArgs} from '../src/cli/args.js';
import {IntegrityError, UsageError} from '../src/core/errors.js';
import {isBinary, readJson, readText, resolveInside, walkFiles, writeJson} from '../src/core/fs.js';
import {globToRegExp, matchAny, matchGlob} from '../src/core/glob.js';
import {canonicalJson, isRecord, isTextList, unknownKeys} from '../src/core/json.js';
import {
  appendLedger,
  assertRecordUnchanged,
  ensureKey,
  fileHash,
  latestEntry,
  readLedger,
  verifyLedger,
} from '../src/core/ledger.js';
import {findProjectRoot, projectStorePath, recordPath} from '../src/core/paths.js';
import {mapLimit, runShell} from '../src/core/proc.js';
import {BufferIo, palette} from '../src/core/term.js';
import {clip, countWords, escapeHtml, nowIso} from '../src/core/text.js';
import {tempDir, write} from './helpers.js';

describe('args', () => {
  it('keeps positionals after boolean flags and reads values', () => {
    const args = parseArgs([
      'verify',
      '--all',
      'alpha',
      '--count',
      '3',
      '--teams=a,b',
      '--',
      '--literal',
    ]);
    assert.deepEqual(args.positional, ['verify', 'alpha', '--literal']);
    assert.equal(args.flag('all'), true);
    assert.equal(args.number('count'), 3);
    assert.deepEqual(args.list('teams'), ['a', 'b']);
    assert.equal(args.string('missing'), undefined);
  });

  it('rejects a value flag given without a value', () => {
    assert.throws(() => parseArgs(['--reason']).string('reason'), UsageError);
    assert.throws(() => parseArgs(['--count', 'x']).number('count'), UsageError);
  });
});

describe('glob', () => {
  it('matches **, *, ? and braces', () => {
    assert.ok(matchGlob('tests/acceptance/a/b.test.mjs', 'tests/acceptance/**'));
    assert.ok(matchGlob('src/app.ts', '**/*.{js,ts}'));
    assert.ok(matchGlob('app.ts', '**/*.ts'));
    assert.ok(!matchGlob('src/app.tsx', 'src/*.ts'));
    assert.ok(matchGlob('a1.md', 'a?.md'));
    assert.ok(matchAny('.skillsmith/state.json', ['x/**', '.skillsmith/**']));
    assert.equal(globToRegExp('./a/*.md').source, globToRegExp('a/*.md').source);
  });
});

describe('fs', () => {
  it('resolves paths inside a folder and refuses escapes and links', () => {
    const dir = tempDir();
    write(path.join(dir, 'a', 'b.txt'), 'x');
    fs.symlinkSync(path.join(dir, 'a'), path.join(dir, 'link'));
    assert.equal(resolveInside(dir, 'a/b.txt'), path.join(dir, 'a', 'b.txt'));
    assert.equal(resolveInside(dir, 'new/file.txt'), path.join(dir, 'new', 'file.txt'));
    assert.equal(resolveInside(dir, '../outside'), undefined);
    assert.equal(resolveInside(dir, '/etc/passwd'), undefined);
    assert.equal(resolveInside(dir, 'C:\\x'), undefined);
    assert.equal(resolveInside(dir, ''), undefined);
    assert.equal(resolveInside(dir, 'link/b.txt'), undefined);
  });

  it('reads with limits and lists files without following links', () => {
    const dir = tempDir();
    write(path.join(dir, 'big.txt'), 'x'.repeat(100));
    write(path.join(dir, 'node_modules', 'skip.js'), '');
    assert.throws(() => readText(path.join(dir, 'big.txt'), {maxBytes: 10}), /limit/);
    assert.equal(readText(path.join(dir, 'none.txt'), {optional: true}), undefined);
    assert.throws(() => readText(path.join(dir, 'none.txt')), /not found/);
    assert.throws(() => readText(dir), /Not a regular file/);
    assert.deepEqual(walkFiles(dir), ['big.txt']);
    write(path.join(dir, 'bad.json'), '{');
    assert.throws(() => readJson(path.join(dir, 'bad.json')), /not valid JSON/);
    writeJson(path.join(dir, 'ok.json'), {a: 1});
    assert.deepEqual(readJson(path.join(dir, 'ok.json')), {a: 1});
    assert.ok(isBinary(Buffer.from([1, 0, 2])));
    assert.ok(!isBinary(Buffer.from('text')));
  });
});

describe('json and text', () => {
  it('serialises canonically', () => {
    assert.equal(
      canonicalJson({b: 1, a: [2, {d: null, c: 'x'}]}),
      '{"a":[2,{"c":"x","d":null}],"b":1}',
    );
    assert.ok(isRecord({}) && !isRecord([]) && !isRecord(null));
    assert.ok(isTextList(['a']) && !isTextList(['']));
    assert.deepEqual(unknownKeys({a: 1, z: 2}, ['a']), ['z']);
  });

  it('counts words, clips both ends and escapes HTML', () => {
    assert.equal(countWords("Maya's app — 3 trials"), 4);
    const clipped = clip(`${'a'.repeat(400)}MIDDLE${'b'.repeat(400)}`, 100);
    assert.ok(clipped.startsWith('aaa') && clipped.endsWith('bbb') && !clipped.includes('MIDDLE'));
    assert.equal(escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    assert.match(nowIso(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('paints only when color is on', () => {
    assert.equal(palette(false).red('x'), 'x');
    assert.notEqual(palette(true).red('x'), 'x');
    const io = new BufferIo();
    io.out('a');
    io.err('b');
    assert.equal(io.text(), 'a');
    assert.deepEqual(io.stderr, ['b']);
  });
});

describe('paths', () => {
  it('finds the project root from inside a team worktree', () => {
    const dir = tempDir();
    write(recordPath(dir, 'state.json'), '{}');
    const inner = path.join(dir, '.skillsmith', 'arena', 'alpha', 'src');
    fs.mkdirSync(inner, {recursive: true});
    assert.equal(findProjectRoot(inner), dir);
    assert.equal(findProjectRoot(tempDir()), undefined);
    assert.throws(() => projectStorePath({}, '../evil'), UsageError);
  });
});

describe('ledger', () => {
  it('chains, signs and detects edits', () => {
    const root = tempDir();
    const store = tempDir();
    fs.mkdirSync(recordPath(root), {recursive: true});
    ensureKey(store);
    ensureKey(store);
    appendLedger(root, store, 'init', {project: 'x'});
    appendLedger(root, store, 'verdict', {team: 'alpha', hash: 'h1'});
    appendLedger(root, store, 'verdict', {team: 'beta', hash: 'h2'});
    assert.deepEqual(verifyLedger(root, store), {
      ok: true,
      entries: 3,
      macChecked: true,
      problems: [],
    });
    assert.equal(
      latestEntry(root, 'verdict', data => data['team'] === 'alpha')?.data['hash'],
      'h1',
    );
    assert.equal(readLedger(root).length, 3);

    const file = recordPath(root, 'ledger.jsonl');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    lines[1] = (lines[1] ?? '').replace('"h1"', '"forged"');
    fs.writeFileSync(file, `${lines.join('\n')}\n`);
    const broken = verifyLedger(root, store);
    assert.equal(broken.ok, false);
    assert.match(broken.problems.join(' '), /changed after it was written/);

    const noKey = verifyLedger(root, tempDir());
    assert.equal(noKey.macChecked, false);
    assert.throws(() => appendLedger(root, tempDir(), 'x', {}), IntegrityError);
  });

  it('rejects malformed lines and checks record hashes', () => {
    const root = tempDir();
    write(recordPath(root, 'ledger.jsonl'), 'not json\n');
    assert.equal(verifyLedger(root, tempDir()).ok, false);
    write(recordPath(root, 'ledger.jsonl'), '{"seq":1}\n');
    assert.throws(() => readLedger(root), IntegrityError);
    const record = path.join(root, 'r.json');
    write(record, '{}');
    assertRecordUnchanged(record, fileHash(record), 'r.json');
    assert.throws(() => assertRecordUnchanged(record, 'other', 'r.json'), IntegrityError);
    assert.equal(fileHash(path.join(root, 'missing')), undefined);
  });
});

describe('proc', () => {
  it('runs commands with timeouts and output limits', async () => {
    const dir = tempDir();
    const ok = await runShell('echo hello', {cwd: dir, timeoutMs: 10_000});
    assert.equal(ok.exitCode, 0);
    assert.match(ok.output, /hello/);
    const slow = await runShell('sleep 5', {cwd: dir, timeoutMs: 200});
    assert.equal(slow.timedOut, true);
    const failing = await runShell('exit 3', {cwd: dir, timeoutMs: 10_000});
    assert.equal(failing.exitCode, 3);
    const loud = await runShell(`node -e "process.stdout.write('x'.repeat(400000))"`, {
      cwd: dir,
      timeoutMs: 10_000,
    });
    assert.match(loud.output, /characters dropped/);
  });

  it('limits concurrency', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async item => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 10));
      running -= 1;
      return item * 2;
    });
    assert.deepEqual(out, [2, 4, 6, 8, 10]);
    assert.equal(peak, 2);
  });
});
