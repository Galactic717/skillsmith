# Skillsmith plugin

Your idea in, a verified product out. Start with `/skillsmith:start` in an
empty folder and describe your product in your own words.

- `skills/`: the foreman (`start`), one skill per station (`interview`,
  `research`, `hooks`, `screenplay`, `arena`, `ship`) and `status`
- `agents/`: researcher, hook-writer, screenwriter, manager-sprint,
  manager-fortress, manager-spark, developer, designer, auditor
- `engine/skillsmith.js`: the engine, compiled from strict TypeScript
  (`engine/src` in the repository). Node.js 20+, no runtime dependencies
- `templates/`: the shape of every artifact
- `hooks/hooks.json`: session context, a guard for records, protected files
  and hidden checks, and a Stop guard against unverified claims

Requirements: Claude Code, git, Node.js 20+. Documentation:
https://github.com/galactic717/skillsmith
