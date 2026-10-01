# Contributing

Thank you for helping. Skillsmith is a production line whose whole promise is
"nothing is accepted without evidence", so contributions follow the same rule.

## Setup

```
npm ci
npm test
```

Node.js 20 or newer and git are required. The engine is written in strict
TypeScript in `engine/src` and compiled into `plugins/skillsmith/engine`,
which is committed so the plugin runs without a build step.

## Before you open a pull request

```
npm run lint
npm run typecheck
npm run format:check
npm test
npm run check:build   # fails if you forgot to commit the compiled engine
```

- Keep changes small and focused: one idea per pull request, with its tests.
- Every behaviour change has a test that would fail without it.
- Commit messages: a short imperative summary line ("Add holdout sealing"),
  then a body that explains why. Conventional Commit prefixes (`feat:`,
  `fix:`, `docs:`) are welcome.
- Code style follows the Google TypeScript style guide: named exports only,
  `unknown` instead of `any` at every boundary, JSDoc on every export,
  errors thrown as `Error` subclasses.

## Changing skills or agents

Skill descriptions say when to use the skill, never how it works. A
description that summarises the workflow makes the model follow the summary
instead of the skill. If you change a skill or agent:

1. Run the trigger evals: `npm run evals:triggers` (needs Claude Code).
2. Include the before and after pass rates in the pull request.

## AI-assisted contributions

You may use AI tools. Say which ones in the pull request, and read every line
before you submit it. You are responsible for it, exactly as if you typed it.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
