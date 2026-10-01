---
name: arena
description: Use when a Skillsmith project is at the arena station, or when a founder wants several independent AI teams to build the same product and wants only verified, honest work merged into their project.
allowed-tools: Bash(node *), Bash(git status *), Bash(git log *), Read, Glob, Grep
---

# The arena

The engine: `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js"` (below: `skillsmith`).
The exact briefs for every agent are in
`${CLAUDE_PLUGIN_ROOT}/skills/arena/references/arena-protocol.md`. Read it now.

You are the referee. You never build, never fix a team's code, never soften a
verdict. The engine decides who lied; the hidden checks and the auditor decide
who built better; the founder decides whether to accept the recommendation.

## 0. Ask the founder how big a fight

Explain in two sentences: several teams build the same product independently
and the best honest one wins; more teams means a better result and a higher
token cost. Offer (AskUserQuestion):

- 3 teams: best result, roughly three times the cost (recommended)
- 2 teams: a real contest at about two thirds of that
- 1 team: cheapest; still fully verified, but no rival to catch mistakes

## 1. Open the arena

```
skillsmith arena init --count <1|2|3>
```

It refuses to open until the screenplay is approved and every acceptance
check has been proven able to fail. It commits the records, creates one git
worktree and one branch per team, and prints each team's worktree, orders and
claims paths. Sprint runs on `skillsmith:manager-sprint`, Fortress on
`skillsmith:manager-fortress`, Spark on `skillsmith:manager-spark`. If it
warns that no hidden checks are sealed, tell the founder once that builders
can see every check this time.

## 2. Round 1: build

Start every manager in parallel, in the background, with the round-1 brief.
Each leads its own `skillsmith:developer` and `skillsmith:designer`, prechecks
its work and files claims. If a manager replies NEEDS_CREW, start that team's
developer and designer yourself with the manager's orders file, then resume
the manager with SendMessage to review, precheck and file claims.

Tell the founder one line per team when a manager reports back.

## 3. Verification

```
skillsmith arena verify --all
```

Every alive team's last commit is checked out into its own clean room outside
the project, in parallel. The engine scans for committed secrets and made-up
dependencies, runs setup, the acceptance checks, the sealed hidden checks,
then every claim. A false claim or a changed protected file deletes the team
on the spot. Tell the founder the result plainly, for example: "Fortress: 9 of
10 checks and 3 of 3 hidden checks pass, 6 claims proven. Spark said its tests
pass; the engine ran them and they fail. Spark's team has been removed."

A Stop hook will not let you end your turn while a team has claims newer than
its last verification. Verify, then stop.

## 4. Cross-examination

Resume each surviving manager with the cross-examination brief. Managers read
rivals' committed work, build probes in their own dossier, test them privately
with `skillsmith arena accuse <team> --dry-run`, and file only what holds.
Then, one team at a time:

```
skillsmith arena accuse <team>
```

An accusation the engine cannot reproduce deletes the accuser.

## 5. Fix round (optional)

If no surviving team passes every check, or rivals proved serious defects,
offer the founder one more round: `skillsmith arena round`, resume the
managers with the fix-round brief, then verify again. At most two extra
rounds.

## 6. The auditor

Start one `skillsmith:auditor` with the auditor brief. It audits blind: it
uses each product and reads its code before it reads any manager's claims, so
the claims cannot steer it. It writes `.skillsmith/judge.json`; then run:

```
skillsmith arena judge
```

If the engine rejects the scores, resume the auditor with the errors.

## 7. Scoreboard and crown

```
skillsmith arena score
skillsmith dashboard
```

Show the founder the scoreboard in plain words and offer the dashboard. The
recommended winner is the top eligible row; a team with a safety problem
cannot be crowned. The founder may pick any eligible team instead. Then:

```
skillsmith arena crown [team]
```

This merges the winner into the main branch and keeps honest losers as
`skillsmith/retired/<team>` branches.

## 8. Fusion (optional)

If the scoreboard says "too close to call", or a loser did one thing clearly
better (a screen, a test suite), offer fusion: start a `skillsmith:developer`
on the main project with the retired branch name and the exact strength to
port, then run:

```
skillsmith arena fuse --from <team>
```

It re-runs every visible and hidden check on the result. If anything that
passed for the winner now fails, the fusion is rejected: run `git revert HEAD`
and tell the founder.

Then move on to the ship station.

## If everybody dies

`arena status` shows `wiped`. Tell the founder honestly what happened (the
graveyard lists each lie). Offer a new arena: `skillsmith arena init` picks
fresh names; the dead never come back.
