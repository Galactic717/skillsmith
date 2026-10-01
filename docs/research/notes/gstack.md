# Notes: garrytan/gstack (commit 96764e8, 2026-09-29)

Size: ~99k lines of TypeScript outside tests (Bun), plus generated SKILL.md files from SKILL.md.tmpl.
Read: ETHOS.md (full), ARCHITECTURE.md (section map), package.json scripts, lib/review-evidence.ts (lines 1-200),
bin/gstack-evidence (header + types), lib/qa-evidence.ts (lines 1-60), bin/ inventory.

## Mechanisms worth adopting
- Evidence ledger (bin/gstack-evidence): the tool itself runs `-- <cmd>` and appends {ts, label, command,
  cmd_sha256, exit, duration_s, commit, tree, dirty, wtree, log_path} to a JSONL ledger; logs capped at 2 MB with a
  truncation marker, file mode 0600. Transparency invariant: the wrapper's exit code is always the child's.
  `check --label L --expect-cmd "<exact>" --max-age <h>` decides FRESH/STALE/MISSING.
- Freshness is bound to a working-tree content fingerprint (wtree) so evidence is valid only for the exact bytes
  that were tested (review-evidence.ts: start token captured at review start; review "verified" only if start and
  end wtree match).
- Hardened git calls: --no-replace-objects, core.fsmonitor=false, GIT_OPTIONAL_LOCKS=0, GIT_LITERAL_PATHSPECS=1,
  GIT_NO_LAZY_FETCH=1, timeouts and maxBuffer on every spawn (review-evidence.ts:73-80).
- Hardened file reads: reject symlinks on every path component, O_NOFOLLOW, nlink === 1, same inode before/after
  open, owner check, fatal UTF-8 decoding, exact key sets for JSON records (qa-evidence.ts:9-60).
- Ethos injected into every skill preamble: completeness is cheap ("boil the ocean"), search before building
  (three layers of knowledge), user sovereignty (models recommend, users decide).
- SKILL.md generated from templates with a shared preamble; generated files committed; template test tiers.
- Eval tiers: free tests, paid "gate" evals on PRs, "periodic" evals; LLM-judge tests; flake ranking.
- Cross-model second opinions (Claude + Codex) treated as signal, never a mandate.
- Security model for the browser daemon: localhost only, bearer token, egress receipt ledger, unicode sanitisation,
  prompt-injection defence.

## Gap vs Skillsmith
- Evidence is collected for one builder; no rival builds, no clean-room re-run by a judge, no penalty for a
  claim that fails. The agent chooses what to run.
- Aimed at founders who code daily; 23+ tools assume developer vocabulary.
