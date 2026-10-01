/**
 * Safety checks the engine runs on every official verification, because
 * model capability alone has not moved the security pass rate of AI code:
 *
 * - committed secrets (API keys, private keys, .env files);
 * - dependencies that do not exist in the registry. Models invent package
 *   names, and attackers register them ("slopsquatting").
 *
 * A team with a high-confidence finding cannot be crowned.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isBinary, resolveInside, walkFiles} from '../core/fs.js';
import {isRecord} from '../core/json.js';
import {mapLimit} from '../core/proc.js';

/** A possible secret in a committed file. */
export interface SecretFinding {
  file: string;
  line: number;
  kind: string;
  /** High-confidence findings make a team ineligible; generic ones warn. */
  blocking: boolean;
}

/** Existence of one declared dependency. */
export interface DependencyFinding {
  name: string;
  ecosystem: 'npm' | 'pypi';
  status: 'exists' | 'missing' | 'unknown' | 'skipped';
  detail: string;
}

/** Everything the safety pass found. */
export interface SafetyReport {
  secrets: SecretFinding[];
  dependencies: DependencyFinding[];
  /** True when nothing blocks the team from being crowned. */
  clean: boolean;
}

/** Looks up whether a package exists in its public registry. */
export type RegistryLookup = (
  ecosystem: 'npm' | 'pypi',
  name: string,
) => Promise<DependencyFinding['status']>;

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string, boolean]> = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----/, 'private key', true],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key', true],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/, 'GitHub token', true],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token', true],
  [/\b[sr]k_live_[0-9a-zA-Z]{20,}/, 'Stripe live key', true],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key', true],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key', true],
  [
    /\bsk-(?:proj-)?[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b|\bsk-proj-[A-Za-z0-9_-]{40,}/,
    'OpenAI API key',
    true,
  ],
  [
    /(?:api[_-]?key|secret|passw(?:or)?d|access[_-]?token)\s*[:=]\s*['"][^'"\s]{16,}['"]/i,
    'hard-coded credential',
    false,
  ],
];

const SKIP_DIRS = /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|vendor)\//;
const MAX_SCANNED_BYTES = 1024 * 1024;
const MAX_DEPENDENCIES = 200;
const LOOKUP_TIMEOUT_MS = 20_000;

/** Scans committed text files for secrets. */
export function scanSecrets(dir: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const relative of walkFiles(dir)) {
    if (SKIP_DIRS.test(relative)) continue;
    const base = path.posix.basename(relative);
    if (/^\.env(\..+)?$/.test(base) && !/\.(example|sample|template)$/.test(base)) {
      findings.push({file: relative, line: 0, kind: '.env file committed', blocking: true});
      continue;
    }
    const absolute = resolveInside(dir, relative);
    if (!absolute) continue;
    const buffer = fs.readFileSync(absolute);
    if (buffer.length > MAX_SCANNED_BYTES || isBinary(buffer)) continue;
    buffer
      .toString('utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        for (const [pattern, kind, blocking] of SECRET_PATTERNS) {
          if (pattern.test(line)) findings.push({file: relative, line: index + 1, kind, blocking});
        }
      });
  }
  return findings;
}

function npmDependencies(dir: string): string[] {
  const file = resolveInside(dir, 'package.json');
  if (!file || !fs.existsSync(file)) return [];
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return [];
  }
  if (!isRecord(manifest)) return [];
  const names = new Set<string>();
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const deps = manifest[field];
    if (!isRecord(deps)) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string') continue;
      const local = /^(file:|link:|workspace:|git\+|git:|github:|https?:)/.test(spec);
      const githubShorthand = spec.includes('/') && !spec.startsWith('npm:');
      if (local || githubShorthand) continue;
      const alias = /^npm:(@?[^@]+)/.exec(spec);
      names.add(alias?.[1] ?? name);
    }
  }
  return [...names];
}

function pythonDependencies(dir: string): string[] {
  const file = resolveInside(dir, 'requirements.txt');
  if (!file || !fs.existsSync(file)) return [];
  const names = new Set<string>();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line);
    if (match?.[1]) names.add(match[1].toLowerCase());
  }
  return [...names];
}

function npmView(name: string): Promise<DependencyFinding['status']> {
  return new Promise(resolve => {
    // Run outside the project so a committed .npmrc cannot point the lookup
    // at a registry the team controls.
    const child = spawn('npm', ['view', name, 'name', '--json'], {
      cwd: os.tmpdir(),
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), LOOKUP_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.on('error', () => {
      clearTimeout(timer);
      resolve('unknown');
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve('exists');
      else if (/E404|404 Not Found|is not in this registry/.test(output)) resolve('missing');
      else resolve('unknown');
    });
  });
}

async function pypiLookup(name: string): Promise<DependencyFinding['status']> {
  try {
    const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (response.status === 200) return 'exists';
    if (response.status === 404) return 'missing';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Default lookup: `npm view` for npm, the PyPI JSON API for Python. */
export const registryLookup: RegistryLookup = (ecosystem, name) =>
  ecosystem === 'npm' ? npmView(name) : pypiLookup(name);

/** Checks that every declared dependency exists in its registry. */
export async function checkDependencies(
  dir: string,
  options: {lookup?: RegistryLookup; offline?: boolean} = {},
): Promise<DependencyFinding[]> {
  const declared: Array<{name: string; ecosystem: 'npm' | 'pypi'}> = [
    ...npmDependencies(dir).map(name => ({name, ecosystem: 'npm' as const})),
    ...pythonDependencies(dir).map(name => ({name, ecosystem: 'pypi' as const})),
  ].slice(0, MAX_DEPENDENCIES);
  if (options.offline) {
    return declared.map(item => ({...item, status: 'skipped', detail: 'offline mode'}));
  }
  const lookup = options.lookup ?? registryLookup;
  return mapLimit(declared, 4, async item => {
    const status = await lookup(item.ecosystem, item.name);
    const detail =
      status === 'missing'
        ? `${item.name} does not exist on ${item.ecosystem === 'npm' ? 'npm' : 'PyPI'}: a made-up package name`
        : status === 'unknown'
          ? 'registry did not answer; not counted against the team'
          : '';
    return {...item, status, detail};
  });
}

/** Runs both safety passes on a folder. */
export async function runSafety(
  dir: string,
  options: {lookup?: RegistryLookup; offline?: boolean} = {},
): Promise<SafetyReport> {
  const secrets = scanSecrets(dir);
  const dependencies = await checkDependencies(dir, options);
  const clean =
    !secrets.some(item => item.blocking) && !dependencies.some(item => item.status === 'missing');
  return {secrets, dependencies, clean};
}
