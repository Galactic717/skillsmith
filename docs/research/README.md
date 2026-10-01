# Research behind Skillsmith 2.0

Three studies shaped this version: how the leading open-source agent
frameworks actually work (reverse engineering), how large engineering
organisations keep code quality high (Google and OpenSSF), and where AI
development stands in October 2026. The working notes, with file and line
references, are in [notes/](notes/).

## How the research was done, honestly

The repositories are large: gstack has about 99,000 lines of TypeScript
outside tests and spec-kit about 121,000 lines including templates and
scripts. Reading every line was not possible in one session, so each note
lists exactly which files and line ranges were read in full, with the commit
it was read at. The rule was: read the core mechanism end to end, and skim
inventories for the rest. Nothing here is claimed about code that was not
opened.

## 1. Reverse engineering

| Project | Commit read | What it does well | What it lacks | What Skillsmith took |
|---|---|---|---|---|
| [obra/superpowers](notes/superpowers.md) | 8ca22db | SessionStart bootstrap, subagent-driven development with an on-disk ledger, a capped fix loop, artifacts handed over as files | No mechanical check of claims; no rival builds | Skill descriptions that say only *when*; artifacts as files; a ledger on disk |
| [github/spec-kit](notes/spec-kit.md) | 6244a2e | Requirement ids, a clarify taxonomy with Clear/Partial/Missing, at most 5 questions ranked by impact × uncertainty, coverage analysis, bounded IO | Nothing checks that "implemented" is true | R#/SC# ids, the coverage map, traceability from requirement to check, bounded reads |
| [garrytan/gstack](notes/gstack.md) | 96764e8 | An evidence ledger bound to a working-tree fingerprint, hardened git and file reads | The agent chooses what to run; nobody competes; no penalty | Hardened git calls; records bound to hashes |
| [BMAD-METHOD](notes/bmad.md) | 1cbcfa2 | forge-idea (HARDENED / KILLED / CLARIFIED), surface-anchored acceptance criteria, reviewers who read the narrative last | Verification is still review by agent | The idea check, surface-anchored checks, the blind audit |
| [Anthropic's plugins and skills](notes/anthropic.md) | ab024cd, 8a1541c | A confidence rubric with an 80 cutoff, 2-3 architects with different focuses, a Stop-hook loop, "never publish a guessed number", trigger evals with a held-out split | n/a (reference implementations) | The Stop guard, rival designs taken to full builds, trigger evals |
| [competitive-agents](notes/competitive-agents.md) | b5165ba | Two generators, cross-review, a judge, fusion | Nothing is executed; no penalty | Fusion, "too close to call", independent scoring first |

## 2. Engineering standards

From [google/eng-practices](https://github.com/google/eng-practices),
[google/styleguide](https://github.com/google/styleguide),
[google/gts](https://github.com/google/gts), [google/zx](https://github.com/google/zx),
[googleapis/release-please](https://github.com/googleapis/release-please) and
[OpenSSF Scorecard](https://github.com/ossf/scorecard). Details: [notes/google-and-industry.md](notes/google-and-industry.md).

| Standard | Where it shows up in Skillsmith |
|---|---|
| Approve a change when it improves code health; small changes; imperative descriptions | Developer and manager instructions; CONTRIBUTING.md |
| "Will the tests actually fail when the code is broken?" | `acceptance vacuity` turns the question into a gate |
| Named exports, `unknown` over `any`, JSDoc on exports, `Error` subclasses | The whole engine; enforced by ESLint |
| gts compiler and formatter settings | `tsconfig.base.json`, `.prettierrc.json` |
| zx CI: read-only tokens, `persist-credentials: false`, pinned actions, CodeQL, coverage floors | `.github/workflows/` |
| Scorecard checks (pinned dependencies, token permissions, security policy, dependency updates, SAST) | Pinned SHAs, `permissions: contents: read`, SECURITY.md, Dependabot, CodeQL |

## 3. AI development in October 2026

Every line below was read on the primary page on 2026-10-01; the quotes are
in [the dogfood sources](../dogfood/02-sources.json) and checked with
`skillsmith sources verify`. Details: [notes/ai-trends-2026.md](notes/ai-trends-2026.md).

| Trend | Evidence | Consequence for Skillsmith |
|---|---|---|
| Public coding benchmarks saturated | SWE-bench Verified rose from 60% to near 100% in one year (Stanford AI Index 2026) | Per-project checks plus hidden checks, not leaderboard trust |
| Agents take on longer tasks fast | METR: time-horizon doubling time since 2024 is 89 days under TH1.1 | Longer unattended runs need mechanical verification and a Stop guard |
| Trust lags use | 46% of developers distrust AI accuracy, 33% trust it (Stack Overflow 2025) | Replace "trust me" with a signed verdict on a commit |
| Security did not improve with capability | About 44% of AI code generation tasks introduced a risky vulnerability (Veracode 2026) | Safety scan on every verified commit; security checklist |
| Models invent packages | At least 5.2% (commercial) and 21.7% (open-source) of suggested packages were hallucinated (Spracklen et al.) | Every dependency checked against its registry |
| Agents game visible graders | o3 reward-hacked in 39 of 128 runs; "Please do not cheat" changed nothing (METR, 2025) | Clean rooms, protected tests, death for false claims |
| Open agent standards consolidated | MCP, goose and AGENTS.md founded the Agentic AI Foundation (Linux Foundation) | The repository ships AGENTS.md |
| Regulation | EU AI Act Article 50 deadlines remain 2 August 2026 (Jones Walker) | The security checklist requires AI disclosure in founders' products |

## What changed because of this research

1. The interview pressure-tests the idea and produces numbered, measurable
   requirements (BMAD, spec-kit).
2. Every requirement is traced to a check, and every check must fail before
   work starts (spec-kit, Google eng-practices).
3. Hidden checks catch building to the test (METR, Stanford AI Index).
4. Every verified commit is scanned for secrets and made-up dependencies
   (Veracode, Spracklen et al.).
5. Every decision is signed in a ledger (gstack, Stack Overflow trust data).
6. The auditor reads claims last (BMAD), and close results can be fused
   (competitive-agents).
7. The engine and the repository follow Google's and OpenSSF's standards.
