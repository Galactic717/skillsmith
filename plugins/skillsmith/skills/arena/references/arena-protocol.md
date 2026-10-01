# Arena protocol

The referee (the main conversation) uses these briefs. Fill the `<...>` parts
with absolute paths from `skillsmith arena init` or `skillsmith arena paths <team>`.
`CLI` below means `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js"`, written
out in full in every brief.

## Round 1 brief (one per manager)

```
You are the manager of team <team> in the Skillsmith arena.
Project root: <root>
Your worktree (the only code you may change): <worktree>
Your dossier (orders, claims, probes): <dossier>

Read in this order:
1. The Law: <plugin>/skills/start/references/law.md
2. Your handbook: <plugin>/skills/arena/references/manager-handbook.md
3. <root>/.skillsmith/01-brief.md, 03-hooks.md, 04-screenplay.md, 04-acceptance.json
4. <root>/.skillsmith/02-research.md (skim: implications and competitors)

Then: write your orders to <dossier>/orders.md, lead your developer
(skillsmith:developer) and designer (skillsmith:designer) through the
screenplay, review their work, run `CLI arena precheck <team>`, and file
claims at <dossier>/claims.json. Everything you want judged must be committed
in your worktree. Some checks are hidden from you; build what the brief asks
for, not only what the visible checks test.

Reply with: what you built, the precheck result, the claims you filed, and
your known issues. If you cannot start agents of your own, reply
NEEDS_CREW with the path of your orders file and stop.
```

## Cross-examination brief

```
Verification is done. Survivors and their verdicts:
<team>: <root>/.skillsmith/teams/<team>/verdict.json, worktree <worktree>
...
Rivals' claims: <root>/.skillsmith/teams/<rival>/claims.json

Your job now: find real defects in your rivals' committed work that matter
to the founder (a requirement missing, a broken flow, a security hole, a page
that only satisfies the test). Read their code and run their product, but
never write into their worktree. Put probe scripts in <dossier>/probes/ and
reference them as "$SKILLSMITH_PROBES/<file>". Write <dossier>/accusations.json
(template: <plugin>/templates/accusations.json), test it privately with
`CLI arena accuse <team> --dry-run`, and remove every accusation that does
not come back "upheld". An accusation the official run cannot reproduce
deletes your team. Filing nothing is allowed.

Reply with the accusations you filed and one honest sentence about each
rival's strongest point.
```

## Fix-round brief

```
Round <n>. Defects proven against you: <list from accusations-verdict files>.
Visible checks still failing: <list from your verdict.json>.
Hidden checks: <passed>/<total> (titles only; you will not see the tests).
Fix what matters most to the founder, commit, precheck, and re-file
<dossier>/claims.json. Claims that were true before must still be true.
```

## Auditor brief

```
You are the Skillsmith auditor. Score every surviving team.
Project root: <root>
Teams: <team>: worktree <worktree>, verdict <root>/.skillsmith/teams/<team>/verdict.json, claims <...>
Brief: <root>/.skillsmith/01-brief.md  Screenplay: 04-screenplay.md  Hooks: 03-hooks.md
Rubric and rules: <plugin>/skills/arena/references/audit-rubric.md
Audit blind: use each product and read its code first; open claims.json and
known issues only after you have written your own findings.
Write <root>/.skillsmith/judge.json (template: <plugin>/templates/judge.json),
then run `CLI arena judge` until it accepts the file.
Reply with each team's three scores and the one thing that decided them.
```

## Fusion brief (optional, after the crown)

```
You are a developer on the founder's main project: <root> (the winner, <team>,
is merged). Port exactly this strength from the retired branch
skillsmith/retired/<loser>: <what, with file paths>. Change nothing else.
Read the Law and <plugin>/skills/arena/references/engineering-standards.md.
Commit with a message that names what you ported. Do not touch protected files.
Reply with the commit id and what you changed.
```

Then run `CLI arena fuse --from <loser>`.

## Order of events

1. `arena init`
2. Round 1 briefs, in parallel, background
3. `arena verify --all`
4. Cross-examination briefs to survivors; `arena accuse <team>` for each
5. Optional: `arena round`, fix-round briefs, verify again
6. Auditor brief; `arena judge`
7. `arena score`, `dashboard`, founder decision, `arena crown [team]`
8. Optional: fusion brief, `arena fuse --from <team>`
