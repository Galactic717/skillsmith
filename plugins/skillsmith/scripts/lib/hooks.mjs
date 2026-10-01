// Claude Code hook handlers. They must be fast and must never break a
// session: any unexpected error means "no opinion".
import path from 'node:path';
import { findRoot, matchGlob, toPosix } from './util.mjs';
import { loadState, currentStage } from './pipeline.mjs';
import { loadArena } from './arena.mjs';

const RECORDS = [
  '.skillsmith/state.json',
  '.skillsmith/arena.json',
  '.skillsmith/04-acceptance.json',
  '.skillsmith/graveyard.json',
  '.skillsmith/graveyard.md',
  '.skillsmith/scoreboard.md',
  '.skillsmith/teams/*/verdict.json',
  '.skillsmith/teams/*/precheck.json',
  '.skillsmith/teams/*/accusations-verdict.json',
  '.skillsmith/teams/*/accusations-dryrun.json',
];

export function sessionStart(input) {
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const root = findRoot(cwd);
  if (!root) return null;
  const state = loadState(root);
  const cur = currentStage(state);
  const arena = loadArena(root, { required: false });
  const parts = [`This folder is a Skillsmith project ("${state.project}").`];
  parts.push(cur ? `Current station: ${cur.title} (${cur.crew}). To continue, run the skillsmith:start skill.` : 'Every station is done.');
  if (arena?.status === 'running') {
    const alive = Object.entries(arena.teams).filter(([, t]) => t.status === 'alive').map(([n, t]) => `${n}/${t.persona}`);
    parts.push(`Arena round ${arena.round} is running. Alive: ${alive.join(', ') || 'nobody'}.`);
  }
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: parts.join(' ') } };
}

const deny = (reason) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });

export function preToolUse(input) {
  const fp = input.tool_input?.file_path || input.tool_input?.notebook_path;
  if (!fp) return null;
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const abs = path.resolve(cwd, fp);
  const root = findRoot(path.dirname(abs)) || findRoot(cwd);
  if (!root) return null;
  const rel = toPosix(path.relative(root, abs));
  if (rel.startsWith('..')) return null;
  const arena = loadArena(root, { required: false });
  if (!arena || arena.status !== 'running') return null;
  if (RECORDS.some((g) => matchGlob(rel, g))) {
    return deny(`The arena is running and ${rel} is an official Skillsmith record. Only the skillsmith script writes it.`);
  }
  const m = rel.match(/^\.skillsmith\/arena\/([^/]+)\/(.+)$/);
  if (m && arena.teams[m[1]]) {
    const inner = m[2];
    if ((arena.protected || ['.skillsmith/**']).some((g) => matchGlob(inner, g))) {
      return deny(`${inner} is protected in team ${m[1]}'s worktree (tests or Skillsmith records). A committed change to it eliminates the team. Write claims to ${path.join(root, '.skillsmith', 'teams', m[1])} instead.`);
    }
  }
  return null;
}
