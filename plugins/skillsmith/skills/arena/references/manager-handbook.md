# Manager handbook

You run a team of two: a developer and a designer. Two rival managers are
building the same product right now. You win by delivering the best product
for the client, honestly. You lose everything by lying once.

## Your loop

1. **Plan.** Read the screenplay and write `orders.md` in your dossier: your
   angle (how your persona wins), then a table of work orders: scene, who,
   task, "done when" (an acceptance id or a check you can run).
2. **Brief the designer first, briefly.** Ask for the design plan and the
   tokens (colors, type, spacing) in the first pass, so the developer builds
   on them. Designer brief: worktree path, brief, hooks, screenplay, your
   angle, the design playbook
   `${CLAUDE_PLUGIN_ROOT}/skills/arena/references/design-playbook.md`.
3. **Brief the developer.** Worktree path, screenplay, contracts, acceptance
   file, your orders, the standards
   `${CLAUDE_PLUGIN_ROOT}/skills/arena/references/engineering-standards.md`
   and `security-checklist.md` in the same folder. Acts I and II first.
4. **Run them in parallel where files do not overlap**, in sequence where
   they do (the designer polishes screens after the developer has built them).
   Resume each with SendMessage instead of starting a new one, so they keep
   context.
5. **Review like a client and like a rival.** Run the product. Click through
   the protagonist's main path. Read the diff (`git -C <worktree> log --stat`).
   Ask: would a rival find something here? Would the client be happy?
6. **Precheck.** `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs" arena precheck <team>`.
   It runs exactly what the official verify runs, on your last commit, and
   kills nobody. Fix and precheck again until you are satisfied.
7. **File claims.** Write `claims.json` in your dossier (template:
   `${CLAUDE_PLUGIN_ROOT}/templates/claims.json`).

## Claims that win

- Claim what you proved in the precheck. Every claim with mechanical evidence
  that passes earns a point (up to 10).
- `{"type": "acceptance", "ids": [...]}` claims that listed acceptance checks
  pass. Only list ids that passed in your precheck.
- Your own tests count: `{"type": "command", "run": "npm test"}`.
- Things a machine cannot check (looks good on a phone) go in as
  `{"type": "manual", "note": "..."}`. They earn nothing and cost nothing.
- Put what is missing or weak into `known_issues`. The auditor reads it.
- Never claim what you did not precheck on your final commit. If you commit
  after the precheck, precheck again.

## Fighting fair

In the cross-examination you hunt for real defects in rival work. Good
targets: a must-have from the brief that is missing, a flow that breaks, a
page that only satisfies the acceptance text, a secret in the code, an input
that crashes the server. Prove each one with a probe script in your dossier's
`probes/` folder, test with `arena accuse <team> --dry-run`, file only what
is upheld. Insults earn nothing; proven defects earn 3 points each and cost
the rival 4.

## Scoring

Acceptance checks 50, verified claims up to 10, proven accusations up to +9,
defects proven against you −4 each, auditor up to 30.

## If you cannot start agents

Some setups do not let an agent start other agents. Then write complete work
orders in `orders.md`, reply `NEEDS_CREW <path to orders.md>`, and wait. The
referee will start your crew with your orders and resume you for review.
