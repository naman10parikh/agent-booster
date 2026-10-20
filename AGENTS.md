# AGENTS.md: Agent Booster

> The one set of instructions for every coding agent (Codex, Cursor, OpenCode, Copilot, Claude Code,
> Gemini CLI) and for people. `CLAUDE.md` and `GEMINI.md` import this file. The brain hub is
> [`brain/MOC - agent-booster.md`](./brain/MOC%20-%20agent-booster.md).

## What it does

`agent-booster` does mechanical code edits with deterministic, regex-based transforms instead of a
model: strip `console` calls, turn `var` and `let` into `const` where nothing reassigns them, sort
imports, wrap async functions in try/catch, add debug logging, add `"use strict"`. Each run costs
nothing, makes no network call and gives the same output for the same input. The point: route the
boring edits here and keep the model for edits that need reasoning. Inspired by Ruflo's Agent Booster
module; this is a pure TypeScript and regex reimplementation (no WASM).

## Its tools and how to call them

**Command line.** Run `npx -y -p github:naman10parikh/agent-booster agent-booster <command>`. The
npm name `agent-booster` belongs to a different project, so do not `npm i agent-booster`.

| Command | What it does |
| --- | --- |
| `<transform> <file-or-dir> [--dry-run] [--json]` | Run one transform over a file or a folder (`.ts .tsx .js .jsx .mjs .cjs`, skipping `node_modules`, `dist` and dotfiles). |
| `<transform> --stdin [--json]` | Read code from stdin, write the result (or `{code, changes, description}`) to stdout. |
| `list` | List the six transforms. |
| `route <file> [--dry-run] [--json] [--only=t1,t2]` | Find the mechanical edits in a file, run them for free, and name the edits that need a model. |
| `memory-search "<query>"` | BM25 search over this repository's own knowledge (MEMORY.md, memory/, brain/, docs/). |
| `sandbox-run <transform> <file>` | Run a transform inside an E2B microVM instead of on the host. Needs `E2B_API_KEY`. |
| `log [N]` | Show the last N runs from the run log (`logs/runs.jsonl`). |
| `--help`, `--version` | Help and version. |

The six transforms: `var-to-const`, `remove-console`, `add-logging`, `add-error-handling`,
`format-imports`, `add-strict`. Two more, `add-types` and `async-await`, are on the roadmap: they need
the TypeScript compiler API, not regex.

**MCP server.** `npx -y -p github:naman10parikh/agent-booster agent-booster-mcp` speaks JSON-RPC over
stdio with one tool per transform. Each takes `{ "code": "<source>" }` and returns
`{code, changes, description}`.

| Tool | What it does |
| --- | --- |
| `transform_var_to_const` | `var`/`let` to `const` where the binding is never reassigned. |
| `transform_remove_console` | Strip `console.*` statements. |
| `transform_add_logging` | Add a `console.debug` line at each function entry. |
| `transform_add_error_handling` | Wrap async functions that lack try/catch. |
| `transform_format_imports` | Sort and group imports: builtins, external, relative. |
| `transform_add_strict` | Prepend `"use strict"` once. |

**Skills** (in [`skills/`](skills/)): `route-the-boring-path` and `sandbox-untrusted-transform` (for
any agent using the tool) and `add-a-transform` (for working on Agent Booster itself).

**Sub-agents** (in `.claude/agents/`): `transform-reviewer` (hunts for inputs a transform rewrites
wrongly) and `edit-router` (splits a requested change into free transforms and model work), plus a
general toolkit: `architect`, `code-reviewer`, `loop-auditor`, `performance-analyzer`,
`research-agent`, `security-reviewer`, `test-writer`. They read and report; the parent edits.

## Where things live

| Path | What lives here |
| --- | --- |
| `src/index.ts` | The CLI: argument parsing, file walker and its own copy of the six transforms. |
| `src/transforms.ts` | The shared copy of the transforms, used by the router and the sandbox runner. |
| `src/mcp-server.ts` | The MCP server, with its own inline copy so it runs standalone. |
| `src/route.ts`, `src/run-log.ts`, `src/memory-search.ts`, `src/sandbox-run.ts` | The router (dispatch), the run log (observability), BM25 memory search, the E2B runner. |
| `src/__tests__/`, `eval/` | 7 end-to-end CLI tests and 15 golden evals (including CLI and MCP agreement). |
| `identity/`, `memory/`, `brain/` | Booster's SOUL, BRAND, HEARTBEAT and MEMORY; long-term memory and append-only LEARNINGS; the Obsidian brain. |
| `skills/`, `hooks/`, `.claude/` | Skills, the plugin's hook, and the maintainer harness (rules, agents, settings). |
| `.claude-plugin/`, `gemini-extension.json`, `.well-known/agent-card.json` | Claude Code plugin, Gemini CLI extension, A2A agent card. |
| `dsip.json`, `scripts/improve.mjs`, `.github/workflows/` | The self-improvement contract, its loop, CI and the daily loop. |

## Build, test, run

```bash
pnpm install      # Node >= 18; also builds dist/ (the prepare script)
pnpm test         # 7 end-to-end tests of the compiled CLI
pnpm eval         # 15 golden evals (run after pnpm build)
pnpm improve      # the self-improvement loop; writes logs/improve/latest.md
echo 'var x = 5;' | node dist/index.js var-to-const --stdin
```

Never claim a `src/` change works until `pnpm build && pnpm test && pnpm eval` are green and you have
run the real CLI on sample input.

## Editing rules

- **Honesty bar:** document exactly what is in the `transforms` registry. Do not advertise a transform
  that is not there, and publish no invented benchmarks (no "352x", no "WASM": this is pure regex).
- **Conservative, not clever.** Transforms are heuristic, not AST. When in doubt, skip the edit. A
  reassignment check covers every assignment operator and `++`/`--`; generated code must parse as plain
  JavaScript.
- **Three copies, one behaviour.** A transform change lands in `src/index.ts`, `src/transforms.ts` and
  `src/mcp-server.ts`, with a golden case in `eval/golden.test.ts` that failed before the change.
- **Adding a transform:** add it to all three copies and their registries, to the `list`/`--help` text
  and the README table, and add a golden case. Keep zero runtime dependencies in the transforms.

## Commit grammar

```
feat(skill):    a new or changed capability
feat(employee): an agent-role or persona change
feat(company):  a repository-wide structural change
fix: / docs: / refactor: / test: / chore:  conventional commits
```

## Memory and brain

- A new durable decision: one line in [memory/MEMORY.md](./memory/MEMORY.md) under the right header.
- An error fixed: a root-cause entry in [memory/LEARNINGS.md](./memory/LEARNINGS.md), ending in a rule.
- Anything worth finding later: link it from the [MOC](./brain/MOC%20-%20agent-booster.md).
- An older, mis-copied wiki schema is kept for reference in [AGENTS.md.example](./AGENTS.md.example).

## What not to do

- Never make a network call or require an API key in a transform.
- Never let a transform rewrite code it is unsure about.
- Never let the three copies of a transform drift apart.
- Never run `route` blindly: `remove-console` and `add-logging` undo each other, so pass `--only=`.
