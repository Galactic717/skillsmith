# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x | Yes |
| 1.x | No: upgrade to 2.x |

## Reporting a vulnerability

Please report security problems privately through
[GitHub security advisories](https://github.com/galactic717/skillsmith/security/advisories/new).
Do not open a public issue. You will get an answer within 7 days.

Useful details: the Skillsmith version (`skillsmith version`), the command or
station involved, and the smallest project that shows the problem.

## What Skillsmith protects, and what it does not

Skillsmith runs code written by AI agents, so its threat model matters:

- **Clean rooms.** Every official verification checks out one exact commit
  into a fresh git worktree outside the project. Uncommitted files never
  reach a verdict.
- **Refused commands.** Check commands that use `sudo`, delete outside the
  project, pipe downloads into a shell, rewrite git history, publish
  packages or read the private store are refused before they run.
- **Local-only HTTP checks.** HTTP checks reach only `localhost` and the
  loopback addresses.
- **Hardened git calls.** The engine runs git with repository hooks,
  fsmonitor and replace refs switched off, so code under test cannot run
  inside the engine's own git calls.
- **Tamper-evident records.** Official decisions are appended to a
  hash-chained ledger signed with an HMAC key kept outside the project.
  `skillsmith ledger verify` detects edited or deleted entries. This is
  tamper-evident, not tamper-proof: someone with access to the key can
  rewrite history.
- **Hidden checks.** Sealed holdout checks live in a private folder outside
  the project (`~/.skillsmith/projects/<id>/`, or `$SKILLSMITH_HOME`). Hooks
  stop agents from reading it, but a process running as the same user can
  still read it. It keeps honest agents honest; it is not a sandbox.

Check commands themselves run with your user's permissions. Run Skillsmith
on projects and agents you are willing to run code from, the same as any
build tool.
