---
name: screenplay
description: Use when a Skillsmith project is at the screenplay station, or when a founder's confirmed requirements must become a build plan in acts and scenes plus machine-checkable acceptance checks, written and proven able to fail before any code exists.
allowed-tools: Bash(node *), Bash(git add *), Bash(git commit *), Bash(git status *), Read, Write, Edit, Glob
---

# Screenplay station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js"` (below: `skillsmith`).
Input: `01-brief.md`, `02-research.md`, `03-hooks.md`. Output:
`04-screenplay.md`, `04-acceptance.json`, the acceptance test files, the
vacuity report `04-vacuity.json`, and optionally sealed hidden checks.

## 1. Send the screenwriter

Start a `skillsmith:screenwriter` agent with the absolute paths of the inputs,
the templates (`${CLAUDE_PLUGIN_ROOT}/templates/screenplay.md`,
`acceptance.json` and `holdout.json`) and the guide
`${CLAUDE_PLUGIN_ROOT}/skills/screenplay/references/screenplay-guide.md`.
Ask it for two things: the screenplay with its visible acceptance checks, and
a separate hidden check set in `.skillsmith/holdout.json`.

## 2. Check traceability

1. `skillsmith acceptance check` must pass.
2. `skillsmith acceptance trace` must show every requirement R# from the
   brief with at least one check. Send uncovered requirements back.

## 3. Prove every check can fail

Commit the acceptance tests and the records so the check runs on exactly what
the teams will get:

```
git add .skillsmith tests && git commit -m "Add acceptance checks"
```

(use the paths the screenwriter created). Then run:

```
skillsmith acceptance vacuity
```

It runs every check on the project as it is now, before anything is built. A
check that already passes proves nothing ("Will the tests actually fail when
the code is broken?"). Send each vacuous check back to the screenwriter to
make it stricter, or, if it is a true regression guard ("no secrets
committed"), mark it `"guard": true`. Commit and rerun until it passes.

## 4. Seal the hidden checks

If the screenwriter wrote `.skillsmith/holdout.json`, never commit it (it is
git-ignored). Run:

```
skillsmith holdout seal
```

The engine validates the file, moves it into the private store outside the
project and records its hash. Builders will never see these checks; official
verification runs them, and the scoreboard shows when a team passed the
visible checks but failed the hidden ones. Tell the founder in one sentence
that some checks are kept secret from the builders, so they cannot game them.

## 5. Get the founder's yes

Tell the story in at most 10 lines: the logline, what each act delivers, what
was cut. Avoid technical words; where the world section names a technology,
say it as a consequence ("a website that keeps your list on your phone, no
account needed"). Ask: "Is this the product you want to see?" Change what
they ask, then repeat steps 2 and 3.

## 6. Finish

Run `skillsmith advance screenplay`. Next is the arena.
