// Shared helpers: paths, JSON/text IO, globbing, terminal colors.
import fs from 'node:fs';
import path from 'node:path';

export const SS_DIR = '.skillsmith';

export class UserError extends Error {
  constructor(message, { code = 1, hint } = {}) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (open, close) => (s) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
};

export const now = () => new Date().toISOString();

export const toPosix = (p) => p.split(path.sep).join('/');

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function readText(file, fallback = null) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== null) return fallback;
    if (err.code === 'ENOENT') throw new UserError(`File not found: ${file}`);
    throw err;
  }
}

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function readJson(file, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    if (err.code === 'ENOENT') throw new UserError(`File not found: ${file}`);
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new UserError(`${file} is not valid JSON: ${err.message}`);
  }
}

export function writeJson(file, data) {
  writeText(file, `${JSON.stringify(data, null, 2)}\n`);
}

// Walks up from `start` to the folder that holds .skillsmith/state.json.
// A team worktree carries its own copy of .skillsmith/, so a path inside
// .skillsmith/arena/<team>/ resolves to the project that owns the arena.
export function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  const marker = `${path.sep}${SS_DIR}${path.sep}arena${path.sep}`;
  const idx = dir.indexOf(marker);
  if (idx !== -1) dir = dir.slice(0, idx);
  for (;;) {
    if (exists(path.join(dir, SS_DIR, 'state.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireRoot(opts = {}) {
  const root = opts.dir ? path.resolve(opts.dir) : findRoot();
  if (!root || !exists(path.join(root, SS_DIR, 'state.json'))) {
    throw new UserError('No Skillsmith project here.', {
      hint: 'Run `skillsmith init` in the project folder first.',
    });
  }
  return root;
}

export const ssPath = (root, ...parts) => path.join(root, SS_DIR, ...parts);

// Resolves a relative path inside `base`. Returns null for absolute paths
// or paths that escape `base`.
export function safeJoin(base, rel) {
  if (typeof rel !== 'string' || rel.length === 0) return null;
  if (path.isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel)) return null;
  const abs = path.resolve(base, rel);
  const relBack = path.relative(base, abs);
  if (relBack.startsWith('..') || path.isAbsolute(relBack)) return null;
  return abs;
}

const escapeRe = (s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

function globSource(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }
    if (ch === '?') {
      re += '[^/]';
      i += 1;
      continue;
    }
    if (ch === '{') {
      const end = glob.indexOf('}', i);
      if (end > i) {
        const parts = glob.slice(i + 1, end).split(',').map(globSource);
        re += `(?:${parts.join('|')})`;
        i = end + 1;
        continue;
      }
    }
    re += escapeRe(ch);
    i += 1;
  }
  return re;
}

// Minimal glob: `**`, `*`, `?`, `{a,b}`. Patterns are relative to the root.
export function globToRegex(glob) {
  return new RegExp(`^${globSource(toPosix(glob).replace(/^\.\//, ''))}$`);
}

export const matchGlob = (relPath, glob) => globToRegex(glob).test(toPosix(relPath));

const WALK_SKIP = new Set(['.git', 'node_modules']);

export function walkFiles(dir, base = dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (WALK_SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(abs, base, out);
    else if (entry.isFile()) out.push(toPosix(path.relative(base, abs)));
  }
  return out;
}

export function isBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i += 1) if (buf[i] === 0) return true;
  return false;
}

// Keeps the start (where errors are named) and the end (where they land).
export function tail(text, max = 600) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const half = Math.floor(max / 2);
  return `${s.slice(0, half).trimEnd()}\n  …\n${s.slice(-half).trimStart()}`;
}

export function countWords(text) {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

const BOOLEAN_FLAGS = new Set(['json', 'online', 'force', 'help', 'no-setup', 'dry-run', 'quiet', 'strict']);

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith('--')) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}
