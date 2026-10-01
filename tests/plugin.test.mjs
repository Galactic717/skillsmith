// Structural checks on the plugin itself: frontmatter, references, layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, cli, makeProject, write, git } from './helpers.mjs';

const PLUGIN = path.join(REPO, 'plugins', 'skillsmith');

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${file} has no frontmatter`);
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  return { fields, body: text.slice(m[0].length) };
}

const skills = fs.readdirSync(path.join(PLUGIN, 'skills')).map((d) => path.join(PLUGIN, 'skills', d, 'SKILL.md'));
const agents = fs.readdirSync(path.join(PLUGIN, 'agents')).map((f) => path.join(PLUGIN, 'agents', f));

test('every skill and agent has a valid name and a useful description', () => {
  for (const file of [...skills, ...agents]) {
    const { fields } = frontmatter(file);
    assert.match(fields.name || '', /^[a-z][a-z0-9-]{1,63}$/, `${file}: name`);
    assert.ok((fields.description || '').length >= 80, `${file}: description too short`);
    assert.ok(fields.description.length <= 1024, `${file}: description over 1024 chars`);
  }
  for (const file of skills) assert.equal(frontmatter(file).fields.name, path.basename(path.dirname(file)), `${file}: name must match folder`);
});

test('every ${CLAUDE_PLUGIN_ROOT} path mentioned in skills and agents exists', () => {
  const missing = [];
  for (const file of [...skills, ...agents]) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
      const rel = m[1].replace(/[.,)`]+$/, '');
      if (!fs.existsSync(path.join(PLUGIN, rel))) missing.push(`${path.relative(REPO, file)} -> ${rel}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every agent a skill asks for exists', () => {
  const names = new Set(agents.map((f) => frontmatter(f).fields.name));
  const wanted = new Set();
  for (const file of [...skills, ...agents, ...fs.readdirSync(path.join(PLUGIN, 'skills', 'arena', 'references')).map((f) => path.join(PLUGIN, 'skills', 'arena', 'references', f))]) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/skillsmith:([a-z-]+)/g)) wanted.add(m[1]);
  }
  const skillNames = new Set(skills.map((f) => path.basename(path.dirname(f))));
  const unknown = [...wanted].filter((n) => !names.has(n) && !skillNames.has(n));
  assert.deepEqual(unknown, []);
});

test('no top-level bin/ (Cowork refuses such plugins) and no CLAUDE.md in the plugin', () => {
  assert.equal(fs.existsSync(path.join(PLUGIN, 'bin')), false);
  assert.equal(fs.existsSync(path.join(PLUGIN, 'CLAUDE.md')), false);
});

test('manifests agree on name and version', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  const market = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].source, './plugins/skillsmith');
  assert.equal(pkg.version, plugin.version);
  assert.equal(cli(['version']).out.trim(), plugin.version);
});

test('advance --skip works only for research and hooks', () => {
  const dir = makeProject();
  const bad = cli(['advance', 'screenplay', '--skip', 'no time'], { cwd: dir });
  assert.equal(bad.code, 2);
  const state = path.join(dir, '.skillsmith', 'state.json');
  const s = JSON.parse(fs.readFileSync(state, 'utf8'));
  s.stages.research = { status: 'pending' };
  s.stages.hooks = { status: 'pending' };
  s.stages.screenplay = { status: 'pending' };
  fs.writeFileSync(state, JSON.stringify(s));
  const ok = cli(['advance', 'research', '--skip', 'client already knows the market'], { cwd: dir });
  assert.equal(ok.code, 0, ok.all);
  assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).stages.research.skipped, true);
});

test('arena init refuses when acceptance tests are not committed', () => {
  const dir = makeProject();
  write(dir, 'tests/acceptance/extra.test.mjs', 'process.exit(0)\n');
  const r = cli(['arena', 'init'], { cwd: dir });
  assert.equal(r.code, 1);
  assert.match(r.err, /not committed/);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'tests');
  assert.equal(cli(['arena', 'init', '--count', '1'], { cwd: dir }).code, 0);
});

test('accuse --dry-run reports perjury without killing anyone', () => {
  const dir = makeProject();
  assert.equal(cli(['arena', 'init', '--count', '2'], { cwd: dir }).code, 0);
  write(path.join(dir, '.skillsmith', 'teams', 'beta'), 'accusations.json', {
    accusations: [{ id: 'X1', against: 'alpha', text: 'Alpha has no page', evidence: { type: 'file_exists', path: 'index.html' } }],
  });
  const r = cli(['arena', 'accuse', 'beta', '--dry-run', '--no-setup'], { cwd: dir });
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /false\s+X1/);
  const arena = JSON.parse(fs.readFileSync(path.join(dir, '.skillsmith', 'arena.json'), 'utf8'));
  assert.equal(arena.teams.beta.status, 'alive');
  assert.ok(fs.existsSync(path.join(dir, '.skillsmith', 'teams', 'beta', 'accusations-dryrun.json')));
});
