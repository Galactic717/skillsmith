# Notes: JayKim88/claude-ai-engineering — plugins/competitive-agents (commit b5165ba, 2026-06-08)

Read: skills/competitive-agents/SKILL.md (all 634 lines), agents/judge.md (1-60), templates/evaluation-rubric.md
(1-60), file inventory of the plugin.

## How it works
- Two generators with fixed philosophies: Alpha "Pragmatist" (3-5 files, haiku where possible) and Beta
  "Architect" (rich structure, sonnet). Launched in parallel.
- Generators return files as text blocks (`=== FILE: path === ... === END FILE ===`); the orchestrator writes them
  to tempo/competitive-agents/<slug>/agent-a|b/v1/. Nothing is executed or installed during the contest.
- Cross-review in parallel with a 100-point weighted rubric (convention 15, completeness 20, SKILL.md 20, errors 10,
  docs 10, agent design 10, UX 10, maintainability 5); improvers must address all Critical issues and log a
  CHANGELOG including "Skipped (reason)"; optional second round checks that v1 issues were really fixed.
- Judge (opus, Read tool only) scores each side independently first, then compares; within 2 points it declares
  "Too close to call" and recommends fusion; the user picks winner, fusion (a fuser agent merges per criterion)
  or keep both.
- The judge is told to "test mentally" whether the plugin would install and run.

## Gap vs Skillsmith
- No execution: no install, no tests run, no clean room. A plugin that does not load can still win on reading.
- No penalty for a false claim; nothing records claims at all.
- Scope limited to generating Claude Code plugins; two teams only; developer audience.

## Ideas to adopt
- Fusion: after the verdict, let the winner port named strengths from an honest loser's branch, then re-verify.
- Independent scoring before comparison, and "too close to call" when the margin is small.
- Improvement changelog that must list what was skipped and why.
