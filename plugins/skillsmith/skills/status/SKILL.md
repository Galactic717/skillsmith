---
name: status
description: Shows where a Skillsmith project is on the production line, who is alive in the arena, and what happens next, in plain words, and refreshes the visual dashboard. Use when the client asks "where are we?", "what's happening?", "що там?", or wants to see progress.
allowed-tools: Bash(node *), Read
---

# Status

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs" status`.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/skillsmith.mjs" dashboard`.
3. Tell the client, in their language and in at most 6 lines: which stations
   are done, which one is running, who is still in the arena and who was
   eliminated (with the one-line reason from the graveyard), and the next
   step. Then say they can open `.skillsmith/dashboard.html` in a browser to
   see it all on one page.

Never report something as working unless a `verify` or `precheck` result
says so.
