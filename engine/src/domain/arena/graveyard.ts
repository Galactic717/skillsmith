/**
 * Elimination. A dead team loses its worktree and branch for good; the
 * evidence stays in the graveyard, and its name is never used again.
 */
import {readJson, writeFileAtomic, writeJson} from '../../core/fs.js';
import {git, removeWorktree} from '../../core/git.js';
import {isRecord} from '../../core/json.js';
import {appendLedger} from '../../core/ledger.js';
import {recordPath} from '../../core/paths.js';
import {nowIso} from '../../core/text.js';
import type {Project} from '../project.js';
import {addEvent, CAUSE_TEXT, getTeam, teamPaths, type Arena, type DeathCause} from './model.js';

/** One piece of evidence shown on a grave. */
export interface GraveEvidence {
  label: string;
  detail?: string;
}

/** One grave. */
export interface GraveEntry {
  team: string;
  persona: string;
  at: string;
  cause: DeathCause;
  evidence: GraveEvidence[];
}

/** Contents of graveyard.json. */
export interface Graveyard {
  names: string[];
  entries: GraveEntry[];
}

/** Loads the graveyard; empty when nobody has died. */
export function loadGraveyard(root: string): Graveyard {
  const value = readJson(recordPath(root, 'graveyard.json'), {optional: true});
  if (!isRecord(value) || !Array.isArray(value['names']) || !Array.isArray(value['entries'])) {
    return {names: [], entries: []};
  }
  return value as unknown as Graveyard;
}

function writeGraveyardMarkdown(root: string, graveyard: Graveyard): void {
  const lines = [
    '# Graveyard',
    '',
    'Teams here filed a claim that failed its own check, changed a protected file, or accused a rival without proof.',
    'Their branch and worktree were deleted. The evidence stays here for good.',
    '',
  ];
  if (graveyard.entries.length === 0) lines.push('Nobody has died. Yet.', '');
  for (const entry of graveyard.entries) {
    lines.push(
      `## ${entry.team} (${entry.persona}), ${entry.at.slice(0, 16).replace('T', ' ')} UTC`,
      '',
    );
    lines.push(`**Cause:** ${CAUSE_TEXT[entry.cause]}`, '');
    for (const item of entry.evidence) {
      lines.push(`- ${item.label}`);
      if (item.detail) {
        lines.push('', '  ```', ...item.detail.split('\n').map(line => `  ${line}`), '  ```', '');
      }
    }
    lines.push('');
  }
  writeFileAtomic(recordPath(root, 'graveyard.md'), `${lines.join('\n').trimEnd()}\n`);
}

/** Eliminates a team: deletes its worktree and branch and records why. */
export function killTeam(
  project: Project,
  arena: Arena,
  name: string,
  cause: DeathCause,
  evidence: GraveEvidence[],
): void {
  const team = getTeam(arena, name);
  removeWorktree(project.root, teamPaths(project.root, name).worktree);
  git(['branch', '-D', team.branch], project.root, true);
  team.status = 'dead';
  team.diedAt = nowIso();
  team.cause = cause;
  const graveyard = loadGraveyard(project.root);
  if (!graveyard.names.includes(name)) graveyard.names.push(name);
  graveyard.entries.push({team: name, persona: team.persona, at: team.diedAt, cause, evidence});
  writeJson(recordPath(project.root, 'graveyard.json'), graveyard);
  writeGraveyardMarkdown(project.root, graveyard);
  addEvent(arena, 'death', name, {persona: team.persona, cause});
  appendLedger(project.root, project.store, 'death', {team: name, cause, round: arena.round});
  if (Object.values(arena.teams).every(item => item.status !== 'alive')) {
    arena.status = 'wiped';
    addEvent(arena, 'wiped', undefined, {});
  }
}

/** Makes sure the graveyard files exist, so the dashboard can link them. */
export function ensureGraveyard(root: string): void {
  writeGraveyardMarkdown(root, loadGraveyard(root));
}
