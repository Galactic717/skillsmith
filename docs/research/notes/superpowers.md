# Notes: obra/superpowers (commit 8ca22db, 2026-09-25)

Read so far: hooks/hooks.json, hooks/session-start, hooks/run-hook.cmd, package.json, index.js,
.claude-plugin/plugin.json, .codex-plugin/plugin.json, skills/using-superpowers/SKILL.md (+claude-code-tools.md),
AGENTS.md, skills/subagent-driven-development/SKILL.md, scripts/sdd-workspace, scripts/task-brief, scripts/review-package.

## Mechanisms
- Bootstrap: SessionStart hook (matcher startup|clear|compact) cats using-superpowers/SKILL.md into
  additionalContext wrapped in <EXTREMELY_IMPORTANT>. Emits platform-specific JSON shape (Cursor snake_case,
  Claude nested hookSpecificOutput, Copilot top-level). (hooks/session-start:39-51)
- Windows: polyglot run-hook.cmd (batch + bash heredoc trick), finds Git Bash, exits 0 silently if none.
- Multi-harness: separate manifests for Claude, Codex, Cursor, Devin, Kimi, Muse, OpenCode (JS plugin), Pi (TS ext),
  Hermes (py), Gemini extension. One skills/ folder shared.
- using-superpowers: "1% chance a skill applies => MUST invoke"; Red Flags table of rationalizations; user
  instructions > skills > defaults; <SUBAGENT-STOP> so subagents ignore the bootstrap.
- SDD (subagent-driven-development): fresh implementer per task; task review (spec + quality) per task; final
  whole-branch review on most capable model. Ledger file on disk (.superpowers/sdd/<plan>/progress.md) is the
  recovery map after compaction; "Task N: complete (commits a..b, review clean)". Rulings logged as
  "Ruling: what — why — cost if wrong" and reported verbatim at the end. Only 4 stop conditions (destructive,
  security, outside-worktree side effect, plan hopeless).
- Model selection per role, always explicit; "turn count beats token price"; cheapest tier only for transcription.
- Fix loop: max 5 rounds; rounds 1-3 resume the same implementer; 4-5 fresh implementer on stronger model;
  scoped re-review per round; breaker adjudication with ledger entries; no silent discards.
- Context hygiene: hand artifacts as files (task-brief extracts one task; review-package writes commits+stat+diff -U10
  to a file); never paste history; a real dispatch hit 42k chars of which 99% was pasted history.
- Implementer statuses: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Implementers never spawn subagents.
- Never parallel implementers on one tree.
- review-package guards: BASE must be ancestor of HEAD, non-empty range (exit 3).
- Workspace dir is git-ignored via a self-ignoring .gitignore ("*"), placed in the working tree (not .git/) because
  Claude Code protects .git/ from agent writes.

## Repo hygiene
- AGENTS.md for AI contributors: 94% PR rejection rate; must disclose model/harness; evals required for skill edits.
- PR template 143 lines; issue templates (bug, diagnosis, feature, platform).
- Skill-behaviour evals in a separate repo (superpowers-evals, "Quorum" drives real agent CLIs; acceptance test:
  "Let's make a react todo list" must auto-trigger brainstorming).
- Zero third-party dependencies by policy.
