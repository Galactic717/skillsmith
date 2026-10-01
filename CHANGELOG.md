# Changelog

All notable changes are listed here. The project follows semantic versioning.

## 2.0.0 (2026-10-01)

A rebuild of the core and every skill. Breaking: the engine moved from
`plugins/skillsmith/scripts/skillsmith.mjs` to
`plugins/skillsmith/engine/skillsmith.js`, and Node.js 20 or newer is required.
Projects from 1.x are migrated automatically on first use.

### Product

- Founder framing: the person on the line is building their own product.
- English only, for a global audience. The Ukrainian README, dashboard text,
  videos and cards are gone.
- Interview: an idea check (HARDENED, CLARIFIED or KILLED), numbered
  requirements (R1 ...), measurable success criteria (SC1 ...) and a coverage
  map; the gate rejects a killed idea, a missing area or an unmeasurable
  criterion.
- Screenplay: every check lists the requirements it covers; the gate rejects
  an uncovered requirement. `acceptance vacuity` runs every check on the empty
  project and rejects checks that already pass. Regression guards are marked.
- Hidden checks: `holdout seal` moves a check set into a private store outside
  the project; official verification runs it, prechecks never do, and its
  details never reach the builders.
- Safety: every verified commit is scanned for committed secrets and for
  dependencies that do not exist in their registry. A team with a finding
  cannot be crowned.
- Ledger: every official decision is appended to a hash chain signed with an
  HMAC key kept outside the project. Scoring refuses records that no longer
  match their signed hash.
- Arena: `verify --all` judges every team in parallel; clean rooms live
  outside the project; a blind audit (claims read last); "too close to call";
  fusion re-verifies a merge of a loser's strengths.
- Hooks: a Stop guard against unverified claims; the pre-tool guard now covers
  reads of the private store and shell commands that write records.
- Every clean room gets its own free port (`$PORT`, `{{port}}` in http check
  URLs), so teams that serve a web page are verified at the same time.
- A worked example, `examples/trialguard/`, drives `npm run demo`, the
  dashboard screenshots and the videos.
- Live trigger evals through headless Claude Code (`npm run evals:triggers`).
- New videos, social cards, landing page and marketing kit, English only.

### Engineering

- Engine rewritten in strict TypeScript with Google-style lint and format
  rules, typed errors with stable exit codes, bounded reads, atomic writes,
  symlink-safe paths, hardened git calls and process-group timeouts.
- 46 tests, including a full in-process arena with real git repositories;
  coverage floor of 85% lines and functions.
- CI with read-only permissions, pinned actions, a Node 20/22/24 matrix,
  CodeQL, Scorecard, dependency review and Dependabot. SECURITY.md,
  CONTRIBUTING.md, CODE_OF_CONDUCT.md, AGENTS.md, issue and PR templates.
- Research published in `docs/research/`.

## 1.0.0 (2026-10-01)

First release: six stations, eight skills, nine agents, a dependency-free
Node.js engine, a slop detector, online quote checks, clean-room verification,
elimination with a graveyard, cross-examination, judging, a dashboard, a
landing page, videos and a launch kit.
