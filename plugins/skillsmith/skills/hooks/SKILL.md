---
name: hooks
description: Station 3 of the Skillsmith line. A hook writer turns the brief and the research into attention-grabbing opening lines, product copy and a launch post for one main platform, backed by real numbers and scrubbed of AI slop by a detector. Use when a Skillsmith project is at the hooks station, or to rewrite marketing copy without AI cliches.
allowed-tools: Bash(node *), Read, Write, Edit
---

# Hooks station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs"` (below: `skillsmith`).
Input: `01-brief.md`, `02-research.md`, `02-sources.json`. Output:
`.skillsmith/03-hooks.md`.

## 1. Pick the one platform

Read the `launch` section of the brief. If it names one place where the first
users are, use it. If it names several or none, ask the client to pick one
(use AskUserQuestion with the 2 to 4 likeliest options). Everything else is an
adaptation of the main platform's copy.

## 2. Send the hook writer

Start a `skillsmith:hook-writer` agent with: absolute paths of the brief,
research and sources; the platform; the client's language; the template
`${CLAUDE_PLUGIN_ROOT}/templates/hooks.md`; the output path
`.skillsmith/03-hooks.md`.

## 3. Check the copy

1. Run `skillsmith slop .skillsmith/03-hooks.md`.
2. Run `skillsmith gate hooks`.
3. If either fails, send the exact findings back to the same hook writer
   (resume it with SendMessage) and repeat. Do not fix the copy yourself; the
   writer learns nothing that way.

## 4. Let the client choose

Show the client, in plain words: the one-liner, the top three hooks and the
first lines of the launch post. Ask which hook feels most like them (use
AskUserQuestion with the three hooks as options). Move their pick to number 1
in the file.

## 5. Finish

Run `skillsmith advance hooks`. Tell the client the copy is ready and will be
used inside the product (headlines, buttons) and for the launch. Next comes
the screenplay: the build plan.
