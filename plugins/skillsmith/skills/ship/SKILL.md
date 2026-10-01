---
name: ship
description: Station 6, the last on the Skillsmith line. Re-verifies the merged product, makes sure the client has a README they can follow, writes the final report and dashboard, prepares the launch kit, and offers to put the product online. Use when a Skillsmith project is at the ship station.
allowed-tools: Bash(node *), Bash(git status *), Bash(git log *), Read, Write, Edit, Glob
---

# Ship station

The engine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs"` (below: `skillsmith`).

## 1. Verify the merged product

The winner's code is now in the main branch. Run the acceptance checks there,
with a fresh install:

```
skillsmith verify --acceptance .skillsmith/04-acceptance.json --setup
```

If anything fails, start a `skillsmith:developer` on the main project folder
with the failures, the screenplay and the standards. Verify again. Do not
continue with failing checks; if one cannot be fixed, tell the client exactly
which promise is not kept and why.

## 2. The README

Open `README.md` and read it as the client: someone who has never used a
terminal. It must say what the product is, how to run it (every command, what
they should see), how to change the likely things, how to put it online, and
what is not done. If it falls short, have the developer rewrite it, in the
client's language.

## 3. Launch kit

From `.skillsmith/03-hooks.md`, write `LAUNCH.md` in the project root: the
launch post for the main platform ready to paste, the adaptations, and three
screenshots of the product (ask the developer to take them if none exist).
Remove the `[S#]` and `[P]` tags from the copy; keep the sources list at the
bottom for the client's reference.

## 4. Report and dashboard

```
skillsmith report
skillsmith dashboard
skillsmith advance ship
```

## 5. Hand-over

Tell the client, in their language, in at most 10 lines:

- what they now have and where it is;
- how to start it (one line, pointing to the README);
- which team won and why, and what the graveyard says, if anyone died;
- what is not done yet;
- the next step to go live.

Offer to put it online. Name the simplest option for this stack (for
example Netlify or GitHub Pages for a static site, Vercel for Next.js,
Render or Railway for a server, a VPS only when necessary). Explain what
account they need and what it costs. Do nothing that creates accounts,
spends money or publishes anything without their explicit yes.
