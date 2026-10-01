# Notes: Anthropic's own repositories

## anthropics/claude-plugins-official (commit ab024cd, 2026-09-30)
Read: plugins/ and external_plugins/ inventories, plugins/code-review/commands/code-review.md (full),
plugins/feature-dev/commands/feature-dev.md (full), plugins/ralph-loop (README 1-60, hooks.json, stop-hook.sh 1-80),
plugins/receipts/README.md (full).

- code-review: Haiku agents for triage, 5 parallel Sonnet reviewers with different lenses (CLAUDE.md compliance,
  shallow bug scan, git blame history, previous PR comments, code comments), then one Haiku scorer per issue with a
  verbatim 0-25-50-75-100 confidence rubric; issues under 80 are dropped; an explicit false-positive list
  (pre-existing issues, linter-catchable issues, nitpicks, unmodified lines).
- feature-dev: 7 phases; 2-3 code-architect agents in parallel with different focuses ("minimal changes", "clean
  architecture", "pragmatic balance"); the human picks; 3 reviewers with different focuses. This is Anthropic's own
  version of "several rival designs, user chooses" — the Skillsmith arena takes it to full implementations.
- ralph-loop: a Stop hook blocks the session from ending and re-feeds the prompt until a completion promise appears
  or max iterations; state file scoped by session_id; corrupted state stops the loop safely.
- receipts: deliberately reports no dollar figures or "hours saved" ("each would be a guess dressed up as a
  measurement, and one bad number discredits the rest"); explicit privacy section listing exactly what reaches the
  model.
- Model tiering inside one workflow: Haiku for cheap triage/scoring, Sonnet for review.

## anthropics/skills (commit 8a1541c, 2026-09-28)
Read: skills/ inventory, skill-creator/SKILL.md (writing guide, test cases, running evals, description
optimisation), frontend-design/SKILL.md (in v1 research).

- Progressive disclosure: metadata (~100 words) always loaded; SKILL.md < 500 lines; references loaded on demand,
  with a table of contents when > 300 lines.
- Evals: 2-3 realistic prompts per skill; run with-skill and baseline (no skill / old skill) in the same turn;
  assertions drafted while runs execute; blind comparison via comparator/analyzer agents.
- Description optimisation: 20 trigger queries (8-10 should, 8-10 near-miss should-not), 60/40 train/test split,
  each query run 3 times, best description chosen on held-out test score (avoids overfitting).
- Claude only consults skills for tasks it cannot trivially do itself; trigger tests must be substantive.

## Consequences for Skillsmith
1. Skill descriptions say WHEN to use, not the workflow (superpowers SDO finding + Anthropic triggering notes).
2. Ship trigger evals and behaviour evals that run through headless `claude -p`.
3. Rival designs are an established Anthropic pattern (feature-dev); the arena extends it from designs to
   verified implementations.
4. Never publish a number we cannot back (receipts).
