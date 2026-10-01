// Evidence checks. The same runner judges acceptance checks, manager claims
// and accusations, so every "it works" in Skillsmith goes through one door.
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { safeJoin, walkFiles, matchGlob, isBinary, tail } from './util.mjs';

export const CHECK_TYPES = ['command', 'file_exists', 'file_absent', 'file_contains', 'not_contains', 'http', 'manual', 'acceptance'];

const UNSAFE = [
  [/(^|[\s;&|(])sudo\s/, 'uses sudo'],
  [/\brm\s+(-\S+\s+)*(\/|~|\$HOME|\.\.)(\s|\/|$)/, 'deletes files outside the project'],
  [/\bmkfs\b|\bdd\s+if=|:\(\)\s*\{/, 'destructive system command'],
  [/\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/, 'pipes a download into a shell'],
  [/\bgit\s+(push|reset\s+--hard|clean\b|branch\s+-[dD]|worktree\b|rebase\b|filter-branch\b)/, 'changes git history, branches or remotes'],
  [/\b(npm|pnpm|yarn)\s+publish\b/, 'publishes a package'],
  [/(^|[\s;&|])(shutdown|reboot|halt|poweroff)(\s|$)/, 'power command'],
  [/\bformat\s+[a-z]:/i, 'formats a drive'],
  [/\b(del|rmdir|rd)\s+\/[sq]/i, 'recursive delete on Windows'],
  [/\bchmod\s+-R\s+\S+\s+\//, 'changes permissions on system paths'],
  [/(^|[\s;&|(])cd\s+("|')?(\/|~|\.\.|[a-zA-Z]:)/, 'leaves the project folder'],
];

// On Windows, run checks in Git Bash (Claude Code needs it there anyway) so
// "$VAR" and POSIX quoting mean the same thing on every machine.
let cachedShell;
export function checkShell() {
  if (cachedShell !== undefined) return cachedShell;
  cachedShell = true;
  if (process.platform === 'win32') {
    const candidates = [process.env.CLAUDE_CODE_GIT_BASH_PATH, 'C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe'];
    const found = candidates.find((p) => p && fs.existsSync(p));
    if (found) cachedShell = found;
  }
  return cachedShell;
}

export function unsafeReason(cmd) {
  for (const [re, reason] of UNSAFE) if (re.test(cmd)) return reason;
  return null;
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateCheck(check, where = 'check') {
  const errors = [];
  if (!check || typeof check !== 'object' || Array.isArray(check)) return [`${where}: must be an object`];
  if (!CHECK_TYPES.includes(check.type)) return [`${where}: unknown type "${check.type}" (use ${CHECK_TYPES.join(', ')})`];
  const need = (key) => {
    if (!isStr(check[key])) errors.push(`${where}: "${check.type}" needs a non-empty "${key}"`);
  };
  switch (check.type) {
    case 'command':
      need('run');
      break;
    case 'file_exists':
    case 'file_absent':
      need('path');
      break;
    case 'file_contains':
      need('path');
      need('pattern');
      break;
    case 'not_contains':
      need('glob');
      need('pattern');
      break;
    case 'http':
      need('url');
      if (check.start !== undefined && !isStr(check.start)) errors.push(`${where}: "start" must be a command string`);
      break;
    case 'manual':
      need('note');
      break;
    case 'acceptance':
      if (!Array.isArray(check.ids) || check.ids.length === 0) errors.push(`${where}: "acceptance" needs "ids": ["A1", ...]`);
      break;
    default:
      break;
  }
  if (check.regex && ['file_contains', 'not_contains'].includes(check.type)) {
    try {
      new RegExp(check.pattern);
    } catch (err) {
      errors.push(`${where}: invalid regex: ${err.message}`);
    }
  }
  if (check.expect?.matches) {
    try {
      new RegExp(check.expect.matches);
    } catch (err) {
      errors.push(`${where}: invalid expect.matches regex: ${err.message}`);
    }
  }
  return errors;
}

const result = (status, detail, started) => ({ status, detail, ms: Date.now() - started });

function runCommand(check, ctx, started) {
  const reason = unsafeReason(check.run);
  if (reason) return result('unsafe', `Refused to run (${reason}): ${check.run}`, started);
  const timeoutMs = Math.min(Number(check.timeout) || 120, 1800) * 1000;
  const r = spawnSync(check.run, {
    cwd: ctx.dir,
    shell: checkShell(),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', SKILLSMITH_CHECK: '1', ...(ctx.env || {}) },
  });
  if (r.error && r.error.code === 'ETIMEDOUT') return result('error', `Timed out after ${timeoutMs / 1000}s: ${check.run}`, started);
  if (r.error) return result('error', `Could not start: ${r.error.message}`, started);
  const output = `${r.stdout || ''}${r.stderr ? `\n${r.stderr}` : ''}`;
  const expect = check.expect || {};
  const wantExit = expect.exit ?? 0;
  const problems = [];
  if (r.status === null) problems.push(`killed by signal ${r.signal}`);
  else if (wantExit !== 'any' && r.status !== wantExit) problems.push(`exit code ${r.status}, expected ${wantExit}`);
  if (expect.includes && !output.includes(expect.includes)) problems.push(`output does not include "${expect.includes}"`);
  if (expect.excludes && output.includes(expect.excludes)) problems.push(`output includes "${expect.excludes}"`);
  if (expect.matches && !new RegExp(expect.matches, 'm').test(output)) problems.push(`output does not match /${expect.matches}/`);
  const shown = `$ ${check.run}\n${tail(output)}`;
  return problems.length ? result('fail', `${problems.join('; ')}\n${shown}`, started) : result('pass', shown, started);
}

function fileCheck(check, ctx, started) {
  const abs = safeJoin(ctx.dir, check.path);
  if (!abs) return result('unsafe', `Path must stay inside the project: ${check.path}`, started);
  const present = fs.existsSync(abs);
  if (check.type === 'file_exists') return present ? result('pass', `${check.path} exists`, started) : result('fail', `${check.path} does not exist`, started);
  if (check.type === 'file_absent') return present ? result('fail', `${check.path} exists`, started) : result('pass', `${check.path} is absent`, started);
  if (!present) return result('fail', `${check.path} does not exist`, started);
  const text = fs.readFileSync(abs, 'utf8');
  const found = check.regex ? new RegExp(check.pattern, 'm').test(text) : text.includes(check.pattern);
  return found ? result('pass', `${check.path} contains ${JSON.stringify(check.pattern)}`, started) : result('fail', `${check.path} does not contain ${JSON.stringify(check.pattern)}`, started);
}

function notContains(check, ctx, started) {
  const files = walkFiles(ctx.dir).filter((f) => matchGlob(f, check.glob));
  const re = check.regex ? new RegExp(check.pattern, 'm') : null;
  const hits = [];
  for (const rel of files) {
    const buf = fs.readFileSync(safeJoin(ctx.dir, rel));
    if (buf.length > 5 * 1024 * 1024 || isBinary(buf)) continue;
    const text = buf.toString('utf8');
    if (re ? re.test(text) : text.includes(check.pattern)) hits.push(rel);
  }
  if (hits.length) return result('fail', `Found ${JSON.stringify(check.pattern)} in: ${hits.slice(0, 10).join(', ')}`, started);
  return result('pass', `${files.length} file(s) matching ${check.glob} are clean`, started);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

async function httpCheck(check, ctx, started) {
  let url;
  try {
    url = new URL(check.url);
  } catch {
    return result('error', `Invalid URL: ${check.url}`, started);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) return result('unsafe', `Only local URLs can be checked, got ${url.hostname}`, started);
  if (check.start) {
    const reason = unsafeReason(check.start);
    if (reason) return result('unsafe', `Refused to start (${reason}): ${check.start}`, started);
  }
  const timeoutMs = Math.min(Number(check.timeout) || 60, 600) * 1000;
  let child = null;
  let log = '';
  if (check.start) {
    child = spawn(check.start, {
      cwd: ctx.dir,
      shell: checkShell(),
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', BROWSER: 'none', SKILLSMITH_CHECK: '1', ...(ctx.env || {}) },
    });
    const keep = (d) => {
      log = (log + d.toString()).slice(-4000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
  }
  const want = check.expect || {};
  const wantStatus = want.status ?? 200;
  let last = 'no response';
  try {
    while (Date.now() - started < timeoutMs) {
      if (child && child.exitCode !== null) return result('fail', `Server exited with code ${child.exitCode} before answering.\n${tail(log)}`, started);
      try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000) });
        const body = await res.text();
        const problems = [];
        if (res.status !== wantStatus) problems.push(`status ${res.status}, expected ${wantStatus}`);
        if (want.includes && !body.includes(want.includes)) problems.push(`page does not include "${want.includes}"`);
        if (problems.length) return result('fail', `GET ${url.href}: ${problems.join('; ')}`, started);
        return result('pass', `GET ${url.href} → ${res.status}${want.includes ? `, contains "${want.includes}"` : ''}`, started);
      } catch (err) {
        last = err.cause?.code || err.message;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return result('fail', `No answer from ${url.href} within ${timeoutMs / 1000}s (${last}).\n${tail(log)}`, started);
  } finally {
    killTree(child);
  }
}

function acceptanceRef(check, ctx, started) {
  const ran = ctx.acceptance || {};
  const missing = check.ids.filter((id) => !(id in ran));
  if (missing.length) return result('error', `Acceptance checks not found or not run: ${missing.join(', ')}`, started);
  const failed = check.ids.filter((id) => ran[id] !== 'pass');
  if (failed.length) return result('fail', `Acceptance checks did not pass: ${failed.map((id) => `${id} (${ran[id]})`).join(', ')}`, started);
  return result('pass', `Acceptance checks passed: ${check.ids.join(', ')}`, started);
}

export async function runCheck(check, ctx) {
  const started = Date.now();
  const errors = validateCheck(check);
  if (errors.length) return result('error', errors.join('; '), started);
  try {
    switch (check.type) {
      case 'command':
        return runCommand(check, ctx, started);
      case 'file_exists':
      case 'file_absent':
      case 'file_contains':
        return fileCheck(check, ctx, started);
      case 'not_contains':
        return notContains(check, ctx, started);
      case 'http':
        return await httpCheck(check, ctx, started);
      case 'acceptance':
        return acceptanceRef(check, ctx, started);
      case 'manual':
        return result('unverifiable', `Manual evidence: ${check.note}`, started);
      default:
        return result('error', `Unknown check type ${check.type}`, started);
    }
  } catch (err) {
    return result('error', `Check crashed: ${err.message}`, started);
  }
}
