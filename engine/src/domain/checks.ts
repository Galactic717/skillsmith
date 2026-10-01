/**
 * Evidence checks. One runner judges acceptance checks, holdout checks,
 * managers' claims and accusations, so every "it works" in Skillsmith goes
 * through the same door.
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import {isBinary, resolveInside, scrubPath, walkFiles} from '../core/fs.js';
import {matchGlob} from '../core/glob.js';
import {isRecord, isText, isTextList} from '../core/json.js';
import {runShell, startBackground, type Background} from '../core/proc.js';
import {clip} from '../core/text.js';

/** Every supported check type. */
export const CHECK_TYPES = [
  'command',
  'file_exists',
  'file_absent',
  'file_contains',
  'not_contains',
  'http',
  'manual',
  'acceptance',
] as const;

/** One of CHECK_TYPES. */
export type CheckType = (typeof CHECK_TYPES)[number];

/** What a command or http check expects. */
export interface CheckExpect {
  exit?: number | 'any';
  includes?: string;
  excludes?: string;
  matches?: string;
  status?: number;
}

/** A validated check. Which fields are set depends on `type`. */
export interface CheckSpec {
  type: CheckType;
  run?: string;
  path?: string;
  pattern?: string;
  regex?: boolean;
  glob?: string;
  url?: string;
  start?: string;
  /** Seconds. */
  timeout?: number;
  expect?: CheckExpect;
  note?: string;
  ids?: string[];
}

/** pass and fail are verdicts; the rest mean the check could not decide. */
export type CheckStatus = 'pass' | 'fail' | 'error' | 'unsafe' | 'unverifiable';

/** Result of running one check. */
export interface CheckOutcome {
  status: CheckStatus;
  detail: string;
  ms: number;
}

/** Where and how a check runs. */
export interface CheckContext {
  /** Folder the check runs in (a clean room during the arena). */
  dir: string;
  /** Extra environment variables for commands. */
  env?: Record<string, string>;
  /**
   * A free port reserved for this clean room. Commands get it as $PORT and
   * http check URLs may use the `{{port}}` placeholder, so several clean rooms
   * can serve the product at the same time.
   */
  port?: number;
  /** Results of acceptance checks already run, for `acceptance` references. */
  acceptance?: Readonly<Record<string, CheckStatus>>;
}

const DEFAULT_COMMAND_TIMEOUT_S = 120;
const MAX_COMMAND_TIMEOUT_S = 1800;
const DEFAULT_HTTP_TIMEOUT_S = 60;
const MAX_HTTP_TIMEOUT_S = 600;
const MAX_SCANNED_FILE_BYTES = 5 * 1024 * 1024;
const MAX_HTTP_BODY_BYTES = 2 * 1024 * 1024;

