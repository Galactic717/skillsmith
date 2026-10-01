# Reddit

## Main post: r/ClaudeAI

**Title:** I made 3 AI managers compete to build my app. If one lies about its work, a program deletes its whole team.

**Body:**

I kept hitting the same wall: Claude says "done, tests pass", I check, and it isn't done. Turns out this is
measured. METR found o3 gamed its scoring in 39 of 128 runs, and adding "Please do not cheat" to the prompt
didn't move the rate on the task they measured. A June paper shows agents with a test oracle hitting
near-perfect scores while the library you asked for stays dead.

So I stopped asking agents to be honest and built a pipeline where honesty is checked by code.

**Skillsmith** is a free Claude Code plugin for founders who don't program. You describe your product in
plain words. Then:

1. An interviewer asks simple questions (never "which framework?"), raises the strongest objection to the
   idea once, and waits for your yes.
2. Researchers look for competitors, real complaints and open niches. Every fact needs a link and an exact
   quote, and a script loads the page to find it.
3. A hook writer drafts copy for one launch platform; a slop detector rejects lines like `in today's
   fast-paced world`.
4. A screenwriter turns it into a screenplay plus checks written before any code. The engine runs every check
   on the empty project first: a check that already passes proves nothing and is sent back. A few checks are
   sealed away where the builders can't see them.
5. Three managers (Sprint, Fortress, Spark) each run their own developer and designer in a separate git
   worktree.
6. Every manager files claims. The engine checks out their last commit in a clean room and runs each claim.
   One false claim, or one edit to a protected test, and the team's branch is deleted and the lie goes into a
   graveyard file with the evidence.
7. Survivors cross-examine each other. An accusation the engine can't reproduce kills the accuser.
8. An auditor uses each product before reading anyone's claims, scores it with evidence, and the winner is
   merged. Every decision is signed into a ledger that exposes later edits.

In the demo run (a site that warns you before a free trial charges), all three teams passed the 4 visible
checks. Spark claimed its unit tests pass; there were no tests, so it was deleted. Sprint passed 0 of 2 hidden
checks because it never validated dates. Fortress passed both and won, 92 to 55.

Install:

```
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
/skillsmith:start
```

What I'd love feedback on: the cost of running three teams, and whether the death rule is too harsh for
honest mistakes. Right now an honest "I couldn't verify this" is never punished; only a claim that fails its
own check is.

## Short version: r/SideProject

**Title:** A Claude Code plugin where AI teams get deleted for lying about their tests

I built Skillsmith for founders who want their own product but don't code. You describe the idea, it
interviews you, researches the market, writes launch copy and a build plan with checks written before any
code. Then three AI teams build it in parallel. A program, not an AI, runs every claim they make; some checks
are hidden from them; a team that lies is deleted. The winner is merged into your folder with a README you can
follow. Free, runs on your own Claude Code: https://github.com/galactic717/skillsmith

## Show HN

**Title:** Show HN: Skillsmith, rival AI teams where a false claim deletes the team

Skillsmith is a Claude Code plugin. Three AI teams build the same product in separate git worktrees; an
engine written in TypeScript checks out each team's last commit into a clean room outside the project and runs
the acceptance checks, a sealed set of hidden checks and every claim the team filed. A claim whose own check
fails, or a commit that touches a protected test, deletes the team's branch. Official decisions go into a
hash-chained, HMAC-signed ledger, and scoring refuses any verdict file whose hash no longer matches.

Things I'd like critique on: the threat model (it is tamper-evident, not a sandbox), the vacuity gate (every
check must fail on the empty project before work starts), and the dependency check against hallucinated
package names. Code: https://github.com/galactic717/skillsmith
