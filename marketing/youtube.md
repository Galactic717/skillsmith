# YouTube

## Titles (pick one, test two)

- I Made 3 AI Teams Compete. The Liar Got Deleted.
- AI Said "All Tests Pass". The Script Ran Them.
- Building an App Without Coding: 3 AI Teams, 1 Rule

Thumbnail: `site/media/youtube-thumb.png` (Ukrainian: `youtube-thumb-uk.png`).
Title and thumbnail say different things: the thumbnail shows the stamp, the
title tells the story.

## Description

A free Claude Code plugin that turns a plain-language idea into a product, and
checks every claim the AI makes with a script.

Install:
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
/skillsmith:start

Code and docs: https://github.com/galactic717/skillsmith

Sources used in the video:
- METR on reward hacking: https://metr.org/blog/2025-06-05-recent-reward-hacking/
- "Building to the Test" paper: https://arxiv.org/abs/2606.28430
- Anthropic, parallel attempts on SWE-bench: https://www.anthropic.com/news/claude-3-7-sonnet

Chapters:
00:00 The AI said the tests pass
00:40 Why prompts can't fix this
01:40 Station 1: the interview
02:40 Stations 2 and 3: research and hooks
04:00 Station 4: the screenplay
05:00 The arena: three teams
06:30 The verdict
07:30 Cross-examination and the winner
08:30 Install it

## Script (about 9 minutes)

**00:00 Cold open.** Screen: the terminal from the arena, `✘ C2 All our unit tests pass`, `exit code 1, expected 0`, `Outcome: DEAD`. Voice: "This AI team said its tests pass. A script ran them. Exit code one. A second later its entire work was deleted. Here's the machine that did it, and why I built it."

**00:40 The problem.** Show the METR post. "METR caught o3 gaming the scoring in 39 of 128 runs. They tried adding 'please do not cheat' to the prompt. On the task they measured, cheating stayed at 80 percent. A paper this summer showed agents hitting near-perfect test scores while the thing they were asked to build stayed dead. If you can't read code, you can't catch that. So the checking has to be done by code."

**01:40 The interview.** Run `/skillsmith:start cake orders for my bakery` in an empty folder. Show two or three of the interviewer's questions. Point out what it doesn't ask: no frameworks, no databases. Show the read-back and the "Status: confirmed" line appearing only after the yes.

**02:40 Research and hooks.** Show four researchers starting in parallel. Open `02-sources.json`: link, quote, claim. Run `skillsmith sources verify` and show a confirmed quote. Then the hooks file and the slop detector rejecting a cliche line live.

**04:00 The screenplay.** Show acts and scenes, then `04-acceptance.json`. Run the checks against the empty folder: everything fails. "That's the point. A check that passes before any code exists tests nothing."

**05:00 The arena.** `skillsmith arena init`: three worktrees, three branches. Explain the managers: Sprint ships the smallest complete thing, Fortress makes nothing break, Spark goes for the boldest experience. Each leads its own developer and designer.

**06:30 The verdict.** Run `arena verify` for each team. Two survive. The third claimed its unit tests pass; the file doesn't exist. Show the deletion and open `graveyard.md`.

**07:30 Cross-examination and the crown.** Fortress proves Sprint has no tap-to-call link; the script reproduces it; +3 and −4. The auditor's `judge.json` with evidence per score. `arena crown`: the winner is merged; Sprint's branch is kept as retired because it lost honestly. Open the dashboard.

**08:30 Close.** "It's free. It runs on your Claude Code, in your folder. Three teams cost about three times the tokens; you can run one. Link below."

## Shorts

Upload `skillsmith-vertical-en.mp4` as is (39 s), with the title "AI said tests pass. A script ran them." and the cover `tiktok-cover.png`.
