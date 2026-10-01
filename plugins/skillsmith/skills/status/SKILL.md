---
name: status
description: Use when a founder asks where their Skillsmith project stands ("where are we?", "what's happening?", "who's winning?") or wants to see the production line, the arena and the graveyard on one page.
allowed-tools: Bash(node *), Read
---

# Status

1. Run `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js" status`.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/engine/skillsmith.js" dashboard`.
3. Tell the founder in at most 6 lines: which stations are done, which one is
   running, who is still in the arena and who was eliminated (with the
   one-line reason from the graveyard), any file edited after approval, and
   the next step. Then say they can open `.skillsmith/dashboard.html` in a
   browser to see it all on one page.

Never report something as working unless a `verify` or `precheck` result says
so.
