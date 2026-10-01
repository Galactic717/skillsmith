// Pipeline state and the gates between stations.
import path from 'node:path';
import { SS_DIR, ssPath, readJson, writeJson, readText, exists, now, countWords, UserError } from './util.mjs';
import { detectSlop } from './slop.mjs';
import { validateSources, citedIds, validateAcceptance } from './artifacts.mjs';

export const STAGES = [
  { id: 'interview', title: 'Interview', crew: 'Interviewer', output: '01-brief.md' },
  { id: 'research', title: 'Research', crew: 'Researcher', output: '02-research.md + 02-sources.json' },
  { id: 'hooks', title: 'Hooks', crew: 'Hook writer', output: '03-hooks.md' },
  { id: 'screenplay', title: 'Screenplay', crew: 'Screenwriter', output: '04-screenplay.md + 04-acceptance.json' },
  { id: 'arena', title: 'Arena', crew: '3 managers, their developers and designers, the auditor', output: 'arena.json, scoreboard.md, graveyard.md' },
  { id: 'ship', title: 'Ship', crew: 'Conveyor', output: 'REPORT.md + your product' },
];

export const STAGE_IDS = STAGES.map((s) => s.id);

export function newState({ project, language = 'auto' }) {
  const stages = {};
  for (const s of STAGES) stages[s.id] = { status: 'pending' };
  return { version: 1, project, language, createdAt: now(), updatedAt: now(), stages };
}

export const loadState = (root) => readJson(ssPath(root, 'state.json'));

export function saveState(root, state) {
  state.updatedAt = now();
  writeJson(ssPath(root, 'state.json'), state);
}

export function currentStage(state) {
  return STAGES.find((s) => state.stages[s.id]?.status !== 'done') || null;
}

const BRIEF_ANCHORS = ['summary', 'audience', 'pain', 'done', 'scope', 'platform', 'look', 'limits', 'data', 'launch', 'risks', 'assumptions'];
const RESEARCH_ANCHORS = ['competitors', 'audience', 'trends', 'niches', 'repos', 'implications', 'rejected'];
const HOOKS_ANCHORS = ['platform', 'oneliner', 'hooks', 'launch-post', 'kill-list'];
const SCREENPLAY_ANCHORS = ['logline', 'cast', 'world', 'act1', 'act2', 'act3', 'acceptance'];

const PLACEHOLDER = /(?<![\p{L}])(TBD|TODO|FIXME|XXX)(?![\p{L}])|\?\?\?|\[fill[^\]]*\]|<fill[^>]*>/u;

function anchorErrors(text, anchors, file) {
  return anchors.filter((a) => !text.includes(`<!-- ss:${a} -->`)).map((a) => `${file}: missing section anchor <!-- ss:${a} -->`);
}

function placeholderErrors(text, file) {
  const errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (PLACEHOLDER.test(line)) errors.push(`${file}:${i + 1}: unfinished placeholder: ${line.trim().slice(0, 80)}`);
  });
  return errors;
}

// Text between an anchor and the next anchor.
export function section(text, anchor) {
  const start = text.indexOf(`<!-- ss:${anchor} -->`);
  if (start === -1) return '';
  const rest = text.slice(start + anchor.length + 12);
  const next = rest.search(/<!-- ss:(?!slop-ignore)[a-z0-9-]+ -->/);
  return next === -1 ? rest : rest.slice(0, next);
}

function loadFile(dir, name, errors) {
  const file = path.join(dir, name);
  if (!exists(file)) {
    errors.push(`${name} does not exist yet`);
    return null;
  }
  return readText(file);
}

function sourcesFor(dir) {
  const file = path.join(dir, '02-sources.json');
  return exists(file) ? readJson(file) : null;
}

