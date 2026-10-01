---
name: screenplay
description: Station 4 of the Skillsmith line. A screenwriter turns the brief, research and hooks into a development screenplay (acts, scenes, contracts) plus machine-checkable acceptance checks written before any code exists. Use when a Skillsmith project is at the screenplay station, or to turn requirements into a build plan with verifiable acceptance criteria.
allowed-tools: Bash(node *), Read, Write, Edit, Glob
---

# Screenplay station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs"` (below: `skillsmith`).
Input: `01-brief.md`, `02-research.md`, `03-hooks.md`. Output:
`04-screenplay.md`, `04-acceptance.json`, and any acceptance test files.

## 1. Send the screenwriter

Start a `skillsmith:screenwriter` agent with the absolute paths of the
inputs, the client's language, the templates
(`${CLAUDE_PLUGIN_ROOT}/templates/screenplay.md` and `acceptance.json`) and
the guide `${CLAUDE_PLUGIN_ROOT}/skills/screenplay/references/screenplay-guide.md`.

## 2. Check it

1. `skillsmith acceptance check` must pass.
2. Run the acceptance checks against the empty project:
   `skillsmith verify --acceptance .skillsmith/04-acceptance.json`.
   Almost everything should FAIL now. A check that already passes on an empty
   folder tests nothing; send it back to the screenwriter.
3. `skillsmith gate screenplay` must pass.
4. Resume the screenwriter with SendMessage for any fixes.

## 3. Get the client's yes

Tell the story in plain words, at most 10 lines: the logline, what each act
delivers, what was cut. Avoid technical words; where the world section names
a technology, explain it as a consequence ("a website that also works without
internet"). Ask: "Is this the film you want to see?" Change what they ask.

## 4. Commit and finish

Commit the screenplay, the acceptance file and any acceptance tests to git
(`git add .skillsmith tests && git commit -m "screenplay"` or the paths the
screenwriter created). The arena copies the project from this commit, so the
tests every team must pass are fixed from here on.

Run `skillsmith advance screenplay`. Next is the arena.
