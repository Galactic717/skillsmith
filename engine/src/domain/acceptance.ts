/**
 * Acceptance and holdout checks: what "done" means, written before any code.
 * Each check names the requirements it covers (R1, R2 ...), so the engine can
 * prove every requirement has at least one mechanical check.
 */
import {isRecord, isText, isTextList} from '../core/json.js';
import {parseCheck, type CheckSpec} from './checks.js';

/** A check plus the metadata acceptance needs. */
export interface ScoredCheck extends CheckSpec {
  id: string;
  title: string;
  covers: string[];
  weight: number;
  /**
   * A guard protects something that already holds on the empty project (for
   * example "no secrets committed"). Guards may pass on the base commit;
   * every other check must fail there, or it proves nothing.
   */
  guard: boolean;
}

/** Contents of 04-acceptance.json. */
export interface AcceptanceFile {
  setup: string[];
  protected: string[];
  checks: ScoredCheck[];
}

/** Contents of a holdout file (before sealing). */
export interface HoldoutFile {
  /** Test files written into the clean room before the holdout checks run. */
  files: Record<string, string>;
  checks: ScoredCheck[];
}

const MIN_ACCEPTANCE_CHECKS = 3;
const MAX_HOLDOUT_FILE_CHARS = 512 * 1024;

function parseScoredChecks(value: unknown, idPrefix: 'A' | 'H', errors: string[]): ScoredCheck[] {
  if (!Array.isArray(value)) {
    errors.push('needs a "checks" array');
    return [];
  }
  const checks: ScoredCheck[] = [];
  const ids = new Set<string>();
  const idPattern = new RegExp(`^${idPrefix}\\d+$`);
  value.forEach((item: unknown, index) => {
    const rawId = isRecord(item) ? item['id'] : undefined;
    const where = `checks[${index}]${typeof rawId === 'string' ? ` (${rawId})` : ''}`;
    if (!isRecord(item)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    const before = errors.length;
    if (typeof rawId !== 'string' || !idPattern.test(rawId)) {
      errors.push(`${where}: id must look like ${idPrefix}1, ${idPrefix}2, ...`);
    } else if (ids.has(rawId)) {
      errors.push(`${where}: duplicate id`);
    } else {
      ids.add(rawId);
    }
    if (!isText(item['title'])) errors.push(`${where}: needs a plain-language "title"`);
    if (item['type'] === 'manual' || item['type'] === 'acceptance') {
      errors.push(`${where}: checks must be mechanical (not "${String(item['type'])}")`);
    }
    const weight = item['weight'];
    if (
      weight !== undefined &&
      !(typeof weight === 'number' && Number.isFinite(weight) && weight > 0)
    ) {
      errors.push(`${where}: weight must be a positive number`);
    }
    const covers = item['covers'];
    if (!isTextList(covers) || covers.length === 0) {
      errors.push(`${where}: "covers" must list the requirements it proves, e.g. ["R1"]`);
    } else if (covers.some(id => !/^R\d+$/.test(id))) {
      errors.push(`${where}: "covers" ids must look like R1, R2, ...`);
    }
    if (item['guard'] !== undefined && typeof item['guard'] !== 'boolean') {
      errors.push(`${where}: "guard" must be true or false`);
    }
    const parsed = parseCheck(item, where);
    errors.push(...parsed.errors);
    if (errors.length === before && parsed.check) {
      checks.push({
        ...parsed.check,
        id: rawId as string,
        title: item['title'] as string,
        covers: covers as string[],
        weight: typeof weight === 'number' ? weight : 1,
        guard: item['guard'] === true,
      });
    }
  });
  return checks;
}

/** Validates 04-acceptance.json. */
export function parseAcceptance(value: unknown): {file?: AcceptanceFile; errors: string[]} {
  if (!isRecord(value)) return {errors: ['acceptance file must be a JSON object']};
  const errors: string[] = [];
  const setup = value['setup'] ?? [];
  const protectedGlobs = value['protected'] ?? [];
  if (!isTextList(setup)) errors.push('"setup" must be a list of commands');
  if (!isTextList(protectedGlobs)) errors.push('"protected" must be a list of glob patterns');
  const checks = parseScoredChecks(value['checks'], 'A', errors);
  const real = checks.filter(check => !check.guard).length;
  if (Array.isArray(value['checks']) && real < MIN_ACCEPTANCE_CHECKS) {
    errors.push(`write at least ${MIN_ACCEPTANCE_CHECKS} acceptance checks that are not guards`);
  }
  if (errors.length) return {errors};
  return {file: {setup: setup as string[], protected: protectedGlobs as string[], checks}, errors};
}

/** Validates a holdout file. File paths must be relative and stay inside. */
export function parseHoldout(value: unknown): {file?: HoldoutFile; errors: string[]} {
  if (!isRecord(value)) return {errors: ['holdout file must be a JSON object']};
  const errors: string[] = [];
  const files: Record<string, string> = {};
  const rawFiles = value['files'] ?? {};
  if (!isRecord(rawFiles)) {
    errors.push('"files" must map relative paths to file contents');
  } else {
    for (const [file, content] of Object.entries(rawFiles)) {
      if (
        file.startsWith('/') ||
        file.includes('..') ||
        /^[a-zA-Z]:/.test(file) ||
        file.includes('\\')
      ) {
        errors.push(`files: "${file}" must be a relative path inside the project`);
      } else if (typeof content !== 'string' || content.length > MAX_HOLDOUT_FILE_CHARS) {
        errors.push(`files: "${file}" must be text under 512 KB`);
      } else {
        files[file] = content;
      }
    }
  }
  const checks = parseScoredChecks(value['checks'], 'H', errors);
  if (Array.isArray(value['checks']) && checks.length === 0 && errors.length === 0) {
    errors.push('write at least 1 holdout check');
  }
  if (errors.length) return {errors};
  return {file: {files, checks}, errors};
}

/** Requirement coverage of a set of checks. */
export interface Traceability {
  /** Requirement ids with no check. */
  uncovered: string[];
  /** Ids named in "covers" that the brief does not define. */
  unknown: string[];
  /** Share of requirements with at least one check, 0-100. */
  percent: number;
  /** Requirement id → check ids. */
  map: Record<string, string[]>;
}

/** Maps every requirement to the checks that cover it. */
export function traceability(
  checks: readonly ScoredCheck[],
  requirementIds: readonly string[],
): Traceability {
  const map: Record<string, string[]> = {};
  for (const id of requirementIds) map[id] = [];
  const unknown = new Set<string>();
  for (const check of checks) {
    for (const id of check.covers) {
      const list = map[id];
      if (list) list.push(check.id);
      else unknown.add(id);
    }
  }
  const uncovered = requirementIds.filter(id => (map[id] ?? []).length === 0);
  const percent = requirementIds.length
    ? Math.round(((requirementIds.length - uncovered.length) / requirementIds.length) * 100)
    : 0;
  return {uncovered, unknown: [...unknown], percent, map};
}
