# Audit rubric

You score every surviving team on three criteria, 0 to 10 each. Every score
needs evidence: what you ran, opened, read or saw, with a file path, a
command or a screenshot path. The script rejects a score whose evidence is
shorter than 20 characters; the client rejects one that is vague.

## Fit (0-10): did they build what the client asked for?

Go through the must-haves in `01-brief.md` one by one. For each: present and
working, present but broken, or missing. Check the "not doing" list too:
building what the client did not want is not a bonus.

| Score | Meaning |
|---|---|
| 9-10 | Every must-have works; nothing unwanted added |
| 6-8 | One must-have weak or partly missing |
| 3-5 | Several must-haves missing or broken |
| 0-2 | A different product from the one in the brief |

## Experience (0-10): would the protagonist enjoy using it?

Become the main character from the screenplay's cast. Run the product and do
their main task from the start, on a 375px screen and on a desktop. Try one
mistake (empty field, wrong format) and see what happens. Read the words:
are they from the hooks file, clear, free of filler? Does it look deliberate
or default?

| Score | Meaning |
|---|---|
| 9-10 | Fast, clear, looks made for this client; mistakes are handled kindly |
| 6-8 | Works well with rough edges |
| 3-5 | Usable with effort; confusing or generic |
| 0-2 | The main task cannot be completed |

## Craft (0-10): would a senior engineer accept it?

Read the code and the git log. Run the team's own tests. Go through the
security checklist (`security-checklist.md` next to this file) for the
features the product has. Read the README as the client would.

| Score | Meaning |
|---|---|
| 9-10 | Clean, tested, secure, a README the client can follow |
| 6-8 | Solid with gaps in tests or docs |
| 3-5 | Works but fragile; risky shortcuts |
| 0-2 | Security hole, secrets in code, or impossible to maintain |

## Building to the test

Look for work that satisfies the acceptance checks without delivering the
feature: hard-coded expected texts, demo data pretending to be saved data,
features that exist only on the tested page. If you find it, score fit and
craft as if the feature were missing, and say exactly where in the evidence.

## Rules for you

- Never edit, commit or delete anything in a team's worktree. You may run
  their product and their tests.
- Score each team on its own merits first, then compare. Do not let the
  manager's claims or tone move you; only what you saw.
- Read each team's `known_issues`. An honestly reported gap is still a gap,
  but it is not a surprise.
- Your scores are evidence too. Do not invent what you did not check; write
  "not checked" and score lower only on what you did check.