const gates = {
  interview(dir) {
    const errors = [];
    const warnings = [];
    const text = loadFile(dir, '01-brief.md', errors);
    if (text === null) return { errors, warnings };
    errors.push(...anchorErrors(text, BRIEF_ANCHORS, '01-brief.md'));
    errors.push(...placeholderErrors(text, '01-brief.md'));
    if (!/^status:\s*confirmed\b/im.test(text)) errors.push('01-brief.md: the client has not confirmed the brief yet (add "Status: confirmed" only after they say yes)');
    const words = countWords(text);
    if (words < 150) errors.push(`01-brief.md: only ${words} words; the brief is too thin to build from`);
    return { errors, warnings };
  },

  research(dir) {
    const errors = [];
    const warnings = [];
    const text = loadFile(dir, '02-research.md', errors);
    const data = sourcesFor(dir);
    if (!data) errors.push('02-sources.json does not exist yet');
    if (text === null || !data) return { errors, warnings };
    errors.push(...anchorErrors(text, RESEARCH_ANCHORS, '02-research.md'));
    errors.push(...placeholderErrors(text, '02-research.md'));
    const v = validateSources(data);
    errors.push(...v.errors.map((e) => `02-sources.json: ${e}`));
    warnings.push(...v.warnings.map((w) => `02-sources.json: ${w}`));
    if (v.verified.length < 5) errors.push(`only ${v.verified.length} verified source(s); find at least 5`);
    const cited = citedIds(text);
    for (const id of cited) {
      if (!v.ids?.includes(id)) errors.push(`02-research.md cites [${id}] but 02-sources.json has no such source`);
      else if (!v.verified.includes(id)) errors.push(`02-research.md cites [${id}], which is not verified; move it to "Rejected" or verify it`);
    }
    for (const id of v.verified) if (!cited.includes(id)) warnings.push(`verified source ${id} is never cited`);
    return { errors, warnings };
  },

  hooks(dir) {
    const errors = [];
    const warnings = [];
    const text = loadFile(dir, '03-hooks.md', errors);
    if (text === null) return { errors, warnings };
    errors.push(...anchorErrors(text, HOOKS_ANCHORS, '03-hooks.md'));
    errors.push(...placeholderErrors(text, '03-hooks.md'));
    const slop = detectSlop(text);
    if (!slop.pass) {
      errors.push(`03-hooks.md: slop check failed (hard hits: ${slop.hard}, density ${slop.density}/${slop.maxDensity}); run \`skillsmith slop\` for the list`);
    }
    const data = sourcesFor(dir);
    const verified = data ? validateSources(data).verified : [];
    for (const id of citedIds(text)) if (!verified.includes(id)) errors.push(`03-hooks.md cites [${id}], which is not a verified source`);
    section(text, 'hooks')
      .split(/\r?\n/)
      .forEach((line) => {
        const item = line.trim();
        if (/^([-*]|\d+\.)\s/.test(item) && /\d/.test(item.replace(/^\d+\.\s/, '')) && !/\[(S\d+|P)\]/.test(item)) {
          errors.push(`03-hooks.md: hook with a number but no source tag [S#] or [P]: ${item.slice(0, 80)}`);
        }
      });
    return { errors, warnings };
  },

  screenplay(dir) {
    const errors = [];
    const warnings = [];
    const text = loadFile(dir, '04-screenplay.md', errors);
    const file = path.join(dir, '04-acceptance.json');
    const data = exists(file) ? readJson(file) : null;
    if (!data) errors.push('04-acceptance.json does not exist yet');
    if (text === null || !data) return { errors, warnings };
    errors.push(...anchorErrors(text, SCREENPLAY_ANCHORS, '04-screenplay.md'));
    errors.push(...placeholderErrors(text, '04-screenplay.md'));
    const v = validateAcceptance(data);
    errors.push(...v.errors.map((e) => `04-acceptance.json: ${e}`));
    const mentioned = [...new Set(text.match(/(?<![\p{L}\p{N}])A\d+(?![\p{N}])/gu) || [])];
    for (const id of mentioned) if (!v.ids.includes(id)) errors.push(`04-screenplay.md mentions ${id}, but 04-acceptance.json has no such check`);
    for (const id of v.ids) if (!mentioned.includes(id)) warnings.push(`acceptance check ${id} is not attached to any scene`);
    if (!/(scene|сцена|сцене)\s*\d/i.test(text)) errors.push('04-screenplay.md: no scenes found (use headings like "Scene 1.1")');
    return { errors, warnings };
  },

  arena(dir) {
    const errors = [];
    const file = path.join(dir, 'arena.json');
    if (!exists(file)) return { errors: ['the arena has not started'], warnings: [] };
    const arena = readJson(file);
    if (arena.status !== 'crowned') errors.push('the arena has no winner yet');
    return { errors, warnings: [] };
  },

  ship(dir) {
    const errors = [];
    if (!exists(path.join(dir, 'REPORT.md'))) errors.push('REPORT.md does not exist yet (run `skillsmith report`)');
    const projectRoot = path.dirname(dir);
    if (!exists(path.join(projectRoot, 'README.md'))) errors.push('the product has no README.md that explains how to run it');
    return { errors, warnings: [] };
  },
};

export function runGate(root, stage, { from } = {}) {
  if (!gates[stage]) throw new UserError(`Unknown stage "${stage}". Stages: ${STAGE_IDS.join(', ')}`, { code: 2 });
  const dir = from ? path.resolve(from) : path.join(root, SS_DIR);
  const { errors, warnings } = gates[stage](dir);
  return { stage, ok: errors.length === 0, errors, warnings };
}
