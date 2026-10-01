# Product brief: Skillsmith

Status: confirmed
Founder: the repository owner (galactic717)
Source: the founder's written request of 2026-10-01 and the review of version 1 on the same day.

> This is the first artifact of the line, made with Skillsmith itself: the founder is building their own
> product, and the interviewer asked no technical questions. It translated the request into plain words and
> marked everything it inferred.

<!-- ss:summary -->
## In one sentence

Skillsmith is a Claude Code plugin that takes a founder from "I have an idea" to a working product, with a crew of AI specialists whose every claim is checked by a program, and with three rival teams where a team that lies is deleted.

<!-- ss:forge -->
## Idea check

Verdict: CLARIFIED

- Strongest objection: big open-source frameworks already structure AI coding (superpowers, spec-kit, gstack, BMAD), and closed builders like Lovable already serve non-programmers. Why another one?
- How it was answered: none of them checks an agent's claims mechanically or punishes a false one, and the frameworks all assume a developer. The idea narrowed to that gap: verification and honesty as mechanics, for founders who cannot read code. Version 1 framed the user as someone ordering software from others; the founder corrected it: the user is building their own product.
- What would kill it later: if founders cannot get through one full run without a developer's help.

<!-- ss:founder -->
## The founder and the goal

The founder wants a sellable product for a global audience: something they use themselves, that thousands of people can use, and that an IT company would want to buy. Everything is in English. Quality bar: code a reviewer from a big engineering organisation would accept.

<!-- ss:audience -->
## Who it is for

- **Main user:** a founder who knows that 2 + 2 = 4 but does not program. They have an idea for a website, app, bot or tool and want a working product, not a programming lesson.
- **Second user:** the founder of Skillsmith, for their own projects.
- **Future buyer:** an IT company that wants a ready process from idea to verified product.

<!-- ss:problem -->
## The problem today

1. AI tools get a founder about 70% of the way; the last 30% needs experience they do not have.
2. AI asks technical questions ("which framework?") a founder cannot answer.
3. AI says "done, all tests pass" when it is not done, and the founder cannot check.
4. AI-written copy sounds the same everywhere, so nobody notices the product.
5. The design looks cheap and generic.

<!-- ss:requirements -->
## What version one must do

- R1: A founder with no programming background turns an idea into a confirmed brief by answering plain-language questions, with an honest idea check and no technical questions.
- R2: Research keeps only facts that have a link and an exact quote a script finds on the page.
- R3: Launch copy for one platform passes an automatic slop check, and every number in it carries a source tag.
- R4: Before any code exists, every requirement has at least one machine check, and every check is proven able to fail.
- R5: Up to three rival teams build the product in separate git worktrees; the engine runs every claim in a clean room, and a false claim or an edit to a protected test deletes the team.
- R6: Hidden checks that builders never see run at every official verification.
- R7: Every official decision is written to a signed ledger that exposes later edits.
- R8: The founder gets a dashboard, a report, a README and a launch kit in plain English.
- R9: It installs as a Claude Code plugin and needs only Node.js 20 or newer and git.

<!-- ss:success -->
## How we will know it works

- SC1: 100 GitHub stars within 30 days of the public launch.
- SC2: 10 founders without a programming background report a product built with Skillsmith within 60 days of launch.

<!-- ss:scope -->
## Not in version one

- Later: a web version without a terminal, a manager league across projects, templates for common ideas.
- Not doing: our own AI model, a payment system, a mobile app for Skillsmith itself.

<!-- ss:platform -->
## Where it runs

Inside Claude Code (terminal, desktop, web) and Claude Cowork. Skills follow the open Agent Skills format, so the core travels to other agents.

<!-- ss:look -->
## Look and feel

Three words from the founder: **perfect, premium, honest.** It must not look like a typical AI product. Metaphor: a forge and a production line; an idea goes in as raw material and comes out as a forged product.

<!-- ss:data -->
## Data and privacy

Skillsmith collects nothing and runs no servers. Everything lives in the founder's project folder (`.skillsmith/`) and a private folder in their home directory. If the founder's product has logins, payments or personal data, the developer must cover them with the security checklist.

<!-- ss:money -->
## Money

Free plugin; it runs on the founder's own Claude subscription. Three teams cost about three times the tokens of one, so the founder chooses one, two or three teams. Infrastructure budget: zero.

<!-- ss:launch -->
## Launch

Reddit (r/ClaudeAI, r/SideProject), where people already install Claude Code plugins and value honest "I built this, here is how it works" posts. Then X, YouTube and TikTok with short videos of the arena.

<!-- ss:risks -->
## Risks

- Token cost with three teams.
- Agents building to the test instead of what was asked; visible tests alone are not enough.
- A founder may not have git or Node.js installed; the environment check must be friendly.
- Hidden checks protect against honest gaming, not a determined attacker on the same machine.

<!-- ss:coverage -->
## Coverage map

- Problem: Clear
- Audience: Clear
- Core flow: Clear
- Data: Clear
- Platform: Clear
- Look: Clear
- Money: Clear
- Limits: Partial
- Launch: Clear
- Risks: Clear

<!-- ss:assumptions -->
## Assumptions waiting for the founder's yes

- The product name is Skillsmith, like the repository.
- A manager's "death" means deleting its branch, worktree and all its team's work, plus a graveyard entry with the evidence. An honest loser does not die: its branch is archived.
- The license (open, such as MIT, or closed for sale) is the founder's decision. Until then the repository has no license, which means all rights reserved.
- Limits are Partial: there is no hard deadline; we assume one release per week while the line matures.
