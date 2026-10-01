# Screenplay: Skillsmith

<!-- ss:logline -->
## Logline

A founder who cannot code wants a product that really works; AI agents keep saying "done" when it isn't; a
production line where a program checks every claim, hides some tests and deletes liars gives the founder a
product they can trust.

<!-- ss:cast -->
## Cast

- **Protagonist:** Maya, a designer with a side-project idea (TrialGuard: a site that warns before a free
  trial charges). She has never opened a terminal on purpose.
- **Antagonist:** the confident agent that says "all tests pass" without running them, and builds to the test
  when it does.
- **Supporting:** the interviewer, four researchers, the hook writer, the screenwriter, three managers with a
  developer and a designer each, the auditor, and the engine that trusts none of them.

<!-- ss:world -->
## World: technical decisions in plain words

Skillsmith lives inside Claude Code as a plugin, so the founder installs nothing new except Node.js and git.
The engine is a TypeScript program compiled to plain JavaScript with no runtime dependencies, so it runs the
same on every machine. Each rival team works in its own copy of the project (a git worktree), and the engine
judges each team in a fresh copy outside the project (a clean room), so leftovers never count.

Technical appendix: TypeScript 6 (strict, Google-style lint and format), Node.js 20+, git worktrees,
SHA-256 hash chain plus HMAC-SHA256 for the ledger, `node:test` for tests, GitHub Actions with pinned
actions, CodeQL and Scorecard.

Contracts: the engine is `plugins/skillsmith/engine/skillsmith.js`; skills call it through
`${CLAUDE_PLUGIN_ROOT}`; records live in `.skillsmith/`; private data in `~/.skillsmith/projects/<id>/`.

<!-- ss:act1 -->
## Act I: Foundation

### Scene 1.1: "The plugin installs"
- **Goal:** the founder adds the marketplace, installs the plugin and sees `/skillsmith:start`.
- **Who:** developer
- **Requirements:** R9
- **Acceptance:** A1, A2, A3, A4

### Scene 1.2: "The engine answers"
- **Goal:** `skillsmith help` lists every station and arena command; the Law is in place.
- **Who:** developer
- **Requirements:** R5
- **Acceptance:** A5, A6

<!-- ss:act2 -->
## Act II: Core

### Scene 2.1: "The interview"
- **Goal:** Maya answers plain questions, hears the strongest objection to her idea, and confirms a brief with numbered requirements.
- **Who:** developer (gates), designer (question wording)
- **Requirements:** R1
- **Acceptance:** A7, A8

### Scene 2.2: "Research with receipts"
- **Goal:** every fact in the research has a link and a quote the engine finds on the page.
- **Requirements:** R2
- **Acceptance:** A9, A10

### Scene 2.3: "Copy without slop"
- **Goal:** the launch post passes the slop detector and every number has a source tag.
- **Requirements:** R3
- **Acceptance:** A11, A12

### Scene 2.4: "Checks that can fail"
- **Goal:** each requirement maps to a check; each check fails before work starts; some checks are sealed away.
- **Requirements:** R4, R6
- **Acceptance:** A13, A14

### Scene 2.5: "The arena"
- **Goal:** three teams build; a liar and a tamperer die; hidden checks run; the ledger catches an edited verdict.
- **Requirements:** R5, R6, R7
- **Acceptance:** A15, A16, A17

<!-- ss:act3 -->
## Act III: Polish and launch

### Scene 3.1: "Hand-over"
- **Goal:** the founder reads a README, a report and a dashboard in plain English, with no other language mixed in.
- **Requirements:** R8
- **Acceptance:** A18, A19

<!-- ss:cut -->
## Cut scenes (not in version one)

- A web version without a terminal.
- A league table of managers across projects.

<!-- ss:acceptance -->
## Acceptance checks

Machine version: `04-acceptance.json`. Run them with `npm run verify:self`. The end-to-end arena test
(`engine/test/arena.test.ts`) plays scene 2.5 with real git repositories on every CI run.
