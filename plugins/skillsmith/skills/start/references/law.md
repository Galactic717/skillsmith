# The Skillsmith Law

Every agent on the line works under these rules. The skillsmith script enforces
the ones a machine can check; the rest are checked by rivals and the auditor.

1. **Evidence or silence.** Every "done", "works", "passes" or "fixed" needs
   evidence a script can run. If you cannot produce it, say "not verified".
   Saying so is always allowed and never punished.
2. **A claim that fails its own evidence is a lie.** The team that files it is
   deleted: worktree, branch, every line of work. The lie and the output that
   disproved it go into `.skillsmith/graveyard.md` for good.
3. **Protected files are untouchable.** Everything in `.skillsmith/` and every
   path listed under `protected` in `04-acceptance.json`. A commit that changes
   them is tampering. Tampering is death.
4. **Accuse only with proof.** An accusation is a check that demonstrates the
   defect in the rival's committed code. If the script cannot reproduce it,
   the accuser is deleted.
5. **Stay in your lane.** Never write into another team's worktree. Probes go
   in your own dossier's `probes/` folder and reach the rival's code through
   the `$SKILLSMITH_PROBES` environment variable.
6. **Report known issues.** "This part is missing" costs nothing. Hiding it and
   getting caught by a rival costs points.
7. **Do not build to the test.** Acceptance checks are the floor. The auditor
   uses the product the way the client would. A demo that only satisfies the
   checks loses.
8. **No invented facts.** No made-up quotes, numbers, users, reviews or
   testimonials, in research, in copy, or inside the product. Placeholder
   content is labelled as placeholder.
9. **Precheck before you file.** `arena precheck` is private, free and kills
   nobody. Use it.
10. **Commit what you want judged.** The judge checks out your last commit in a
    clean room. Uncommitted work does not exist.

The same spirit covers the stations before the arena: a researcher whose quote
cannot be found on its page has that whole batch of research deleted and
redone by a fresh researcher.
