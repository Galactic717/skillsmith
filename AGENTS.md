# Instructions for AI coding agents

This file follows the AGENTS.md convention. It applies to any agent working on
this repository (Claude Code, Codex, Cursor, and others).

## Layout

- `engine/src/`: the engine in strict TypeScript. `core/` has no domain
  knowledge; `domain/` holds stations, gates, checks and the arena; `cli/`
  parses arguments and prints; `hooks/` holds the Claude Code hook handlers.
- `engine/test/`: tests (`node:test`). `arena.test.ts` runs a whole arena
  in-process with real git repositories.
- `plugins/skillsmith/engine/`: compiled output. Never edit it by hand; run
  `npm run build` and commit the result.
- `plugins/skillsmith/skills/`, `agents/`, `templates/`, `hooks/`: the plugin.
- `docs/`: architecture, research, and the dogfood run (Skillsmith built
  with its own line).

## Rules

1. Run `npm test`, `npm run lint`, `npm run typecheck` and
   `npm run check:build` before you say a change is done, and quote the
   result.
2. Never weaken a check, a gate or a test to make something pass. If a test
   is wrong, explain why in the commit message.
3. Never add a runtime dependency to the engine. Dev dependencies need a
   reason in the pull request.
4. Never invent package names, URLs, numbers or quotes in docs or code.
5. Keep all product text in English.
6. Skill descriptions say when to use the skill, never the workflow.
