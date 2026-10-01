/**
 * Validators for the files managers and the auditor write during the arena:
 * claims, accusations and judge scores. Every claim and accusation carries
 * a mechanical check the engine runs itself.
 */
import {isRecord, isText, isTextList} from '../../core/json.js';
import {parseCheck} from '../checks.js';

/** The auditor's three criteria, 0-10 each. */
export const JUDGE_CRITERIA = ['fit', 'experience', 'craft'] as const;

/** One parsed claim. */
export interface Claim {
  id: string;
  text: string;
  evidence: unknown;
}

/** One parsed accusation. */
export interface Accusation {
  id: string;
  against: string;
  text: string;
  evidence: unknown;
}

/** Parsed judge scores: team → criterion → score. */
export type JudgeScores = Record<string, Record<(typeof JUDGE_CRITERIA)[number], number>>;

function idErrors(id: unknown, prefix: string, where: string, seen: Set<string>): string[] {
  if (typeof id !== 'string' || !new RegExp(`^${prefix}\\d+$`).test(id)) {
    return [`${where}: id must look like ${prefix}1, ${prefix}2, ...`];
  }
  if (seen.has(id)) return [`${where}: duplicate id`];
  seen.add(id);
  return [];
}

/** Validates claims.json and returns the claims that are well formed. */
export function parseClaims(value: unknown): {
  claims: Claim[];
  knownIssues: string[];
  errors: string[];
} {
  if (!isRecord(value) || !Array.isArray(value['claims'])) {
    return {claims: [], knownIssues: [], errors: ['claims file needs a "claims" array']};
  }
  const errors: string[] = [];
  const claims: Claim[] = [];
  const seen = new Set<string>();
  (value['claims'] as unknown[]).forEach((item, index) => {
    const id = isRecord(item) ? item['id'] : undefined;
    const where = `claims[${index}]${typeof id === 'string' ? ` (${id})` : ''}`;
    if (!isRecord(item)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    errors.push(...idErrors(id, 'C', where, seen));
    if (!isText(item['text'])) errors.push(`${where}: needs "text" (the claim in plain words)`);
    errors.push(...parseCheck(item['evidence'], `${where}.evidence`).errors);
    claims.push({
      id: String(id),
      text: typeof item['text'] === 'string' ? item['text'] : '',
      evidence: item['evidence'],
    });
  });
  if (claims.length === 0) errors.push('file at least one claim');
  const known = value['known_issues'];
  if (known !== undefined && !isTextList(known))
    errors.push('"known_issues" must be a list of sentences');
  return {claims, knownIssues: isTextList(known) ? known : [], errors};
}

/** Validates accusations.json for one accuser. */
export function parseAccusations(
  value: unknown,
  accuser: string,
  teams: readonly string[],
): {accusations: Accusation[]; errors: string[]} {
  if (!isRecord(value) || !Array.isArray(value['accusations'])) {
    return {accusations: [], errors: ['accusations file needs an "accusations" array']};
  }
  const errors: string[] = [];
  const accusations: Accusation[] = [];
  const seen = new Set<string>();
  (value['accusations'] as unknown[]).forEach((item, index) => {
    const id = isRecord(item) ? item['id'] : undefined;
    const where = `accusations[${index}]${typeof id === 'string' ? ` (${id})` : ''}`;
    if (!isRecord(item)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    errors.push(...idErrors(id, 'X', where, seen));
    const against = item['against'];
    if (typeof against !== 'string' || !teams.includes(against)) {
      errors.push(`${where}: "against" must be one of ${teams.join(', ')}`);
    } else if (against === accuser) {
      errors.push(`${where}: a team cannot accuse itself`);
    }
    if (!isText(item['text'])) errors.push(`${where}: needs "text" (the defect in plain words)`);
    const evidence = item['evidence'];
    if (
      isRecord(evidence) &&
      (evidence['type'] === 'acceptance' || evidence['type'] === 'manual')
    ) {
      errors.push(`${where}: evidence must be a direct check, not "${String(evidence['type'])}"`);
    }
    errors.push(...parseCheck(evidence, `${where}.evidence`).errors);
    const text = typeof item['text'] === 'string' ? item['text'] : '';
    accusations.push({id: String(id), against: String(against), text, evidence});
  });
  return {accusations, errors};
}

/**
 * Validates judge.json: every listed team needs a whole-number score 0-10
 * per criterion and evidence that names what the auditor saw.
 */
export function parseJudge(
  value: unknown,
  teams: readonly string[],
): {scores?: JudgeScores; errors: string[]} {
  if (!isRecord(value) || !isRecord(value['scores']))
    return {errors: ['judge file needs a "scores" object']};
  const raw = value['scores'];
  const errors: string[] = [];
  const scores: JudgeScores = {};
  for (const team of teams) {
    const entry = raw[team];
    if (!isRecord(entry)) {
      errors.push(`no scores for team ${team}`);
      continue;
    }
    const row = {} as JudgeScores[string];
    for (const criterion of JUDGE_CRITERIA) {
      const item = entry[criterion];
      const score = isRecord(item) ? item['score'] : undefined;
      const evidence = isRecord(item) ? item['evidence'] : undefined;
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 10) {
        errors.push(`${team}.${criterion}: score must be a whole number 0-10`);
      } else {
        row[criterion] = score;
      }
      if (typeof evidence !== 'string' || evidence.trim().length < 20) {
        errors.push(
          `${team}.${criterion}: evidence must say what you saw (file, screen, command), at least 20 characters`,
        );
      }
    }
    scores[team] = row;
  }
  return errors.length ? {errors} : {scores, errors};
}