const UNSAFE_COMMANDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|[\s;&|(])sudo\s/, 'uses sudo'],
  [/\brm\s+(-\S+\s+)*(\/|~|\$HOME|\.\.)(\s|\/|$)/, 'deletes files outside the project'],
  [/\bmkfs\b|\bdd\s+if=|:\(\)\s*\{/, 'destructive system command'],
  [/\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/, 'pipes a download into a shell'],
  [
    /\bgit\s+(push|reset\s+--hard|clean\b|branch\s+-[dD]|worktree\b|rebase\b|filter-branch\b|config\b)/,
    'changes git history, branches, remotes or config',
  ],
  [/\b(npm|pnpm|yarn)\s+publish\b/, 'publishes a package'],
  [/(^|[\s;&|])(shutdown|reboot|halt|poweroff)(\s|$)/, 'power command'],
  [/\bformat\s+[a-z]:/i, 'formats a drive'],
  [/\b(del|rmdir|rd)\s+\/[sq]/i, 'recursive delete on Windows'],
  [/\bchmod\s+-R\s+\S+\s+\//, 'changes permissions on system paths'],
  [/(^|[\s;&|(])cd\s+("|')?(\/|~|\.\.|[a-zA-Z]:)/, 'leaves the project folder'],
  [/\.skillsmith\/projects|SKILLSMITH_HOME/, 'reads the private Skillsmith store'],
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

/** Placeholder in http check URLs for the clean room's port. */
export const PORT_PLACEHOLDER = '{{port}}';

/** Default port substituted when a check runs outside a clean room. */
export const DEFAULT_PORT = 3000;

function withPort(url: string, port: number | undefined): string {
  return url.replaceAll(PORT_PLACEHOLDER, String(port ?? DEFAULT_PORT));
}

/**
 * True when an http check needs a fixed port, so clean rooms that run it
 * must take turns instead of serving at the same time.
 */
export function needsFixedPort(check: CheckSpec): boolean {
  return check.type === 'http' && !(check.url ?? '').includes(PORT_PLACEHOLDER);
}

/** Returns why a command is refused, or undefined when it may run. */
export function unsafeReason(command: string): string | undefined {
  for (const [pattern, reason] of UNSAFE_COMMANDS) {
    if (pattern.test(command)) return reason;
  }
  return undefined;
}

function regexError(source: string, flags = 'm'): string | undefined {
  try {
    new RegExp(source, flags);
    return undefined;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

function parseExpect(value: unknown, where: string, errors: string[]): CheckExpect | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    errors.push(`${where}: "expect" must be an object`);
    return undefined;
  }
  const expect: CheckExpect = {};
  const exit = value['exit'];
  if (exit !== undefined) {
    if (exit === 'any' || (typeof exit === 'number' && Number.isInteger(exit))) expect.exit = exit;
    else errors.push(`${where}: expect.exit must be a whole number or "any"`);
  }
  for (const key of ['includes', 'excludes', 'matches'] as const) {
    const text = value[key];
    if (text === undefined) continue;
    if (typeof text === 'string' && text.length > 0) expect[key] = text;
    else errors.push(`${where}: expect.${key} must be a non-empty string`);
  }
  if (expect.matches !== undefined) {
    const problem = regexError(expect.matches);
    if (problem) errors.push(`${where}: invalid expect.matches regex: ${problem}`);
  }
  const status = value['status'];
  if (status !== undefined) {
    if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
      expect.status = status;
    } else {
      errors.push(`${where}: expect.status must be an HTTP status code`);
    }
  }
  return expect;
}

/**
 * Validates an untrusted check object. Extra keys (id, title, covers, ...)
 * are ignored here; the caller validates those.
 */
export function parseCheck(value: unknown, where = 'check'): {check?: CheckSpec; errors: string[]} {
  if (!isRecord(value)) return {errors: [`${where}: must be an object`]};
  const type = value['type'];
  if (typeof type !== 'string' || !(CHECK_TYPES as readonly string[]).includes(type)) {
    return {errors: [`${where}: unknown type "${String(type)}" (use ${CHECK_TYPES.join(', ')})`]};
  }
  const errors: string[] = [];
  const check: CheckSpec = {type: type as CheckType};
  const text = (
    key: 'run' | 'path' | 'pattern' | 'glob' | 'url' | 'start' | 'note',
    required: boolean,
  ): void => {
    const field = value[key];
    if (isText(field)) check[key] = field;
    else if (required || field !== undefined)
      errors.push(`${where}: "${type}" needs a non-empty "${key}"`);
  };
  switch (check.type) {
    case 'command':
      text('run', true);
      break;
    case 'file_exists':
    case 'file_absent':
      text('path', true);
      break;
    case 'file_contains':
      text('path', true);
      text('pattern', true);
      break;
    case 'not_contains':
      text('glob', true);
      text('pattern', true);
      break;
    case 'http':
      text('url', true);
      text('start', false);
      break;
    case 'manual':
      text('note', true);
      break;
    case 'acceptance': {
      const ids = value['ids'];
      if (isTextList(ids) && ids.length > 0) check.ids = ids;
      else errors.push(`${where}: "acceptance" needs "ids": ["A1", ...]`);
      break;
    }
  }
  if (value['regex'] !== undefined) {
    if (typeof value['regex'] === 'boolean') check.regex = value['regex'];
    else errors.push(`${where}: "regex" must be true or false`);
  }
  if (check.regex && check.pattern !== undefined) {
    const problem = regexError(check.pattern);
    if (problem) errors.push(`${where}: invalid regex: ${problem}`);
  }
  const timeout = value['timeout'];
  if (timeout !== undefined) {
    if (typeof timeout === 'number' && timeout > 0 && Number.isFinite(timeout))
      check.timeout = timeout;
    else errors.push(`${where}: "timeout" must be a positive number of seconds`);
  }
  const expect = parseExpect(value['expect'], where, errors);
  if (expect) check.expect = expect;
  return errors.length ? {errors} : {check, errors};
}

function outcome(status: CheckStatus, detail: string, started: number): CheckOutcome {
  return {status, detail, ms: Date.now() - started};
}

function checkEnv(ctx: CheckContext): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    BROWSER: 'none',
    SKILLSMITH_CHECK: '1',
    ...(ctx.port === undefined ? {} : {PORT: String(ctx.port)}),
    ...ctx.env,
  };
  delete env['SKILLSMITH_HOME'];
  return env;
}

async function runCommandCheck(
  check: CheckSpec,
  ctx: CheckContext,
  started: number,
): Promise<CheckOutcome> {
  const command = check.run ?? '';
  const reason = unsafeReason(command);
  if (reason) return outcome('unsafe', `Refused to run (${reason}): ${command}`, started);
  const seconds = Math.min(check.timeout ?? DEFAULT_COMMAND_TIMEOUT_S, MAX_COMMAND_TIMEOUT_S);
  const result = await runShell(command, {
    cwd: ctx.dir,
    timeoutMs: seconds * 1000,
    env: checkEnv(ctx),
  });
  if (result.startError) return outcome('error', `Could not start: ${result.startError}`, started);
  const output = scrubPath(result.output, ctx.dir);
  if (result.timedOut)
    return outcome('error', `Timed out after ${seconds}s: ${command}\n${clip(output)}`, started);
  const expect = check.expect ?? {};
  const wantExit = expect.exit ?? 0;
  const problems: string[] = [];
  if (result.exitCode === undefined)
    problems.push(`killed by signal ${result.signal ?? 'unknown'}`);
  else if (wantExit !== 'any' && result.exitCode !== wantExit) {
    problems.push(`exit code ${result.exitCode}, expected ${wantExit}`);
  }
  if (expect.includes && !output.includes(expect.includes))
    problems.push(`output does not include "${expect.includes}"`);
  if (expect.excludes && output.includes(expect.excludes))
    problems.push(`output includes "${expect.excludes}"`);
  if (expect.matches && !new RegExp(expect.matches, 'm').test(output)) {
    problems.push(`output does not match /${expect.matches}/`);
  }
  const shown = `$ ${command}\n${clip(output)}`;
  return problems.length
    ? outcome('fail', `${problems.join('; ')}\n${shown}`, started)
    : outcome('pass', shown, started);
}

function runFileCheck(check: CheckSpec, ctx: CheckContext, started: number): CheckOutcome {
  const relative = check.path ?? '';
  const absolute = resolveInside(ctx.dir, relative);
  if (!absolute)
    return outcome(
      'unsafe',
      `Path must stay inside the project and not use links: ${relative}`,
      started,
    );
  const present = fs.existsSync(absolute);
  if (check.type === 'file_exists') {
    return outcome(
      present ? 'pass' : 'fail',
      `${relative} ${present ? 'exists' : 'does not exist'}`,
      started,
    );
  }
  if (check.type === 'file_absent') {
    return outcome(
      present ? 'fail' : 'pass',
      `${relative} ${present ? 'exists' : 'is absent'}`,
      started,
    );
  }
  if (!present) return outcome('fail', `${relative} does not exist`, started);
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > MAX_SCANNED_FILE_BYTES) {
    return outcome('error', `${relative} is not a regular file under 5 MB`, started);
  }
  const text = fs.readFileSync(absolute, 'utf8');
  const pattern = check.pattern ?? '';
  const found = check.regex ? new RegExp(pattern, 'm').test(text) : text.includes(pattern);
  const quoted = JSON.stringify(pattern);
  return outcome(
    found ? 'pass' : 'fail',
    `${relative} ${found ? 'contains' : 'does not contain'} ${quoted}`,
    started,
  );
}

function runNotContains(check: CheckSpec, ctx: CheckContext, started: number): CheckOutcome {
  const glob = check.glob ?? '';
  const pattern = check.pattern ?? '';
  const files = walkFiles(ctx.dir).filter(file => matchGlob(file, glob));
  const regex = check.regex ? new RegExp(pattern, 'm') : undefined;
  const hits: string[] = [];
  for (const relative of files) {
    const absolute = resolveInside(ctx.dir, relative);
    if (!absolute) continue;
    const buffer = fs.readFileSync(absolute);
    if (buffer.length > MAX_SCANNED_FILE_BYTES || isBinary(buffer)) continue;
    const text = buffer.toString('utf8');
    if (regex ? regex.test(text) : text.includes(pattern)) hits.push(relative);
  }
  if (hits.length) {
    return outcome(
      'fail',
      `Found ${JSON.stringify(pattern)} in: ${hits.slice(0, 10).join(', ')}`,
      started,
    );
  }
  return outcome('pass', `${files.length} file(s) matching ${glob} are clean`, started);
}

/** GET a local URL without any proxy. Bodies are capped at 2 MB. */
export function httpGet(url: URL, timeoutMs: number): Promise<{status: number; body: string}> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(
      url,
      {timeout: timeoutMs, ...(url.protocol === 'https:' ? {rejectUnauthorized: false} : {})},
      response => {
        let body = '';
        let size = 0;
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          size += Buffer.byteLength(chunk);
          if (size <= MAX_HTTP_BODY_BYTES) body += chunk;
        });
        response.on('end', () => resolve({status: response.statusCode ?? 0, body}));
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runHttpCheck(
  check: CheckSpec,
  ctx: CheckContext,
  started: number,
): Promise<CheckOutcome> {
  let url: URL;
  try {
    url = new URL(withPort(check.url ?? '', ctx.port));
  } catch {
    return outcome('error', `Invalid URL: ${String(check.url)}`, started);
  }
  if (!LOCAL_HOSTS.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    return outcome('unsafe', `Only local http(s) URLs can be checked, got ${url.href}`, started);
  }
  if (check.start) {
    const reason = unsafeReason(check.start);
    if (reason) return outcome('unsafe', `Refused to start (${reason}): ${check.start}`, started);
  }
  const timeoutMs = Math.min(check.timeout ?? DEFAULT_HTTP_TIMEOUT_S, MAX_HTTP_TIMEOUT_S) * 1000;
  const server: Background | undefined = check.start
    ? startBackground(check.start, ctx.dir, checkEnv(ctx))
    : undefined;
  const wantStatus = check.expect?.status ?? 200;
  const wantText = check.expect?.includes;
  let last = 'no response';
  try {
    while (Date.now() - started < timeoutMs) {
      if (server?.exited()) {
        return outcome(
          'fail',
          `Server exited with code ${String(server.exitCode())} before answering.\n${clip(scrubPath(server.log(), ctx.dir))}`,
          started,
        );
      }
      try {
        const response = await httpGet(url, 5000);
        const problems: string[] = [];
        if (response.status !== wantStatus)
          problems.push(`status ${response.status}, expected ${wantStatus}`);
        if (wantText && !response.body.includes(wantText))
          problems.push(`page does not include "${wantText}"`);
        if (problems.length)
          return outcome('fail', `GET ${url.href}: ${problems.join('; ')}`, started);
        return outcome(
          'pass',
          `GET ${url.href} → ${response.status}${wantText ? `, contains "${wantText}"` : ''}`,
          started,
        );
      } catch (error: unknown) {
        last =
          error instanceof Error
            ? ((error as NodeJS.ErrnoException).code ?? error.message)
            : String(error);
        await sleep(400);
      }
    }
    return outcome(
      'fail',
      `No answer from ${url.href} within ${timeoutMs / 1000}s (${last}).\n${clip(scrubPath(server?.log() ?? '', ctx.dir))}`,
      started,
    );
  } finally {
    server?.stop();
  }
}

function runAcceptanceReference(
  check: CheckSpec,
  ctx: CheckContext,
  started: number,
): CheckOutcome {
  const ran = ctx.acceptance ?? {};
  const ids = check.ids ?? [];
  const missing = ids.filter(id => !(id in ran));
  if (missing.length)
    return outcome(
      'error',
      `Acceptance checks not found or not run: ${missing.join(', ')}`,
      started,
    );
  const failed = ids.filter(id => ran[id] !== 'pass');
  if (failed.length) {
    return outcome(
      'fail',
      `Acceptance checks did not pass: ${failed.map(id => `${id} (${String(ran[id])})`).join(', ')}`,
      started,
    );
  }
  return outcome('pass', `Acceptance checks passed: ${ids.join(', ')}`, started);
}

/** Runs one check. Never throws: a crash becomes an `error` outcome. */
export async function runCheck(value: unknown, ctx: CheckContext): Promise<CheckOutcome> {
  const started = Date.now();
  const {check, errors} = parseCheck(value);
  if (!check) return outcome('error', errors.join('; '), started);
  try {
    switch (check.type) {
      case 'command':
        return await runCommandCheck(check, ctx, started);
      case 'file_exists':
      case 'file_absent':
      case 'file_contains':
        return runFileCheck(check, ctx, started);
      case 'not_contains':
        return runNotContains(check, ctx, started);
      case 'http':
        return await runHttpCheck(check, ctx, started);
      case 'acceptance':
        return runAcceptanceReference(check, ctx, started);
      case 'manual':
        return outcome('unverifiable', `Manual evidence: ${check.note ?? ''}`, started);
    }
  } catch (error: unknown) {
    return outcome(
      'error',
      `Check crashed: ${error instanceof Error ? error.message : String(error)}`,
      started,
    );
  }
}
