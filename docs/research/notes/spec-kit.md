# Notes: github/spec-kit (commit 6244a2e, 2026-10-01)

Size: ~121k lines excluding tests (Python CLI `specify` + templates + bash/PowerShell/Python scripts).
Read: templates/commands/specify.md, clarify.md (steps 1-5), analyze.md (goal → severity → report), file inventory
of templates/, src/specify_cli/integrations/ (directory list), src/specify_cli/_download_security.py (constants,
function inventory).

## Mechanisms worth adopting
- Spec quality checklist generated per spec ("unit tests for English"): no implementation details, testable
  requirements, measurable + technology-agnostic success criteria, edge cases, bounded scope (specify.md §8).
- At most 3 [NEEDS CLARIFICATION] markers; priority scope > security/privacy > UX > technical (specify.md §6.3).
- Clarify: coverage map over a fixed taxonomy (scope, data model, UX flow, non-functional, integrations, edge cases,
  constraints, terminology, completion signals, placeholders) marked Clear/Partial/Missing; max 5 questions per
  session; each answerable by 2-5 options or <=5 words; ordered by Impact x Uncertainty (clarify.md §3-4).
- Analyze (read-only): stable requirement keys FR-###/SC-###; map tasks → requirements; coverage %, vague-adjective
  detection ("fast", "robust", "intuitive"), unresolved placeholders, terminology drift; severities CRITICAL/HIGH/
  MEDIUM/LOW; max 50 findings (analyze.md §3-6). Constitution MUST conflicts are automatically CRITICAL.
- Constitution file = non-negotiable project principles that every later step is checked against.
- Commands carry `handoffs` in frontmatter (next-step buttons).
- Feature directory persisted in .specify/feature.json so later commands do not depend on branch names.
- Extension hooks before/after each command (.specify/extensions.yml), optional vs mandatory.
- One methodology, 40+ agent integrations generated from a single template source
  (src/specify_cli/integrations/<agent>/).

## Engineering practices
- Bounded IO everywhere: MAX_DOWNLOAD_BYTES 50 MiB, MAX_JSON_METADATA_BYTES 1 MiB, archive entry/size/path limits,
  each constant documented with the reason for its size (_download_security.py:26-58).
- URL safety: https-or-localhost, safe redirects, loopback detection, Windows reserved filenames.
- Repo hygiene: CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, CITATION.cff, CHANGELOG, DEVELOPMENT.md,
  translated READMEs, agentic GitHub workflows (*.lock.yml).

## Gap vs Skillsmith
- Everything is executed by the agent following prose; nothing checks that implement.md's claims are true.
- No rival implementations, no penalty for false completion claims.
- Aimed at developers ("I am building with..." prompt for tech stack).
