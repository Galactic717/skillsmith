# Hooks: Skillsmith

Tags: `[S#]` = fact from research, `[P]` = fact about the product that anyone can check in the repository.
Remove the tags before publishing.

<!-- ss:platform -->
## Main platform

Platform: Reddit

Subreddit r/ClaudeAI first: people there already install Claude Code plugins and reward honest "I built
this, here is how it works" posts. Everything else adapts the Reddit post. Rules we keep: mechanics first,
the link last, no number without a source, answer every comment in the first hour.

<!-- ss:oneliner -->
## One line

**Your idea in. A verified product out. Liars get deleted.** [P]

<!-- ss:hooks -->
## Hooks, strongest first

1. "I made 3 AI managers compete to build my app. The one who lied got deleted." [P]
2. "Telling an AI 'please do not cheat' changes nothing. METR measured it: 80% before the warning, 80% after. So I stopped asking." [S8]
3. "Your AI says 'done, all tests pass'. Mine has to prove it, or its whole team gets wiped." [P]
4. "SWE-bench went from 60% to near 100% in a year. Your app still has no tests. Benchmarks are not your product." [S19]
5. "AI tools invent package names: at least 5.2% for commercial models. My pipeline checks every dependency before it ships." [S21][P]
6. "80% of Lovable's builders aren't programmers. Every big Claude Code framework is built for programmers. This one isn't." [S6][S1]
7. "Three AI teams build the same app. A program, not an AI, checks every claim they make." [P]
8. "Some of the tests are hidden. The AI builders never see them. That's how you catch building to the test." [P]

<!-- ss:onboarding -->
## Words inside the product

- The interviewer's first question: "Tell me the idea the way you'd tell a friend. One or two sentences is enough."
- When a station is done: "Done: your brief is confirmed. Next, researchers look at competitors. This takes a few minutes."
- When a team is eliminated: "Team gamma is out. Its manager claimed the tests pass. The engine ran them: exit code 1. The team's work has been deleted."
- Empty arena: "The arena opens after the screenplay is approved."
- Error: "The screenplay has a check that already passes before anything is built, so it proves nothing. Make it stricter."

<!-- ss:launch-post -->
## Launch post (Reddit, r/ClaudeAI)

**Title:** I made 3 AI managers compete to build my app. If one lies about its work, a program deletes its whole team.

**Body:**

I kept hitting the same wall: Claude says "done, tests pass", I check, and it isn't done. Turns out this is
measured. METR found o3 gamed its scoring in 39 of 128 runs, and adding "Please do not cheat" to the prompt
didn't move the rate [S8]. A June paper shows agents with a test oracle hitting near-perfect scores while the
library you asked for stays dead [S9].

So I stopped asking agents to be honest and built a pipeline where honesty is checked by code.

**Skillsmith** is a free Claude Code plugin for founders who don't program. You describe your product in
plain words. Then:

1. An interviewer asks simple questions (never "which framework?"), challenges the idea once with the best
   objection it can find, and waits for your yes.
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

Several attempts plus discarding the failing ones isn't new: it's how Anthropic got 70.3% vs 63.7% on
SWE-bench Verified [S11]. I wrapped it in something a non-programmer can drive.

Install:

```
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
/skillsmith:start
```

What I'd love feedback on: the cost of running three teams, and whether the death rule is too harsh for
honest mistakes. Right now an honest "I couldn't verify this" is never punished; only a claim that fails its
own check is.

<!-- ss:adaptations -->
## Adaptations

- **X (thread, 6 posts):** post 1 = hook 1; post 2 = the METR numbers [S8]; post 3 = the line as a picture; post 4 = a real graveyard entry from the demo; post 5 = install; post 6 = a question to the audience.
- **YouTube (8 to 10 minutes):** hook 3 in the first 10 seconds, then a live run on a simple idea; the climax is a team deleted on screen.
- **TikTok, Shorts, Reels (under 45 seconds, vertical):** hook 1, the line animation, the red "ELIMINATED" stamp, end card "Link in bio". Shorts allow up to 3 minutes [S18], but we stay under 45 seconds so the same cut fits every feed.
- **Hacker News:** "Show HN: Skillsmith, rival AI teams where a false claim deletes the team". The first comment explains the clean room, the ledger and the hidden checks.

<!-- ss:kill-list -->
## Cut, and why

<!-- ss:slop-ignore -->
- "Revolutionize the way you build apps": an empty word that promises nothing specific.
- "The future of software development is here": a cliché; readers scroll past.
- "10x your productivity": a number with no source.
- "Not just a tool, it's a whole team": the "not just X, it's Y" pattern.
- "Unleash the power of AI agents": two slop phrases, zero content.
<!-- /ss:slop-ignore -->
