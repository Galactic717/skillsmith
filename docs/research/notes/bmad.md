# Notes: bmad-code-org/BMAD-METHOD (commit 1cbcfa2, 2026-09-28)

Size: ~18k lines of Python/JS/TOML outside tests plus ~40k lines of Markdown. v7 is skills-based
(`npx skills add bmad-code-org/BMAD-METHOD --skill bmad`), helper scripts run with `uv run`.
Read: skills/ inventory, bmad/SKILL.md, bmad-party-mode/SKILL.md, bmad-forge-idea/SKILL.md (full),
bmad-build-auto/workflow.md (lines 1-80), bmad-code-review/review-prompts/edge-case-hunter.md (lines 1-50),
tools/validate_skills.py (function inventory).

## Mechanisms worth adopting
- forge-idea: pressure-test a half-formed idea one question at a time with two voices per turn (one installed
  persona + one generated outsider: competitor, buyer, finance reviewer); "attack this / defend this / switch
  roles"; no praise ("Praise is noise"); three valid exits: HARDENED, KILLED (with an "Idea Death Certificate" and
  cause of death), CLARIFIED; renders a self-contained HTML report with a stamp.
- Append-only memlog per session (decision | assumption | crack | kill | direction | lock | note) so a session
  survives interruption; resume by reading frontmatter status.
- "Ready for Development" standard (build-auto/workflow.md): actionable, logical, testable (Given/When/Then),
  surface-anchored ("ACs observe the outermost surface the intent references — never a more internal proxy"),
  complete, sufficient, coherent.
- Review prompts as specialised roles: Edge Case Hunter (pure path tracer: lists unhandled branches only, no
  opinions, no severities) and Verification Gap. The claims/narrative file is read only AFTER path tracing so the
  narrative cannot bias the review (edge-case-hunter.md, inputs + Step 5).
- Unattended runs launch subagents as blocking calls in one message; background agents stall unattended runs.
- Party mode: session | auto | subagent | agent-team (Claude Code agent teams) — real independent agents only
  when independent thinking changes the outcome.
- Layered customisation (customize.toml, four-layer merge), activation steps, persistent facts; step files loaded
  progressively (step-01 … step-04) to keep context small.
- tools/validate_skills.py, validate_file_refs.py, validate_manifests.py: structural CI for skills.

## Gap vs Skillsmith
- Verification is still review-by-agent; no mechanical check of completion claims, no rival implementations.
- Setup needs Python/uv and BMad config; vocabulary is agile/developer (PRD, epics, stories).
