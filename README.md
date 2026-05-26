# agent-booster

> Zero-LLM code transforms — deterministic, `$0` cost, no API calls.

`agent-booster` is a tiny CLI that performs **simple, mechanical code edits without invoking
a language model**. When an agent (or a human) needs to strip `console.log`s, sort imports, or
flip `var` to `const`, there is no reason to spend a Claude/GPT token on it — a deterministic
transform does the job instantly, for free, and reproducibly.

It is the "boring path" optimization for coding agents: route trivial edits to a regex-based
transform, and save the LLM budget for the edits that actually need reasoning.

Inspired by Ruflo's Agent Booster WASM module. This implementation is **pure TypeScript/regex**
— no WASM, no native bindings, no network.

---

## Install

```bash
# Run without installing
npx agent-booster list

# Or install globally
npm i -g agent-booster
# (pnpm i -g agent-booster / yarn global add agent-booster also work)
```

Requires Node.js >= 18.

---

## Usage

```bash
agent-booster <transform> <file-or-dir>      # transform a file or recurse a directory
agent-booster <transform> --stdin            # read code from stdin, write result to stdout
agent-booster <transform> --stdin --json     # machine-readable result (for agents)
agent-booster <transform> <path> --dry-run   # preview changes without writing
agent-booster list                           # list available transforms
agent-booster --help                         # full help
agent-booster --version
```

### Examples

```bash
# Convert var/let → const across a source tree (writes in place)
agent-booster var-to-const src/

# Preview which files would change, without touching them
agent-booster remove-console src/utils.ts --dry-run

# Pipe code through a transform (great for editor integrations)
echo 'var x = 5;' | agent-booster var-to-const --stdin
# → const x = 5;

# Get a structured result an agent can parse
printf "console.log('hi');\nconst y = 2;\n" | agent-booster remove-console --stdin --json
# → {"code":"const y = 2;\n","changes":1,"description":"Removed console statements"}
```

When run against a file or directory (not `--stdin`), it walks `.ts .tsx .js .jsx .mjs .cjs`
files, skipping `node_modules`, `dist`, and dotfiles, and reports a per-file change count.

---

## Transforms (6 implemented)

| Transform            | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `var-to-const`       | Convert `var`/`let` to `const` where the binding is never reassigned.     |
| `remove-console`     | Strip `console.log/warn/error/debug/info/...` statements.                 |
| `add-logging`        | Inject `console.debug("[module] fn() called")` at function entry points.  |
| `add-error-handling` | Wrap async functions lacking `try/catch` in a try/catch that re-throws.   |
| `format-imports`     | Sort and group imports into node builtins → external → relative.          |
| `add-strict`         | Prepend a `"use strict";` directive.                                      |

> **Safety note:** these are _heuristic, regex-based_ transforms, not full AST rewrites. They
> are intentionally conservative (e.g. `var-to-const` skips anything that looks reassigned), but
> you should review diffs — use `--dry-run` first, and run on version-controlled code.

### Roadmap (advertised in help text, not yet implemented)

The inline help and source header mention two more transforms that are **not in the registry
yet**. They are roadmap items, not working features:

- `add-types` — add basic TypeScript type annotations.
- `async-await` — convert `.then()` chains to `async/await`.

These need AST-level analysis (the TypeScript compiler API) rather than regex, which is the next
milestone. PRs welcome.

---

## Why zero-LLM?

A coding agent's token budget is its scarcest resource. A large fraction of edits in real agent
workloads are mechanical — formatting, dead-code removal, trivial syntax migrations. Sending
those to an LLM is slow, costs money, and is _non-deterministic_ (the model may reformat things
you didn't ask it to). A deterministic transform is:

- **Free** — `$0` per run, no API key.
- **Fast** — no network round-trip.
- **Reproducible** — same input → same output, every time.
- **Reviewable** — a fixed regex you can read, not a black box.

The intended pattern: an orchestrating agent classifies an edit, routes the mechanical ones to
`agent-booster`, and reserves the LLM for edits that need real reasoning.

---

## Project maturity

This is an **early but working tool** (v1.0.0): 6 transforms, a passing test suite (7 tests), and
a functional CLI verified end-to-end. It is honest about its limits — regex heuristics, not a
full codemod engine, and two roadmap transforms not yet built. It does exactly what's documented
above and nothing more.

---

## Agent-native harness

This repo is more than a CLI — it ships as a self-contained **agent-native harness**, forged from
the [Energy](https://github.com/naman10parikh) harness formula. Energy is the control center; this
is a standalone flavor that an agent can operate, improve, and extend on its own.

| Layer          | Location                              | Role                                                   |
| -------------- | ------------------------------------- | ------------------------------------------------------ |
| Product        | `src/`, `dist/`, `package.json`       | The `agent-booster` CLI itself.                        |
| Identity       | `identity/` (SOUL, BRAND, HEARTBEAT)  | Who this agent is and how it presents itself.          |
| Memory         | `memory/` + `brain/` (Obsidian vault) | Long-term decisions, learnings, and a knowledge graph. |
| Skills         | `skills/`, `.claude/skills/`          | On-demand capabilities the agent can invoke.           |
| Hooks          | `hooks/`, `.claude/hooks/`            | Lifecycle automation (session start, pre-compact, …).  |
| Rules          | `.claude/rules/`                      | Operating rules, glob-loaded every session.            |
| Sub-agents     | `.claude/agents/`                     | Specialist agents (code-reviewer, research, …).        |
| Commands / MCP | `.claude/commands/`, `.mcp.json`      | Slash commands and Model Context Protocol servers.     |

See [`CLAUDE.md`](./CLAUDE.md) for the full operating model.

---

## Development

```bash
pnpm install
pnpm build        # tsc → dist/
pnpm test         # vitest (runs the compiled CLI end-to-end)
pnpm dev          # tsc --watch
```

---

## License

MIT © Naman Parikh — see [LICENSE](./LICENSE).
