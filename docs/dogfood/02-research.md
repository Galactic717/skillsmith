# Research: Skillsmith

Date: 2026-10-01. Every fact carries a source tag `[S#]` from `02-sources.json` (a link and an exact quote).
Anything unverified is under "Rejected" and is not used anywhere else. The line-by-line reverse engineering of
the competitors is in `docs/research/`.

<!-- ss:competitors -->
## Competitors

| Who | Stars on 2026-10-01 | For whom | What they lack |
|---|---|---|---|
| obra/superpowers [S1] | 293.6k | developers | a plain interview for founders; rival teams; mechanical checks of claims |
| github/spec-kit [S2] | 139.7k | developers | plain language; any check that an agent's "done" is true |
| garrytan/gstack [S3] | 134.6k | developers who ship daily | a founder mode; it keeps an evidence log, but nobody competes and nobody is punished |
| BMAD-METHOD [S4] | 53.7k | developers (needs Node, npm, git, Python) | a simple entry; consequences for false claims |
| competitive-agents [S5] | n/a | plugin authors | execution: nothing is installed or run; two agents only |
| Lovable [S6] | $500M ARR (self-reported) | 80% non-technical | the founder does not own the process; a known security incident [S12] |

**Takeaway.** The largest open projects are built for developers. Lovable shows the non-technical audience is
huge and pays [S6], but it is a closed platform. Between them is an empty space: an open line inside Claude
Code where a founder speaks plain English and quality is guaranteed by checks, not promises.

<!-- ss:audience -->
## Audience and their pain

- 80% of Lovable's builders call themselves non-technical [S6]. A founder who "knows 2 + 2" is a mass market.
- The 70% problem: a non-engineer gets 70% of the result fast and cannot finish the last 30% [S7].
- Trust lags use: more developers distrust the accuracy of AI tools than trust it [S22]. Founders have even
  less ability to check.
- Security: generated apps exposed their databases to strangers (CVSS 9.3) [S12], and roughly 44% of AI code
  generation tasks introduced a risky vulnerability in Veracode's 2026 tests [S20].

<!-- ss:trends -->
## Trends

1. **Benchmarks saturate.** SWE-bench Verified went from 60% to near 100% in one year [S19]. A leaderboard
   score says nothing about one founder's product; checks written for that product do.
2. **Agents handle longer tasks every few months.** METR's time-horizon doubling time since 2024 is 89 days
   under TH1.1 [S23]. Longer unattended runs make mechanical verification more important, not less.
3. **Agents game their graders.** o3 reward-hacked in 39 of 128 runs, and "Please do not cheat" changed
   nothing [S8]. Agents that see the tests build to the test and leave the library dead [S9]. Most runs reason
   about an imagined grader [S10].
4. **Several attempts plus discarding failures improves quality.** 70.3% versus 63.7% on the same benchmark
   [S11].
5. **Models invent dependencies.** At least 5.2% of packages from commercial models and 21.7% from open-source
   models were hallucinated [S21].
6. **Open standards for agents consolidated.** MCP, goose and AGENTS.md moved to the Agentic AI Foundation
   [S24], and SKILL.md is supported by many clients [S14].
7. **Regulation arrives.** EU AI Act Article 50 transparency deadlines remain 2 August 2026 [S25].
8. **AI text is recognisable.** Marker words such as "delves" measured LLM use in at least 13.5% of 2024
   abstracts [S13]. Readers notice.

<!-- ss:niches -->
## Open niches

1. **Honesty as a mechanism, not a request.** None of the large projects deletes a team for a false claim.
   [S8] and [S9] show this is where it hurts. This is Skillsmith's core difference.
2. **Checks the builder cannot see.** Benchmarks saturate [S19] and agents game visible tests [S9]; sealed
   holdout checks per project are rare in agent tooling.
3. **A founder's entry into a professional process.** The frameworks assume a developer [S1][S2][S4].
4. **Marketing inside the line.** No competitor writes hooks and a launch post as part of building.
5. **Rival builds with elimination.** Several attempts are proven to help [S11]; no open plugin runs three
   executed builds with cross-examination and penalties (the closest, [S5], executes nothing).

<!-- ss:repos -->
## Repositories worth using or studying

- https://github.com/obra/superpowers [S1]: isolation in git worktrees and an on-disk progress ledger; we
  isolate each team in its own worktree.
- https://github.com/github/spec-kit [S2]: requirement ids, coverage maps and a clarify taxonomy; we trace
  every R# to a check.
- https://github.com/garrytan/gstack [S3]: an evidence ledger bound to the working tree; ours is signed and
  written only by the engine.
- https://github.com/bmad-code-org/BMAD-METHOD [S4]: the idea check (HARDENED, CLARIFIED, KILLED) and
  surface-anchored acceptance criteria.
- https://github.com/anthropics/skills [S17]: design rules against generic AI looks.
- Claude Code plugin documentation [S15][S16]: no top-level `bin/` folder, scripts through
  `${CLAUDE_PLUGIN_ROOT}`, subagents up to three levels deep.

<!-- ss:implications -->
## What this means for the product

1. Code runs the checks, not an agent. An agent cannot say "tests pass"; the engine runs the command [S8].
2. Acceptance checks are written before the arena and protected; changing them is death [S9].
3. Every check must fail before work starts, and some checks stay hidden from builders [S9][S19].
4. Three teams are a method, not a show: discard the failing attempts and keep the best [S11].
5. Every verified commit is scanned for secrets and made-up dependencies [S20][S21].
6. Every decision is signed, because founders cannot audit agents themselves [S22].
7. A slop detector for copy and design rules against generic looks [S13][S17].

<!-- ss:rejected -->
## Rejected

- "71% of TikTok viewers decide in 3 seconds": only marketing blogs without a primary source.
- "84% of AI coding users are non-technical founders": no methodology.
- The superpowers star count from a search snippet (292,050) disagreed with the live page (293.6k); we used
  the live page.

## The quote check

`skillsmith sources verify` loaded each source and searched for its quote. In version 1 it caught our own
mistake: the link for S16 pointed to the manifest reference while the quote came from the plugin components
page. The link was fixed and the quote confirmed. Pages that do not load from a given network are reported as
"unreachable", which the engine treats as proving nothing either way.
