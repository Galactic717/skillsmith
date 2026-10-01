---
name: research
description: Use when a Skillsmith project is at the research station, or when a founder needs competitors, real user complaints, market trends, open niches and reusable GitHub repositories for their product idea, with every fact backed by a link and a quote that a script can find on the page.
allowed-tools: Bash(node *), Read, Write, Edit, Glob
---

# Research station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js"` (below: `skillsmith`).
Input: `.skillsmith/01-brief.md`. Output: `.skillsmith/02-research.md` and
`.skillsmith/02-sources.json`.

## 1. Send four researchers at once

Tell the founder research takes a few minutes. Then start four
`skillsmith:researcher` agents in parallel (one message, four Agent calls),
one beat each:

| Beat | Question it answers | Output file |
|---|---|---|
| competitors | Who already solves this, how well, for how much, what their users complain about | `.skillsmith/research/competitors.json` |
| voices | What real people say about this problem: forums, Reddit, reviews, comments with dates | `.skillsmith/research/voices.json` |
| trends | What is growing or shrinking around this idea; which niches are open | `.skillsmith/research/trends.json` |
| repos | Open-source projects, libraries and templates worth reusing or studying, with licenses | `.skillsmith/research/repos.json` |

Each brief contains: the beat and its question, the absolute path of
`01-brief.md`, the output path, the rules at
`${CLAUDE_PLUGIN_ROOT}/skills/research/references/source-rules.md`, the Law at
`${CLAUDE_PLUGIN_ROOT}/skills/start/references/law.md`, and today's date. The
output format is the `sources` array from
`${CLAUDE_PLUGIN_ROOT}/templates/sources.json` plus a `notes` field with the
findings in a few plain sentences.

## 2. Merge

1. Read the four files. Drop duplicates (same URL). Number the survivors
   S1, S2, ... and write `.skillsmith/02-sources.json`. Keep every
   `rejected` entry.
2. Run `skillsmith sources check` and fix every error.

## 3. Check every quote

Run `skillsmith sources verify`. It loads each page and looks for the quote.

- `confirmed` or `partial`: good.
- `unreachable`: the page did not load from here. That proves nothing either
  way. Keep the source, but do not rest a key decision on it alone.
- `not-found`: the quote is not on the page. Fetch the page yourself once to
  rule out a typo. If the words are really not there, the researcher made it
  up or misread it. Under the Law, delete that researcher's whole batch, tell
  the founder in one sentence, and run a fresh researcher on the same beat.
  Then merge and verify again.

## 4. Write the research

Fill `${CLAUDE_PLUGIN_ROOT}/templates/research.md` into
`.skillsmith/02-research.md`:

- Every fact gets a `[S#]` tag. No tag, no fact. Only `verified` sources.
- Numbers keep their date ("53.7k stars on 2026-10-01").
- The repos section links each repository by its GitHub URL with its license.
- "What this means for the product" turns findings into decisions.
- "Rejected" lists what you found but would not trust, and why.
- Keep every `<!-- ss:... -->` anchor.

## 5. Finish

Run `skillsmith advance research` and fix anything it lists. Then tell the
founder, in at most 6 lines: the two closest competitors, the biggest open
gap, and the one decision the research changes. If research contradicts a
must-have in the brief, say so and ask whether to change the brief. Offer the
dashboard (`skillsmith dashboard`, then open `.skillsmith/dashboard.html`).
