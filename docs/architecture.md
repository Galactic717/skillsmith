# Architecture

Skillsmith has two halves. **Skills and agents** (Markdown) do the creative
work and talk to the client. **The engine** (`plugins/skillsmith/scripts/`,
plain Node.js, no dependencies) keeps state, guards gates and judges. Agents
call the engine; the engine never takes an agent's word for anything.

## Components

| Part | Where | Role |
|---|---|---|
| Marketplace | `.claude-plugin/marketplace.json` | Makes the repo installable with `/plugin marketplace add` |
| Manifest | `plugins/skillsmith/.claude-plugin/plugin.json` | Name, version, metadata |
| Skills (8) | `plugins/skillsmith/skills/*/SKILL.md` | `start` (the foreman), one per station, `status` |
| Agents (9) | `plugins/skillsmith/agents/*.md` | researcher, hook-writer, screenwriter, manager-sprint, manager-fortress, manager-spark, developer, designer, auditor |
| Hooks | `plugins/skillsmith/hooks/hooks.json` | SessionStart context; PreToolUse guard on protected files |
| Engine | `plugins/skillsmith/scripts/skillsmith.mjs` + `lib/` | State, gates, slop detector, source checker, check runner, arena, report, dashboard |
| Templates | `plugins/skillsmith/templates/` | Every artifact's shape, with `<!-- ss:... -->` anchors |
| References | `skills/*/references/` | The Law, question bank, source rules, hook playbook, screenplay guide, arena protocol, manager handbook, engineering standards, security checklist, design playbook, audit rubric |

The interviewer is a skill, not a subagent, on purpose: only the main
conversation can talk to the client. Every other specialist is a subagent.
Managers start their own developer and designer as nested subagents (Claude
Code allows three levels); if nesting is off, the manager writes orders and
the referee starts the crew.

There is no top-level `bin/` folder, so Claude Cowork can install the plugin.

## Engine modules

| Module | Responsibility |
|---|---|
| `util.mjs` | Paths, atomic JSON/text writes, glob matching, root discovery (a path inside a team worktree resolves to the arena's owner) |
| `pipeline.mjs` | Stations, state, gates per station |
| `slop.mjs` | Weighted phrase lexicon (en/uk/ru), density score, em-dash rule only for Latin text, ignore regions and inline-code mentions |
| `artifacts.mjs` | Validators for sources, acceptance checks, claims, accusations, judge scores |
| `checks.mjs` | One runner for every kind of evidence: `command`, `http`, `file_exists`, `file_absent`, `file_contains`, `not_contains`, `acceptance`, `manual`; unsafe-command and path-escape refusal |
| `sources.mjs` | Online quote verification with HTML stripping and typography normalisation |
| `git.mjs` | Array-argument git wrapper; worktrees; identity fallback |
| `arena.mjs` | Arena lifecycle: init, trial (precheck/verify), accuse, kill, judge, score, crown |
| `report.mjs` | `REPORT.md` and the self-contained `dashboard.html` (en/uk) |
| `hooks.mjs` | Hook handlers that never fail a session |

## Files in a client project

```
.skillsmith/
  state.json                 stations and their status
  01-brief.md                confirmed brief
  02-research.md             research, every fact tagged [S#]
  02-sources.json            sources with exact quotes
  03-hooks.md                copy
  04-screenplay.md           acts, scenes, contracts
  04-acceptance.json         machine checks, protected globs, setup commands
  arena.json                 teams, base commit, events
  teams/<team>/              dossier: orders.md, claims.json, accusations.json,
                             probes/, verdict.json, precheck.json
  judge.json                 auditor scores with evidence
  scoreboard.md              computed scores
  graveyard.json / .md       the dead, forever, with evidence
  REPORT.md, dashboard.html  the story for the client
  arena/<team>/              git worktrees (git-ignored)
```

Everything except the worktrees is committed, so the history of the arena is
part of the project's git history.

## Verification model

1. **Acceptance checks are written before code** by the screenwriter and
   committed before the arena opens (`arena init` refuses otherwise).
2. **Every verdict runs in a clean room:** a detached worktree of the team's
   current branch head, created for the run and removed after. Setup commands
   (`npm install`) run there first. Uncommitted work is ignored.
3. **Tampering** is any path changed between the arena's base commit and the
   team's head that matches `.skillsmith/**` or the acceptance file's
   `protected` globs.
4. **A claim** is `{id, text, evidence}`. Evidence that runs and passes is
   verified; evidence that runs and fails is false; errors, timeouts, unsafe
   commands and `manual` evidence are unverifiable. Only *false* kills.
5. **An accusation** is evidence that passes when the defect exists, run in a
   clean room of the target's head with `$SKILLSMITH_PROBES` pointing at the
   accuser's probes folder. Pass = upheld, fail = perjury (accuser dies),
   anything else = dismissed. `--dry-run` lets managers test first.
6. **Crown** requires a passing verdict on the exact current head of the
   winner and valid judge scores; it merges with `--no-ff`, retires honest
   losers to `skillsmith/retired/<team>`, and commits the records.

## Safety

Checks run commands that agents wrote, on the client's machine. The runner:

- refuses commands matching a denylist (sudo, deleting outside the project,
  piping downloads into a shell, git history and remote operations,
  publishing, power commands, leaving the folder);
- refuses file paths that are absolute or escape the project;
- allows HTTP checks only against localhost;
- applies timeouts and kills the whole process tree of started servers;
- runs inside a disposable worktree.

This lowers risk; it is not a sandbox. The README says so.

## Scoring

`acceptance (50 × passed weight / total weight) + min(10, verified claims)
+ min(9, 3 × upheld accusations made) − 4 × upheld accusations received
+ auditor (fit + experience + craft, 0–10 each)`. Ties break on the auditor's
score, then acceptance.

## Extending

- **More stations:** add a skill, a template with anchors, and a gate in
  `pipeline.mjs`; add the stage to `STAGES`.
- **New evidence types:** add a branch in `checks.mjs` (`validateCheck` and
  `runCheck`) and a test.
- **More personas:** add a manager agent and an entry to `PERSONAS` in
  `arena.mjs`.
- **Other languages for the slop detector:** add a rule list in `slop.mjs`;
  Cyrillic-aware word boundaries are already handled.
