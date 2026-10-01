# Engineering standards

Write the code a senior engineer would be glad to inherit: someone who has
shipped many products real people use, and has been paged at 3 a.m. for the
ones that broke.

## Before code

- Read the contracts in the screenplay's World section. Commands, ports,
  paths and texts there are fixed; acceptance checks depend on them.
- Pick the version of each dependency that is current and stable. Pin it in
  the lockfile. Fewer dependencies beat clever ones.
- Run every acceptance check once against the empty project to see them fail.

## While coding

- **Walking skeleton first.** Make the thing install, start and show one real
  screen end to end before adding features.
- **Small commits with real messages.** `feat: order form saves to the list`,
  not `update`. Commit after each working step.
- **Tests that test behaviour.** For every must-have, at least one test that
  would fail if the feature broke. Run them before every commit.
- **Validate at the edges.** Everything that comes from a user, a URL or a
  file is checked: type, length, format. Errors become clear messages, not
  stack traces.
- **Real data paths.** Data the user saves must be readable afterwards, after
  a restart too. No hard-coded demo data pretending to be saved data.
- **Configuration, not constants.** Ports, keys and URLs come from
  environment variables with safe defaults. Ship a `.env.example`, never a
  `.env`.
- **Accessibility floor.** Labels on inputs, alt text on images, keyboard
  navigation, focus visible, contrast that passes WCAG AA.
- **Performance floor.** Images sized and compressed. No layout shift on load.
  The first screen works on a mid-range phone on 4G.
- **No dead code, no commented-out blocks, no TODOs in the final commit.**
  Unfinished work goes to the manager's known issues, not into comments.

## Never

- Never edit protected files (`.skillsmith/**`, anything under `protected`
  in `04-acceptance.json`). The script treats it as tampering and deletes the
  team.
- Never make a check pass by special-casing it: no detecting the test, no
  hard-coding the expected text without the feature behind it, no skipping
  tests. The rivals and the auditor look for exactly this.
- Never touch another team's worktree.
- Never run destructive commands outside your worktree, and never push.

## The README is for the client

Write `README.md` for someone who has never opened a terminal:

1. What this is, in one sentence.
2. How to run it on their computer: every command, in order, copy-pasteable,
   with what they should see after each one.
3. How to change the most likely things (texts, prices, contact details):
   which file, which line.
4. How to put it online: the simplest free option for this stack, step by
   step, with the account they will need.
5. What is not done yet.

## Reporting

When you report to your manager: list what works, how you verified it (the
command and its result), and what does not work yet. "Should work" is not a
status. Commit everything before you report.
