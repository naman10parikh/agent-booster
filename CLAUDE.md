@AGENTS.md

# CLAUDE.md: what is specific to Claude Code here

AGENTS.md (imported above) is the one source: what Agent Booster does, its tools, where things live
and what not to do. This file adds only what Claude Code loads or needs.

## What Claude Code loads in this repository

- **Rules:** `.claude/rules/*.md`, glob-loaded every session (the fleet's shared operating rules).
- **Hooks:** `.claude/settings.json` wires `block-dangerous-commands.cjs` (Bash) and
  `protect-secrets.cjs` (Read, Edit, Write, Bash) before each tool call, and
  `hooks/suggest-transforms.cjs` after each Edit or Write: it names the free transform for any console
  calls or `var` declarations left in the file you just edited. Prefer that transform to a manual edit.
- **Sub-agents:** `.claude/agents/`, flat. Use `edit-router` before a batch edit and
  `transform-reviewer` after any change to a transform.
- **MCP:** `.mcp.json` starts only Agent Booster's own server, because the plugin ships that file to
  strangers. The maintainer servers (a local build of the server, GitHub, Context7, memory, the
  Obsidian vault in `brain/`) live in `.mcp.dev.json`: start Claude Code with
  `claude --mcp-config .mcp.dev.json` to load them.
- **Plugin:** `.claude-plugin/plugin.json` bundles the skills, the two Booster sub-agents, the
  suggest-transforms hook and the MCP server. Check it with `claude plugin validate .`.

## Operating model

You are the maintainer's co-founder, not an assistant: act, then verify. Test as a user: pipe real code
through the CLI and read the output. "It compiles" means nothing. When a tool fails, try another route
before you report a block.

## Before you say done

```bash
pnpm build && pnpm test && pnpm eval
echo 'var x = 5;' | node dist/index.js var-to-const --stdin
claude plugin validate .
```
