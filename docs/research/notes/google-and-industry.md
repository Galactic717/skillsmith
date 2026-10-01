# Notes: engineering standards from github.com/google and peers

The Google organisation on GitHub has 2,913 public repositories; the most-starred include material-design-icons
(54.1k), guava (51.9k), zx (45.8k), styleguide (39.6k), googletest (39.6k), leveldb (39.5k) (fetched 2026-10-01).

## google/eng-practices (commit 3bb3ec2) — read: review/reviewer/standard.md, looking-for.md,
## review/developer/small-cls.md, cl-descriptions.md (first halves)
- The senior principle: approve a change once it definitely improves overall code health, even if imperfect.
- Look for: design, functionality (think like a user, edge cases, concurrency), complexity (over-engineering is a
  defect), tests ("Will the tests actually fail when the code is broken?"), naming, comments that explain why,
  style per the style guide, consistency, documentation, and read every human-written line.
- Small changes: one self-contained change with its tests; ~100 lines is reasonable, ~1000 is usually too large.
- Change descriptions: first line is a short imperative summary; the body explains what and why.
- Prefix optional polish with "Nit:".

## google/styleguide — TypeScript guide (tsguide.html, 140 sections; read: exports, export visibility, exception
## handling, type/non-null assertions, focused try blocks, documentation of exports, comments, naming)
- Named exports only; never default exports; no `export let`; minimise the exported surface.
- Throw `new Error(...)` (or custom subclasses); prefer exceptions to error-container return objects.
- `unknown` over `any`; no `as`/`!` without a stated reason; keep try blocks focused; catch `(error: unknown)`.
- JSDoc on every top-level export; comments add information, never restate names.
- Descriptive names, no ambiguous abbreviations; acronyms as words (loadHttpUrl).

## google/gts 7.0.0 (commit bd623c0) — read: package.json, tsconfig-google.json, .prettierrc.json, src/index.js,
## renovate.json, js-green-licenses.json
- tsconfig: strict, noImplicitReturns, noFallthroughCasesInSwitch, noEmitOnError, allowUnreachableCode false.
- Prettier: singleQuote, bracketSpacing false, trailingComma all, arrowParens avoid.
- ESLint: eqeqeq, no-var, prefer-const, no-floating-promises, no `.only` in tests.
- Apache-2.0 headers, Renovate for dependency updates, license allow-list check, c8 coverage, engines node >= 18.

## google/zx 8.x (commit 65fc542, 45.8k stars) — read: package.json scripts, tsconfig.json,
## .github/workflows/test.yml (1-80), .commitlintrc, lefthook.yml, zizmor.yml, .nycrc, .github/SECURITY.md
- CI: `permissions: contents: read`, `persist-credentials: false`, scheduled runs every 4 days, format check,
  license check, size limit, npm audit, circular-dependency check (madge), type tests (tsd), smoke tests on
  Node/Bun/Deno/Windows, CodeQL, OSV scanner, zizmor (GitHub Actions security linter) with hash-pinned actions.
- Conventional Commits enforced by commitlint; lefthook pre-commit (format) and pre-push (license/size/circular).
- Coverage thresholds: 98% lines, 90% branches.
- SECURITY.md with a supported-versions table and a private reporting channel.

## googleapis/release-please (7.6k stars)
- Parses Conventional Commits, keeps a release PR up to date, bumps semver (fix → patch, feat → minor, `!` → major)
  and writes CHANGELOG.md when the release PR merges.

## OpenSSF Scorecard (ossf/scorecard, 5.7k stars) — 19 checks
- Binary-Artifacts, Branch-Protection, CI-Tests, CII-Best-Practices, Code-Review, Contributors, Dangerous-Workflow,
  Dependency-Update-Tool, Fuzzing, License, Maintained, Pinned-Dependencies, Packaging, SAST, Security-Policy,
  Signed-Releases, Token-Permissions, Vulnerabilities, Webhooks.

## What Skillsmith v2 adopts
- Engine rewritten in strict TypeScript (gts-style tsconfig and lint rules), named exports, typed errors,
  `unknown` at every JSON boundary with runtime validation, JSDoc on exports, descriptive names.
- Compiled, committed ESM output for the plugin so users still need only Node 18+.
- CI: read-only token permissions, persist-credentials false, actions pinned by commit SHA, OS × Node matrix,
  lint + typecheck + tests + coverage threshold, CodeQL, dependency review, Scorecard; Dependabot.
- Conventional Commits; release-please; SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue/PR templates,
  CODEOWNERS.
- Inside the product: the developer and auditor agents use the eng-practices checklist; commits stay small and
  imperative; "will the test fail when the code is broken?" becomes a mechanical vacuity check.
