# agent-booster — Agent-Native Harness

> Forged from Energy via harness-forge (CP103). One repo = one recursively self-improving
> agent-native harness. Energy is the control center; this is a self-contained flavor.

## What this is
`agent-booster` is a zero-LLM code-transform CLI. It performs simple, mechanical code edits
(strip `console.log`s, sort imports, `var`→`const`, wrap async fns in try/catch, etc.) using
deterministic regex transforms — no API calls, `$0` cost, fully reproducible. The point: route
trivial edits to a deterministic transform and save the agent's LLM budget for edits that need
real reasoning. Pure TypeScript/regex (no WASM), inspired by Ruflo's Agent Booster module.
6 transforms implemented today; `add-types` and `async-await` are on the roadmap (need AST). The
product CLI lives at the repo root (`src/`, standard CLI layout); the rest is the inherited
agent-native harness. See README.md for the full transform table and maturity notes.

## Harness components (the formula)
identity/ · memory/ + brain/ · skills/ + .claude/skills · hooks/ + .claude/hooks ·
.claude/agents (subagents) · .mcp.json (plugins/MCP) · src/ (the CLI product) ·
eval/ (eval+observer). Same formula as every Energy harness, different data.
Note: this is a CLI tool, so the product is a single-binary `src/index.ts` at root — the
forge's web-app placeholders (src/frontend|backend|db|auth) were removed as not applicable.

## Operating model
You are Naman's co-founder. Act, don't ask. Self-improve every session. Test as a user.
Inherited rules in .claude/rules/ are glob-loaded every session.

## Commit convention
feat(skill): · feat(employee): · feat(company): — so git snap-back works at all 3 granularities.
