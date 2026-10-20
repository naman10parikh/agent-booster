# Agent Booster

<!-- fleet:header:start -->
[![CI](https://img.shields.io/github/actions/workflow/status/naman10parikh/agent-booster/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/naman10parikh/agent-booster/actions) [![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE) [![Agent-native](https://img.shields.io/badge/agent--native-yes-2f5d8a?style=flat-square)](AGENTS.md) [![MCP server](https://img.shields.io/badge/MCP-server-1e3f60?style=flat-square)](#use-it-from-any-coding-agent) [![Skills](https://img.shields.io/badge/skills-3-2f6b4f?style=flat-square)](skills/) [![Stars](https://img.shields.io/github/stars/naman10parikh/agent-booster?style=flat-square)](https://github.com/naman10parikh/agent-booster/stargazers)

**Mechanical code edits without a model: deterministic, free, offline.**

Agent Booster is an agent employee, a packaged specialist agent with its own skills, memory and tests. It owns one job: tools / CLIs. Its persona is Booster. Coding agents use it through its skills, its MCP server and its command line. A scheduled job runs its evals and proposes fixes. A person makes every change.

_Agent Booster is part of an agent-native play for agent-native systems that can eventually be recursively self-improving and evolving, operated by agent employees._

[AGENTS.md](AGENTS.md) · [llms.txt](llms.txt) · [Skills](skills/) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [All projects](https://github.com/naman10parikh)
<!-- fleet:header:end -->

Agent Booster (`agent-booster`) does the mechanical part of code editing without a model: it strips
`console` calls, turns `var` and `let` into `const`, sorts imports, wraps async functions in
try/catch, adds debug logging and adds `"use strict"`. It is for coding agents and the people who run
them. Route the boring edits here for free, and keep the model for edits that need reasoning.

<!-- fleet:use:start -->
## Use it from any coding agent

**Claude Code**: the plugin brings the skills, sub-agents, hooks and MCP server.

```
/plugin marketplace add naman10parikh/agent-booster
/plugin install agent-booster@agent-booster
```

<details><summary>Its MCP server, Codex, Cursor, Gemini CLI, one skill and the command line</summary>

**Its MCP server**, in any MCP client:

```bash
claude mcp add --transport stdio agent-booster -- npx -y -p github:naman10parikh/agent-booster agent-booster-mcp
codex mcp add agent-booster -- npx -y -p github:naman10parikh/agent-booster agent-booster-mcp
```

Cursor (`.cursor/mcp.json`), Gemini CLI (`.gemini/settings.json`) and most other clients take the same command as JSON:

```json
{
  "mcpServers": {
    "agent-booster": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "github:naman10parikh/agent-booster",
        "agent-booster-mcp"
      ]
    }
  }
}
```

**Gemini CLI**: the extension brings the context and the MCP server.

```bash
gemini extensions install https://github.com/naman10parikh/agent-booster
```

**One skill** (3 in all, in [skills/](skills/)), in any agent that reads Agent Skills:

```bash
gemini skills install https://github.com/naman10parikh/agent-booster --path skills/route-the-boring-path
git clone --depth 1 https://github.com/naman10parikh/agent-booster /tmp/agent-booster && cp -r /tmp/agent-booster/skills/route-the-boring-path ~/.claude/skills/
```

**The command line:**

```bash
npx -y -p github:naman10parikh/agent-booster agent-booster --help
```

</details>

Codex, Cursor, OpenCode, GitHub Copilot and other agents read [AGENTS.md](AGENTS.md); Claude Code reads [CLAUDE.md](CLAUDE.md) and Gemini CLI reads [GEMINI.md](GEMINI.md), which import it. [llms.txt](llms.txt) maps every surface for agents that read first.
<!-- fleet:use:end -->

## Quick start

It needs Node.js 18 or later. Run it straight from GitHub (the npm name `agent-booster` belongs to a
different project):

```bash
npx -y -p github:naman10parikh/agent-booster agent-booster list
```

Pipe code through a transform, or ask for a result an agent can parse:

```bash
echo 'var x = 5;' | agent-booster var-to-const --stdin
# const x = 5;
printf "console.log('hi');\nconst y = 2;\n" | agent-booster remove-console --stdin --json
# {"code":"const y = 2;\n","changes":1,"description":"Removed console statements"}
```

Preview a whole folder before you write anything:

```bash
agent-booster remove-console src --dry-run
#   src/math.js: 1 would change (Removed console statements)
#   src/name.js: 1 would change (Removed console statements)
# [DRY RUN] 2 changes across 2 files
agent-booster var-to-const src --dry-run
#   src/name.js: 1 would change (var/let → const)
```

`var-to-const` left `src/math.js` alone because its `total` is updated with `+=`. Drop `--dry-run`
to write the changes. Let the router find the mechanical edits in one file, limited to the transforms
you want:

```bash
agent-booster route src/app.js --dry-run --only=remove-console,format-imports
```

## How it works

A coding agent's model budget is its scarcest resource, and many real edits are mechanical:
formatting, dead-code removal, small syntax migrations. Sending those to a model is slow, costs money
and is not deterministic (the model may change things you did not ask for). A deterministic transform
is:

- **Free:** nothing to pay per run, no API key.
- **Fast:** no network round trip.
- **Reproducible:** the same input gives the same output, every time.
- **Reviewable:** a fixed regex you can read, not a black box.

The intended pattern: an orchestrating agent classifies an edit, sends the mechanical part to
`agent-booster`, and keeps the model for edits that need reasoning. `agent-booster route` does that
for one file: it finds which transforms apply, runs them, and names the edits that need a model.

Run against a file or a folder (not `--stdin`), it walks `.ts .tsx .js .jsx .mjs .cjs` files, skips
`node_modules`, `dist` and dotfiles, and reports a change count per file. It is inspired by Ruflo's
Agent Booster module, written in pure TypeScript and regex: no WASM, no native bindings, no network.

### Transforms (6 implemented)

| Transform            | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `var-to-const`       | Convert `var`/`let` to `const` where the binding is never reassigned.     |
| `remove-console`     | Strip `console.log/warn/error/debug/info/...` statements.                 |
| `add-logging`        | Inject `console.debug("[module] fn() called")` at function entry points.  |
| `add-error-handling` | Wrap async functions lacking `try/catch` in a try/catch that re-throws.   |
| `format-imports`     | Sort and group imports into node builtins, external, relative.            |
| `add-strict`         | Prepend a `"use strict";` directive.                                      |

> **Safety note:** these are heuristic, regex-based transforms, not full AST rewrites. They are
> conservative on purpose: `var-to-const` skips any binding that is reassigned, including through
> `+=` or `++`. Still review the diff: use `--dry-run` first, and run on code under version control.

**Roadmap (not implemented yet):** `add-types` (add basic TypeScript type annotations) and
`async-await` (convert `.then()` chains to `async`/`await`). Both need the TypeScript compiler API
rather than regex, which is the next milestone. Pull requests welcome.

### Every command

```bash
agent-booster <transform> <file-or-dir>      # transform a file or recurse a folder
agent-booster <transform> --stdin            # read code from stdin, write the result to stdout
agent-booster <transform> --stdin --json     # machine-readable result (for agents)
agent-booster <transform> <path> --dry-run   # preview changes without writing
agent-booster route <file> [--only=t1,t2]    # run the mechanical edits, name the ones needing a model
agent-booster memory-search "<query>"        # BM25 search over Booster's own knowledge
agent-booster sandbox-run <transform> <file> # run a transform inside an E2B microVM (needs E2B_API_KEY)
agent-booster log [N]                        # the last N runs from logs/runs.jsonl
agent-booster list                           # list the transforms
agent-booster --help
agent-booster --version
```

The MCP server (`agent-booster-mcp`) exposes the six transforms as tools that each take
`{ "code": "..." }`; they are listed in [AGENTS.md](AGENTS.md).

### Project maturity

An early but working tool (v1.0.0): 6 transforms, 7 end-to-end tests and 15 golden evals (including a
check that the CLI and the MCP server agree), a CLI verified end to end, and a daily improvement loop.
It is honest about its limits: regex heuristics, not a full codemod engine, and two roadmap
transforms not built yet. It does exactly what is documented here and nothing more.

## Development

```bash
pnpm install      # also builds dist/
pnpm build        # tsc to dist/
pnpm test         # vitest, runs the compiled CLI end to end
pnpm eval         # the golden evals
pnpm dev          # tsc --watch
```

<!-- fleet:anatomy:start -->
## What it is made of

Every project in this fleet is graded on the same 11 harness components and on self-improvement. Each mark is backed by a file you can open.

| Component | Grade | Where |
| --- | --- | --- |
| Identity | ✅ | identity/SOUL.md:8 (name Booster, tagline), :25 (boundaries); identity/BRAND.md:1 |
| Memory | ✅ | memory/MEMORY.md:1; src/memory-search.ts:132 (BM25, `agent-booster memory-search`); memory/LEARNINGS.md |
| Skills | ✅ | skills/route-the-boring-path/SKILL.md:1 (+2 more in skills/) |
| Tools/CLIs | ✅ | package.json:12-15 (agent-booster, agent-booster-mcp) |
| Hooks | ✅ | .claude/settings.json:4,24; hooks/hooks.json:4; hooks/suggest-transforms.cjs:1 |
| Sub-agents | ✅ | .claude/agents/transform-reviewer.md:1; .claude/agents/edit-router.md:1 |
| MCPs | ✅ | src/mcp-server.ts:158 (6 tools); .mcp.json:3 |
| Dispatch | ✅ | src/route.ts:90 (routeCode); .github/workflows/improve.yml:9 (daily) |
| Evals | ✅ | eval/golden.test.ts:54 (15 cases); .github/workflows/ci.yml:32-35 |
| Observability | ✅ | src/run-log.ts:50 (logs/runs.jsonl on every run; `agent-booster log`) |
| Sandbox/Infra | ✅ | src/sandbox-run.ts:69 (E2B Sandbox.create at :84) |
| Self-improvement | ✅ | dsip.json:1 (L2); scripts/improve.mjs:1 |

✅ real and tested · 🟡 partial, with the reason in the row · ❌ absent
<!-- fleet:anatomy:end -->

<!-- fleet:footer:start -->
## How it improves itself

It carries its own evals and a self-improvement contract, [`dsip.json`](dsip.json), which says what it may change and how a change is judged. A scheduled job runs its evals and proposes fixes. A person makes every change. Lessons it learns are kept as rules in its memory files.

## Part of a fleet

One of the projects by [Naman Parikh](https://github.com/naman10parikh). Each owns one part of an agent's harness, or of the product around an agent, and all of them follow one standard.

Siblings: [agentdial](https://github.com/naman10parikh/agentdial) (identity) · [wikimem](https://github.com/naman10parikh/wikimem) (memory) · [skillsmith](https://github.com/naman10parikh/skillsmith) (skills) · [armory](https://github.com/naman10parikh/armory) (MCPs and the component registry) · [agentgrid](https://github.com/naman10parikh/agentgrid) (dispatch) · [agentswarm](https://github.com/naman10parikh/agentswarm) (dispatch) · [agentbench](https://github.com/naman10parikh/agentbench) (evals) · [agentmoney](https://github.com/naman10parikh/agentmoney) (observability) · [claude-harness](https://github.com/naman10parikh/claude-harness) (the whole harness, as a template).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md). AI-assisted pull requests are welcome. Report a vulnerability privately, as [SECURITY.md](SECURITY.md) explains.

## Star history

[![Star history chart](https://api.star-history.com/svg?repos=naman10parikh/agent-booster&type=Date)](https://star-history.com/#naman10parikh/agent-booster&Date)
<!-- fleet:footer:end -->

## License

MIT © Naman Parikh. See [LICENSE](./LICENSE).
