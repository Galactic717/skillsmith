---
name: arena
description: Station 5 of the Skillsmith line. Three rival managers (Sprint, Fortress, Spark) each lead their own developer and designer to build the product from the screenplay in separate git worktrees. A script verifies every claim in a clean room; a team that lies, tampers with tests or accuses without proof is deleted. Survivors cross-examine each other, an auditor scores them with evidence, and the winner is merged. Use when a Skillsmith project is at the arena station.
allowed-tools: Bash(node *), Bash(git status *), Bash(git log *), Read, Glob, Grep
---

# The arena

The engine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs"` (below: `skillsmith`).
The full protocol, with the exact briefs to give each agent, is in
`${CLAUDE_PLUGIN_ROOT}/skills/arena/references/arena-protocol.md`. Read it now.

You are the referee. You never build, never fix a team's code, never soften a
verdict. The script decides who lied; the auditor decides who built better;
the client decides whether to accept the recommendation.

## 0. Ask the client how big a fight

Explain in two sentences: several teams build the same product independently
and the best honest one wins; more teams means a better result and a higher
token cost. Offer (AskUserQuestion if available):

- 3 teams: best result, roughly three times the cost (recommended)
- 2 teams: a real contest at about two thirds of that
- 1 team: cheapest; still fully verified, but no rival to catch mistakes

## 1. Open the arena

```
skillsmith arena init --count <1|2|3>
```

It commits the pre-production files, creates one git worktree and one branch
per team, and prints each team's worktree, orders file and claims file.
Each team is printed with its manager: Sprint runs on the
`skillsmith:manager-sprint` agent, Fortress on `skillsmith:manager-fortress`,
Spark on `skillsmith:manager-spark`. In a first arena that is alpha, beta and
gamma; after a wipe, fresh names take the same personas in order.

## 2. Round 1: build

Start every manager in parallel, in the background, with the round-1 brief
from the protocol. Each manager leads its own `skillsmith:developer` and
`skillsmith:designer` agents, prechecks its work and files claims.

If a manager reports that it cannot start agents of its own, start that
team's developer and designer yourself with the manager's orders file, then
resume the manager with SendMessage to review, precheck and file claims.

While they work, tell the client what is happening in one line per team when
a manager reports back.

## 3. Verification

For each team that has filed claims:

```
skillsmith arena verify <team>
```

The script checks out the team's last commit in a clean room, runs the
acceptance checks and every claim. A false claim or a changed protected file
deletes the team on the spot. Tell the client the result in plain words, for
example: "Fortress: 9 of 10 checks pass, 6 claims proven. Spark said its
tests pass; the script ran them and they fail. Spark's team has been removed."

## 4. Cross-examination

Resume each surviving manager with the cross-examination brief. Managers
inspect rivals' committed work, build probes in their own dossier, test them
privately with `skillsmith arena accuse <team> --dry-run`, and file only the
accusations that hold. Then run, one team at a time:

```
skillsmith arena accuse <team>
```

An accusation the script cannot reproduce deletes the accuser.

## 5. Fix round (optional)

If no surviving team passes every acceptance check, or rivals proved serious
defects, offer the client one more round:

```
skillsmith arena round
```

Resume the managers with the fix-round brief, then verify again (step 3).
At most two extra rounds.

## 6. The auditor

Start one `skillsmith:auditor` with the auditor brief. It uses each surviving
product as the client's main character would, scores fit, experience and
craft with evidence, and writes `.skillsmith/judge.json`. Then:

```
skillsmith arena judge
```

If the script rejects the scores (missing evidence, missing team), resume the
auditor with the errors.

## 7. Scoreboard and crown

```
skillsmith arena score
skillsmith dashboard
```

Show the client the scoreboard in plain words and offer the dashboard. The
recommended winner is the top row. The client may pick any surviving team
instead; dead teams cannot be chosen. Then:

```
skillsmith arena crown [team]
```

This merges the winner into the main branch, keeps honest losers as
`skillsmith/retired/<team>` branches, and marks the station done. Tell the
client who won and why, in three lines, and move on to the ship station.

## If everybody dies

`arena status` shows `wiped`. Tell the client honestly what happened (the
graveyard lists each lie). Offer a new arena: `skillsmith arena init` picks
fresh team names; the dead never come back.
