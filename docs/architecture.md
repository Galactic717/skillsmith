# Architecture

Skillsmith has two halves. **Skills and agents** (Markdown) do the creative
work and talk to the founder. **The engine** keeps state, guards gates, judges
the arena and signs every official decision. Agents call the engine; the engine
never takes an agent's word for anything.

## Components

| Part | Where | Role |
|---|---|---|
| Marketplace | `.claude-plugin/marketplace.json` | Makes the repository installable with `/plugin marketplace add` |
| Manifest | `plugins/skillsmith/.claude-plugin/plugin.json` | Name, version, metadata |
| Skills (8) | `plugins/skillsmith/skills/*/SKILL.md` | `start` (the foreman), one per station, `status` |
| Agents (9) | `plugins/skillsmith/agents/*.md` | researcher, hook-writer, screenwriter, manager-sprint, manager-fortress, manager-spark, developer, designer, auditor |
| Hooks | `plugins/skillsmith/hooks/hooks.json` | SessionStart context; PreToolUse guard; Stop guard |
| Engine | `engine/src` (TypeScript) → `plugins/skillsmith/engine` (committed JavaScript) | Everything that must not depend on an agent's honesty |
| Templates | `plugins/skillsmith/templates/` | Every artifact's shape, with `<!-- ss:... -->` anchors |
| References | `skills/*/references/` | The Law, question bank, source rules, hook playbook, screenplay guide, arena protocol, manager handbook, engineering standards, security checklist, design playbook, audit rubric |

The interviewer is a skill, not a subagent, on purpose: only the main
conversation can talk to the founder. Every other specialist is a subagent.
Managers start their own developer and designer as nested subagents (Claude
Code allows three levels); if nesting is off, a manager writes orders and the
referee starts the crew.

Skill descriptions say *when* to use a skill and never summarise its workflow.
A description that summarises the workflow makes the model follow the summary
instead of reading the skill (a finding from the superpowers project, see
`docs/research/`).

There is no top-level `bin/` folder, so Claude Cowork can install the plugin.

## Engine layers

```
engine/src
├── skillsmith.ts         entry point: run(argv, processContext)
├── cli/                  argument parsing, printing, one module per command group
├── hooks/handlers.ts     SessionStart, PreToolUse, Stop
├── domain/               stations, project state, brief, gates, checks, sources,
│   │                     slop, acceptance, holdout, vacuity, safety
│   ├── arena/            model, init, clean rooms, trial, accuse, graveyard,
│   │                     score, crown and fusion
│   └── report/           REPORT.md and dashboard.html
└── core/                 no domain knowledge: errors, fs, json, glob, git,
                          processes, ledger, paths, terminal, text
```

`core` never imports from `domain`; `domain` never prints; `cli` is the only
layer that writes to the terminal, through an `Io` interface so the whole CLI
runs in-process in tests.

## Data

| Where | What | Written by |
|---|---|---|
| `.skillsmith/state.json` | stations, approvals and the hash of every approved file | engine |
| `.skillsmith/ledger.jsonl` | hash-chained, HMAC-signed log of official decisions | engine |
| `.skillsmith/01-brief.md` ... `04-acceptance.json` | station outputs | agents, checked by gates |
| `.skillsmith/04-vacuity.json` | proof that every check fails before work starts | engine |
| `.skillsmith/arena.json`, `teams/*/verdict.json`, `graveyard.*`, `scoreboard.md` | the arena | engine |
| `.skillsmith/teams/<team>/claims.json`, `accusations.json`, `orders.md`, `probes/` | each team's dossier | managers |
| `.skillsmith/arena/<team>/` | each team's git worktree (git-ignored) | developers and designers |
| `~/.skillsmith/projects/<id>/` | ledger key, sealed hidden checks, holdout results, clean rooms | engine |

`SKILLSMITH_HOME` moves the private store. `SKILLSMITH_OFFLINE=1` skips
registry lookups (for tests and air-gapped machines).

## The checks

One runner judges acceptance checks, hidden checks, claims and accusations:
`command`, `http` (local only), `file_exists`, `file_absent`, `file_contains`,
`not_contains`, `acceptance` (refers to acceptance results, for claims) and
`manual` (unverifiable by design, worth nothing). Before a command runs, the
engine refuses `sudo`, deletes outside the project, downloads piped into a
shell, git history or config changes, publishing, power commands and any read
of the private store. Commands run in their own process group with a hard
timeout; output keeps its first and last 128 KB.

## Verification, step by step

`arena verify <team>|--all` does, for each alive team, in parallel:

1. Resolve the team's branch to a commit; count uncommitted files (reported,
   never judged); list protected files changed since the arena's base commit.
2. Check out that commit as a detached git worktree in the private store.
3. Scan for committed secrets and `.env` files; check every npm and PyPI
   dependency against its registry (run outside the project, so a committed
   `.npmrc` cannot redirect it).
4. Run the acceptance file's setup commands, then every visible check.
5. Write the sealed hidden-check files into the clean room, run the hidden
   checks, delete the files. Only titles and statuses reach the verdict; the
   details go to the private store.
6. Run every claim; `acceptance` claims refer to step 4's results.
7. Remove the clean room. Then, one team at a time: write the verdict, sign
   its hash into the ledger, and eliminate the team if it tampered or lied.

`arena precheck` runs steps 1 to 4 and 6, records nothing official and kills
nobody.

## Scoring

| Part | Points |
|---|---|
| Visible acceptance checks (weighted) | 40, or 60 when no hidden checks were sealed |
| Hidden checks (weighted) | 20 |
| Proven claims | 1 each, up to 10 |
| Upheld accusations against rivals | +3 each, up to 9 |
| Upheld accusations against you | −4 each |
| Auditor: fit, experience, craft | 0-10 each, with evidence |
| Safety problem | −10, and the team cannot be crowned |

Ties break on hidden checks, then the auditor, then acceptance. A margin of 2
points or less is reported as too close to call. Scoring loads each verdict,
accusation result and judge file only if its hash matches the latest signed
ledger entry; otherwise it stops with exit code 4.

## Hooks

| Event | Handler | Does |
|---|---|---|
| SessionStart | `sessionStart` | Project name, current station, arena state, files edited after approval |
| PreToolUse | `preToolUse` | Denies writes to engine records; during the arena, denies writes to protected files in team worktrees and to the acceptance file; always denies reads of the private store; denies shell commands that mention the store or write a record |
| Stop | `stopGuard` | Blocks once when a team's claims are newer than its last verdict |

A hook never breaks a session: any error inside a handler means "no opinion".

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | a check, gate or verification failed |
| 2 | wrong usage |
| 3 | unexpected error (a bug: please report it) |
| 4 | records were changed outside the engine |

## Threat model in one paragraph

The engine assumes the agents are capable and sometimes dishonest, not
malicious attackers with shell access to the founder's machine. Clean rooms,
refused commands, hardened git calls, hooks and the signed ledger make
cheating visible and expensive; they do not sandbox code. See
[SECURITY.md](../SECURITY.md).
