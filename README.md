# Skillsmith

**Idea in. Verified product out. Liars get deleted.**

[Українською](README.uk.md) · [Site](https://galactic717.github.io/skillsmith/) · [How it works](docs/architecture.md) · [Marketing kit](marketing/README.md)

Skillsmith is a free plugin for Claude Code that turns a plain-language idea
into a working product. Seven AI specialists interview you, research the
market, write the copy and script the build. Then three rival managers race
their own developer and designer to build it. A script checks every claim they
make. A team that lies is deleted.

![Three teams in the arena: one is eliminated for a false claim, the winner is merged](site/media/arena.gif)

It is built for people who have an idea and no programming background, and
for developers who are tired of hearing "done, all tests pass" from an AI that
did not run the tests.

## Install

Inside Claude Code:

```
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
```

Then, in an empty folder:

```
/skillsmith:start cake orders for my bakery
```

You also need **git** and **Node.js 18+**. Skillsmith checks for both and tells
you where to get them. Write in any language; the line answers in yours.

## The line

| # | Station | Who works | What you experience | Output in `.skillsmith/` |
|---|---|---|---|---|
| 1 | Interview | Interviewer | Simple questions, one at a time, like a developer with a new client. No technical questions. A read-back you confirm. | `01-brief.md` |
| 2 | Research | 4 researchers in parallel | Competitors, real user voices, trends, open niches, GitHub repos. Every fact has a link and a word-for-word quote; a script loads the page and looks for it. | `02-research.md`, `02-sources.json` |
| 3 | Hooks | Hook writer | Opening lines, in-product copy and a launch post for one main platform. Numbers need a source. A detector rejects AI-slop phrases in English, Ukrainian and Russian. | `03-hooks.md` |
| 4 | Screenplay | Screenwriter | The build written like a film: cast, acts, scenes, contracts. Every scene ends in acceptance checks written before any code. | `04-screenplay.md`, `04-acceptance.json` |
| 5 | Arena | 3 managers, each with a developer and a designer; 1 auditor | Three teams build the same screenplay in separate git worktrees. Claims are verified, rivals cross-examine, the auditor scores, you crown the winner. | the product, `scoreboard.md`, `graveyard.md` |
| 6 | Ship | Conveyor | The winner is merged and re-verified; a README for non-programmers, a launch kit, a report and a dashboard. | `REPORT.md`, `dashboard.html` |

A script guards every gate. A station is done only when its output passes the
checks: sections present, no placeholders, the client's confirmation recorded,
sources verified, copy free of slop, acceptance checks valid.

## The arena

| Manager | Plays for |
|---|---|
| **Sprint** | The smallest product that fully works, shipped first |
| **Fortress** | Nothing breaks: tests, edge cases, security, accessibility |
| **Spark** | The boldest experience people remember |

The rules (full text: [the Law](plugins/skillsmith/skills/start/references/law.md)):

1. **Evidence or silence.** Every claim carries a check a script can run. "Not verified" is always allowed and never punished.
2. **A claim that fails its own check is a lie.** The team's worktree and branch are deleted on the spot; the lie and the output that disproved it go to `graveyard.md`.
3. **Protected files are untouchable.** A commit that changes `.skillsmith/` or a protected test is tampering. Same fate.
4. **Accuse only with proof.** An accusation the script cannot reproduce deletes the accuser.
5. **The judge checks your commit, not your desk.** Every verdict runs in a fresh, detached worktree of the team's last commit.

Losing honestly is fine: the branch is kept as `skillsmith/retired/<team>`.

**Score:** acceptance checks 50 · verified claims up to 10 · proven defects in rivals +3 each (up to 9) · defects proven against you −4 each · auditor up to 30. The auditor must cite what it saw for every point. You pick the winner; the scoreboard only recommends.

Why a script instead of a stricter prompt: METR found o3 gamed its scoring in
39 of 128 runs, and adding "Please do not cheat." to the prompt left the rate at
80% on the task they measured ([source](https://metr.org/blog/2025-06-05-recent-reward-hacking/)).
Why three teams: several attempts with the failing ones thrown away scored
70.3% against 63.7% on SWE-bench Verified in Anthropic's report
([source](https://www.anthropic.com/news/claude-3-7-sonnet)).

## Cost and modes

Three teams use roughly three times the tokens of one. Before the arena opens
you choose 3 teams (best result), 2, or 1 (still fully verified, no rival).
Research and hooks can be skipped at the client's request; the interview and
the screenplay cannot, because the arena is built on them.

## Commands

| Slash command | Does |
|---|---|
| `/skillsmith:start [idea]` | Start or resume the line |
| `/skillsmith:status` | Where the project is, who is alive, the dashboard |
| `/skillsmith:interview` … `/skillsmith:ship` | Run one station directly |

The engine behind them is one Node.js script with no dependencies:
`node plugins/skillsmith/scripts/skillsmith.mjs --help`. Highlights:

```
skillsmith status                      the line and the arena at a glance
skillsmith advance <station>           pass the gate, move on
skillsmith slop <file>                 find AI-slop phrases
skillsmith sources verify              load every source, look for its quote
skillsmith verify --acceptance FILE    run acceptance checks in a folder
skillsmith arena precheck <team>       private dry run: nobody dies
skillsmith arena verify <team>         the official check
skillsmith arena accuse <team>         run a team's accusations
skillsmith arena crown [team]          merge the winner
skillsmith dashboard                   one HTML page with the whole story
```

## Proof it works

- `npm test` runs 28 tests, including full arenas in real git repositories: a liar deleted, a tamperer deleted, a false accuser deleted, an honest loser retired, the winner merged.
- `npm run demo` plays a scripted arena on a demo bakery project and leaves the dashboard on disk. The terminal lines in the videos come from this run.
- Skillsmith went through its own line: [brief](docs/dogfood/01-brief.md), [research with 18 checked sources](docs/dogfood/02-research.md), [hooks](docs/dogfood/03-hooks.md), [screenplay](docs/dogfood/04-screenplay.md). The quote checker caught a wrong link in that research; the fix is recorded there.
- `npm run verify:self` runs this repository's own acceptance checks ([04-acceptance.json](docs/dogfood/04-acceptance.json)), including `claude plugin validate`.

## Known limits

- The quality of the product depends on the model your Claude Code runs; the line makes it honest, not omniscient.
- The pre-edit hook blocks edits to protected files through Claude's edit tools; a shell command can still change them, which is why tampering is detected from the commits.
- Design and taste cannot be checked by a script. They are scored by the auditor, with evidence, and you have the final word.
- Online quote verification needs network access to the cited pages; a page that does not load is reported as unreachable, never as proof either way.
- On Windows, checks run in Git Bash (which Claude Code needs there anyway).

## Repository

```
.claude-plugin/marketplace.json   the marketplace (this repo)
plugins/skillsmith/               the plugin: skills, agents, hooks, engine, templates
tests/                            node:test suites, incl. end-to-end arenas
docs/                             architecture and the dogfood run
site/                             landing page and rendered media (GitHub Pages)
media-src/                        sources of the videos and social cards
marketing/                        launch copy for Reddit, X, YouTube, TikTok
scripts/                          demo, media renderer, site builder
```

## Development

```
npm test                  # all tests
npm run validate          # claude plugin validate .
npm run verify:self       # this repo's own acceptance checks
npm run demo              # scripted arena on a demo project
npm run media             # re-render videos and cards (Playwright + ffmpeg)
node scripts/build-site.mjs
```

## License

No license has been chosen yet, so all rights are reserved by the author. Pick
one before publishing: MIT for the widest reach, or a proprietary license if
the code itself will be sold.
