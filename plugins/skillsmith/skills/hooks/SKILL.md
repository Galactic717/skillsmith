---
name: hooks
description: Use when a Skillsmith project is at the hooks station, or when a founder needs launch copy, opening lines, a one-liner or in-product text for one platform (X, Reddit, YouTube, TikTok, LinkedIn, Product Hunt, Hacker News, Instagram, Threads or email) that uses sourced numbers and no AI-sounding cliches.
allowed-tools: Bash(node *), Read, Write, Edit
---

# Hooks station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js"` (below: `skillsmith`).
Input: `01-brief.md`, `02-research.md`, `02-sources.json`. Output:
`.skillsmith/03-hooks.md`.

## 1. Pick the one platform

Read the `launch` section of the brief. If it names one place where the first
users are, use it. If it names several or none, ask the founder to pick one
(AskUserQuestion with the 2 to 4 likeliest options). Every other platform is
an adaptation of the main platform's copy. The gate requires exactly one
platform in the platform section.

## 2. Send the hook writer

Start a `skillsmith:hook-writer` agent with: absolute paths of the brief,
research and sources; the platform; the template
`${CLAUDE_PLUGIN_ROOT}/templates/hooks.md`; the output path
`.skillsmith/03-hooks.md`.

## 3. Check the copy

1. Run `skillsmith slop .skillsmith/03-hooks.md`.
2. Run `skillsmith gate hooks`.
3. If either fails, send the exact findings back to the same hook writer
   (resume it with SendMessage) and repeat. Do not fix the copy yourself; the
   writer learns nothing that way.

## 4. Let the founder choose

Show the founder the one-liner, the top three hooks and the first lines of
the launch post. Ask which hook sounds most like them (AskUserQuestion with
the three hooks as options) and move their pick to number 1.

## 5. Finish

Run `skillsmith advance hooks`. Tell the founder the copy is ready and will be
used inside the product (headline, buttons, empty and error states) and for
the launch. Next is the screenplay: the build plan.
