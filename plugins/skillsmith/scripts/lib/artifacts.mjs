// Validators for the files each station produces: sources, acceptance checks,
// claims, accusations and judge scores.
import { validateCheck } from './checks.mjs';
import { readJson } from './util.mjs';

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateSources(data) {
  const errors = [];
  const warnings = [];
  if (!data || !Array.isArray(data.sources)) return { errors: ['sources file needs a "sources" array'], warnings, verified: [] };
  const ids = new Set();
  data.sources.forEach((s, i) => {
    const where = `sources[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!s || typeof s !== 'object') {
      errors.push(`${where}: must be an object`);
      return;
    }
    if (!/^S\d+$/.test(s.id || '')) errors.push(`${where}: id must look like S1, S2, ...`);
    else if (ids.has(s.id)) errors.push(`${where}: duplicate id`);
    else ids.add(s.id);
    if (!/^https?:\/\/\S+$/.test(s.url || '')) errors.push(`${where}: needs a full http(s) url`);
    if (!isStr(s.title)) errors.push(`${where}: needs a title`);
    if (!['verified', 'unconfirmed', 'rejected'].includes(s.status)) errors.push(`${where}: status must be verified, unconfirmed or rejected`);
    if (s.status === 'verified') {
      if (!isStr(s.quote) || s.quote.trim().length < 15) errors.push(`${where}: a verified source needs an exact quote of at least 15 characters`);
      if (!isStr(s.claim)) errors.push(`${where}: say which claim this source supports`);
      if (!isStr(s.accessed)) warnings.push(`${where}: add "accessed" (YYYY-MM-DD)`);
    }
  });
  if (!Array.isArray(data.rejected)) warnings.push('add a "rejected" list (claims you could not verify), even if it is empty');
  const verified = data.sources.filter((s) => s && s.status === 'verified').map((s) => s.id);
  return { errors, warnings, verified, ids: [...ids] };
}

export function citedIds(text) {
  return [...new Set((text.match(/\[S\d+\]/g) || []).map((m) => m.slice(1, -1)))];
}

export function validateAcceptance(data) {
  const errors = [];
  if (!data || !Array.isArray(data.checks)) return { errors: ['acceptance file needs a "checks" array'], ids: [] };
  if (data.setup !== undefined && (!Array.isArray(data.setup) || !data.setup.every(isStr))) errors.push('"setup" must be a list of commands');
  if (data.protected !== undefined && (!Array.isArray(data.protected) || !data.protected.every(isStr))) errors.push('"protected" must be a list of glob patterns');
  const ids = new Set();
  data.checks.forEach((ch, i) => {
    const where = `checks[${i}]${ch?.id ? ` (${ch.id})` : ''}`;
    if (!/^A\d+$/.test(ch?.id || '')) errors.push(`${where}: id must look like A1, A2, ...`);
    else if (ids.has(ch.id)) errors.push(`${where}: duplicate id`);
    else ids.add(ch.id);
    if (!isStr(ch?.title)) errors.push(`${where}: needs a plain-language "title"`);
    if (ch?.type === 'manual' || ch?.type === 'acceptance') errors.push(`${where}: acceptance checks must be mechanical (not "${ch.type}")`);
    if (ch?.weight !== undefined && !(Number.isFinite(ch.weight) && ch.weight > 0)) errors.push(`${where}: weight must be a positive number`);
    errors.push(...validateCheck(ch, where));
  });
  if (data.checks.length < 3) errors.push('write at least 3 acceptance checks');
  return { errors, ids: [...ids] };
}

export function validateClaims(data) {
  const errors = [];
  if (!data || !Array.isArray(data.claims)) return ['claims file needs a "claims" array'];
  if (data.claims.length === 0) errors.push('file at least one claim');
  const ids = new Set();
  data.claims.forEach((cl, i) => {
    const where = `claims[${i}]${cl?.id ? ` (${cl.id})` : ''}`;
    if (!/^C\d+$/.test(cl?.id || '')) errors.push(`${where}: id must look like C1, C2, ...`);
    else if (ids.has(cl.id)) errors.push(`${where}: duplicate id`);
    else ids.add(cl.id);
    if (!isStr(cl?.text)) errors.push(`${where}: needs "text" (the claim in plain words)`);
    errors.push(...validateCheck(cl?.evidence, `${where}.evidence`));
  });
  if (data.known_issues !== undefined && !Array.isArray(data.known_issues)) errors.push('"known_issues" must be a list');
  return errors;
}

export function validateAccusations(data, { accuser, teams }) {
  const errors = [];
  if (!data || !Array.isArray(data.accusations)) return ['accusations file needs an "accusations" array'];
  const ids = new Set();
  data.accusations.forEach((a, i) => {
    const where = `accusations[${i}]${a?.id ? ` (${a.id})` : ''}`;
    if (!/^X\d+$/.test(a?.id || '')) errors.push(`${where}: id must look like X1, X2, ...`);
    else if (ids.has(a.id)) errors.push(`${where}: duplicate id`);
    else ids.add(a.id);
    if (!teams.includes(a?.against)) errors.push(`${where}: "against" must be one of ${teams.join(', ')}`);
    if (a?.against === accuser) errors.push(`${where}: a team cannot accuse itself`);
    if (!isStr(a?.text)) errors.push(`${where}: needs "text" (the defect in plain words)`);
    if (a?.evidence?.type === 'acceptance') errors.push(`${where}: use a direct check as evidence, not an acceptance reference`);
    errors.push(...validateCheck(a?.evidence, `${where}.evidence`));
  });
  return errors;
}

export const JUDGE_CRITERIA = ['fit', 'experience', 'craft'];

export function validateJudge(data, aliveTeams) {
  const errors = [];
  if (!data || typeof data.scores !== 'object' || data.scores === null) return ['judge file needs a "scores" object'];
  for (const team of aliveTeams) {
    const s = data.scores[team];
    if (!s) {
      errors.push(`no scores for team ${team}`);
      continue;
    }
    for (const crit of JUDGE_CRITERIA) {
      const entry = s[crit];
      if (!entry || !Number.isInteger(entry.score) || entry.score < 0 || entry.score > 10) errors.push(`${team}.${crit}: score must be a whole number 0-10`);
      if (!entry || !isStr(entry.evidence) || entry.evidence.trim().length < 20) errors.push(`${team}.${crit}: evidence must say what you saw (file, screen, command), at least 20 characters`);
    }
  }
  return errors;
}

export const loadJson = (file, fallback) => readJson(file, fallback);
