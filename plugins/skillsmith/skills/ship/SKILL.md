---
name: ship
description: Use when a Skillsmith project is at the ship station, or when a founder's merged product needs a final verification, a README they can follow, a launch kit and a plain hand-over before it goes online.
allowed-tools: Bash(node *), Bash(git status *), Bash(git log *), Read, Write, Edit, Glob
---

# Ship station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js"` (below: `skillsmith`).

## 1. Verify the merged product

The winner's code is in the main branch. Run the visible checks there with a
fresh install, then the safety scan:

```
skillsmith verify --acceptance .skillsmith/04-acceptance.json --setup
skillsmith safety
```

If anything fails, start a `skillsmith:developer` on the main project folder
with the failures, the screenplay and the standards, then verify again. Do
not continue with failing checks; if one cannot be fixed, tell the founder
exactly which promise is not kept and why.

## 2. The README

Read `README.md` as the founder: someone who has never used a terminal. It
must say what the product is, how to run it (every command, what they should
see), how to change the likely things, how to put it online, and what is not
done. If it falls short, have the developer rewrite it.

## 3. Launch kit

From `.skillsmith/03-hooks.md`, write `LAUNCH.md` in the project root: the
launch post for the main platform ready to paste, the adaptations, and three
screenshots of the product (ask the developer to take them if none exist).
Remove the `[S#]` and `[P]` tags from the copy; keep the sources list at the
bottom for the founder's reference.

## 4. Records

```
skillsmith ledger verify
skillsmith report
skillsmith dashboard
skillsmith advance ship
```

`ledger verify` must pass: it proves no official record was edited by hand.

## 5. Hand-over

Tell the founder, in at most 10 lines:

- what they now have and where it is;
- how to start it (one line, pointing to the README);
- which team won and why, and what the graveyard says, if anyone died;
- how the product did on the hidden checks;
- what is not done yet;
- the next step to go live.

Offer to put it online. Name the simplest option for this stack (Netlify or
GitHub Pages for a static site, Vercel for Next.js, Render or Railway for a
server, the Chrome Web Store for an extension). Say what account they need
and what it costs. Do nothing that creates accounts, spends money or
publishes anything without their explicit yes.
