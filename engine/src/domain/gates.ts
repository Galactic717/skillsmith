/**
 * Gates between stations. A station is done only when its gate passes; the
 * gate reads the files the agents wrote and never takes their word for it.
 */
import fs from 'node:fs';
import path from 'node:path';
import {readJson, readText} from '../core/fs.js';
import {countWords} from '../core/text.js';
import {parseAcceptance, traceability} from './acceptance.js';
import {
  coverageMap,
  COVERAGE_AREAS,
  forgeVerdict,
  requirementFindings,
  requirements,
} from './brief.js';
import {BRIEF_ANCHORS} from './brief.js';
import {anchorErrors, citedSourceIds, placeholderErrors, section} from './markdown.js';
import {detectSlop} from './slop.js';
import {validateSources} from './sources.js';
import type {StationId} from './stations.js';
import {vacuityFindings} from './vacuity.js';

/** Outcome of a gate. */
export interface GateResult {
  station: StationId;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const RESEARCH_ANCHORS = [
  'competitors',
  'audience',
  'trends',
  'niches',
  'repos',
  'implications',
  'rejected',
];
const HOOKS_ANCHORS = ['platform', 'oneliner', 'hooks', 'launch-post', 'kill-list'];
const SCREENPLAY_ANCHORS = ['logline', 'cast', 'world', 'act1', 'act2', 'act3', 'acceptance'];

/** Platforms a launch post can target. One per hooks file. */
export const PLATFORMS = [
  'X',
  'Reddit',
  'YouTube',
  'TikTok',
  'LinkedIn',
  'Product Hunt',
  'Hacker News',
  'Instagram',
  'Threads',
  'Email',
] as const;

const MIN_BRIEF_WORDS = 200;
const MIN_VERIFIED_SOURCES = 5;

interface Findings {
  errors: string[];
  warnings: string[];
}

function load(dir: string, name: string, findings: Findings): string | undefined {
  const text = readText(path.join(dir, name), {optional: true});
  if (text === undefined) findings.errors.push(`${name} does not exist yet`);
  return text;
}

function verifiedSourceIds(dir: string): string[] {
  const value = readJson(path.join(dir, '02-sources.json'), {optional: true});
  return value === undefined ? [] : validateSources(value).verified;
}

function interviewGate(dir: string): Findings {
  const findings: Findings = {errors: [], warnings: []};
  const text = load(dir, '01-brief.md', findings);
  if (text === undefined) return findings;
  const {errors, warnings} = findings;
  errors.push(...anchorErrors(text, BRIEF_ANCHORS, '01-brief.md'));
  errors.push(...placeholderErrors(text, '01-brief.md'));
  if (!/^status:\s*confirmed\b/im.test(text)) {
    errors.push(
      '01-brief.md: the founder has not confirmed the brief yet (write "Status: confirmed" only after they say yes)',
    );
  }
  const words = countWords(text);
  if (words < MIN_BRIEF_WORDS)
    errors.push(`01-brief.md: only ${words} words; the brief is too thin to build from`);
  const verdict = forgeVerdict(text);
  if (!verdict)
    errors.push(
      '01-brief.md: the idea check has no verdict (write "Verdict: HARDENED", "CLARIFIED" or "KILLED")',
    );
  if (verdict === 'KILLED') {
    errors.push(
      '01-brief.md: the idea check verdict is KILLED. Do not build it; start again with a new idea.',
    );
  }
  const requirementCheck = requirementFindings(text);
  errors.push(...requirementCheck.errors);
  warnings.push(...requirementCheck.warnings);
  const coverage = coverageMap(text);
  for (const area of COVERAGE_AREAS) {
    const status = coverage.get(area);
    if (!status)
      errors.push(
        `01-brief.md: the coverage map does not rate "${area}" (Clear, Partial or Missing)`,
      );
    else if (status === 'Missing')
      errors.push(`01-brief.md: "${area}" is Missing; ask the founder about it`);
    else if (status === 'Partial')
      warnings.push(
        `01-brief.md: "${area}" is only Partial; list what you assumed under Assumptions`,
      );
  }
  return findings;
}

function researchGate(dir: string): Findings {
  const findings: Findings = {errors: [], warnings: []};
  const text = load(dir, '02-research.md', findings);
  const data = readJson(path.join(dir, '02-sources.json'), {optional: true});
  if (data === undefined) findings.errors.push('02-sources.json does not exist yet');
  if (text === undefined || data === undefined) return findings;
  const {errors, warnings} = findings;
  errors.push(...anchorErrors(text, RESEARCH_ANCHORS, '02-research.md'));
  errors.push(...placeholderErrors(text, '02-research.md'));
  const sources = validateSources(data);
  errors.push(...sources.errors.map(error => `02-sources.json: ${error}`));
  warnings.push(...sources.warnings.map(warning => `02-sources.json: ${warning}`));
  if (sources.verified.length < MIN_VERIFIED_SOURCES) {
    errors.push(
      `only ${sources.verified.length} verified source(s); find at least ${MIN_VERIFIED_SOURCES}`,
    );
  }
  const cited = citedSourceIds(text);
  for (const id of cited) {
    if (!sources.ids.includes(id))
      errors.push(`02-research.md cites [${id}] but 02-sources.json has no such source`);
    else if (!sources.verified.includes(id)) {
      errors.push(
        `02-research.md cites [${id}], which is not verified; move it to "Rejected" or verify it`,
      );
    }
  }
  for (const id of sources.verified) {
    if (!cited.includes(id)) warnings.push(`verified source ${id} is never cited`);
  }
  if (!/github\.com\//.test(section(text, 'repos'))) {
    warnings.push('02-research.md: the repos section links no GitHub repository');
  }
  return findings;
}

function hooksGate(dir: string): Findings {
  const findings: Findings = {errors: [], warnings: []};
  const text = load(dir, '03-hooks.md', findings);
  if (text === undefined) return findings;
  const {errors} = findings;
  errors.push(...anchorErrors(text, HOOKS_ANCHORS, '03-hooks.md'));
  errors.push(...placeholderErrors(text, '03-hooks.md'));
  const platformText = section(text, 'platform');
  const named = PLATFORMS.filter(platform =>
    new RegExp(`(?<![\\p{L}])${platform.replace(' ', '\\s+')}(?![\\p{L}])`, 'u').test(platformText),
  );
  if (named.length !== 1) {
    errors.push(
      `03-hooks.md: the platform section must name exactly one platform (${PLATFORMS.join(', ')}); found ${named.length}`,
    );
  }
  const slop = detectSlop(text);
  if (!slop.pass) {
    errors.push(
      `03-hooks.md: slop check failed (hard hits: ${slop.hard}, density ${slop.density}/${slop.maxDensity}); run \`skillsmith slop\` for the list`,
    );
  }
  const verified = verifiedSourceIds(dir);
  for (const id of citedSourceIds(text)) {
    if (!verified.includes(id))
      errors.push(`03-hooks.md cites [${id}], which is not a verified source`);
  }
  for (const line of section(text, 'hooks').split(/\r?\n/)) {
    const item = line.trim();
    const isListItem = /^([-*]|\d+\.)\s/.test(item);
    if (isListItem && /\d/.test(item.replace(/^\d+\.\s/, '')) && !/\[(S\d+|P)\]/.test(item)) {
      errors.push(
        `03-hooks.md: hook with a number but no source tag [S#] or [P]: ${item.slice(0, 80)}`,
      );
    }
  }
  return findings;
}

function screenplayGate(dir: string, root: string | undefined): Findings {
  const findings: Findings = {errors: [], warnings: []};
  const text = load(dir, '04-screenplay.md', findings);
  const data = readJson(path.join(dir, '04-acceptance.json'), {optional: true});
  if (data === undefined) findings.errors.push('04-acceptance.json does not exist yet');
  if (text === undefined || data === undefined) return findings;
  const {errors, warnings} = findings;
  errors.push(...anchorErrors(text, SCREENPLAY_ANCHORS, '04-screenplay.md'));
  errors.push(...placeholderErrors(text, '04-screenplay.md'));
  const {file, errors: acceptanceErrors} = parseAcceptance(data);
  errors.push(...acceptanceErrors.map(error => `04-acceptance.json: ${error}`));
  const ids = file?.checks.map(check => check.id) ?? [];
  const mentioned = [...new Set(text.match(/(?<![\p{L}\p{N}])A\d+(?![\p{N}])/gu) ?? [])];
  for (const id of mentioned) {
    if (!ids.includes(id))
      errors.push(`04-screenplay.md mentions ${id}, but 04-acceptance.json has no such check`);
  }
  for (const id of ids) {
    if (!mentioned.includes(id))
      warnings.push(`acceptance check ${id} is not attached to any scene`);
  }
  if (!/scene\s*\d/i.test(text))
    errors.push('04-screenplay.md: no scenes found (use headings like "Scene 1.1")');
  const brief = readText(path.join(dir, '01-brief.md'), {optional: true});
  if (brief === undefined) {
    errors.push('01-brief.md is missing, so requirements cannot be traced to checks');
  } else if (file) {
    const trace = traceability(
      file.checks,
      requirements(brief).map(item => item.id),
    );
    for (const id of trace.uncovered)
      errors.push(`requirement ${id} has no acceptance check (add "covers": ["${id}"] to one)`);
    for (const id of trace.unknown)
      errors.push(`04-acceptance.json covers ${id}, which the brief does not define`);
  }
  if (file) errors.push(...vacuityFindings(dir, root));
  return findings;
}

function arenaGate(dir: string): Findings {
  const value = readJson(path.join(dir, 'arena.json'), {optional: true}) as
    {status?: unknown} | undefined;
  if (value === undefined) return {errors: ['the arena has not started'], warnings: []};
  return {errors: value.status === 'crowned' ? [] : ['the arena has no winner yet'], warnings: []};
}

function shipGate(dir: string, root: string | undefined): Findings {
  const errors: string[] = [];
  if (!fs.existsSync(path.join(dir, 'REPORT.md')))
    errors.push('REPORT.md does not exist yet (run `skillsmith report`)');
  const productRoot = root ?? path.dirname(dir);
  if (!fs.existsSync(path.join(productRoot, 'README.md'))) {
    errors.push('the product has no README.md that explains how to run it');
  }
  return {errors, warnings: []};
}

/**
 * Runs a station's gate on the files in `dir` (normally `.skillsmith/`).
 * `root` is the project root; when given, records are also checked against
 * the ledger.
 */
export function runGate(station: StationId, dir: string, root?: string): GateResult {
  let findings: Findings;
  switch (station) {
    case 'interview':
      findings = interviewGate(dir);
      break;
    case 'research':
      findings = researchGate(dir);
      break;
    case 'hooks':
      findings = hooksGate(dir);
      break;
    case 'screenplay':
      findings = screenplayGate(dir, root);
      break;
    case 'arena':
      findings = arenaGate(dir);
      break;
    case 'ship':
      findings = shipGate(dir, root);
      break;
  }
  return {station, ok: findings.errors.length === 0, ...findings};
}
