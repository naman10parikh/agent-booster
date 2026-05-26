# AGENTS.md — agent-booster orchestration conventions

> How an agent (Claude Code, or any LLM harness) should operate **this** repo.
> This is the agent's contract for `agent-booster`; humans should start at [README.md](./README.md)
> and [QUICKSTART.md](./QUICKSTART.md). The brain hub is [`brain/MOC - agent-booster.md`](./brain/MOC%20-%20agent-booster.md).

## What this repo is

`agent-booster` is a **zero-LLM code-transform CLI**: deterministic, regex-based source edits
(strip `console.log`s, sort imports, `var`→`const`, wrap async fns in try/catch, …) that cost
`$0` and make no API calls. The product is a single TypeScript binary at `src/index.ts`; the rest
of the tree is the inherited Energy agent-native harness (identity, memory, brain, skills, hooks,
rules, sub-agents). See [CLAUDE.md](./CLAUDE.md) for the operating model.

> The repo previously shipped a mis-copied WikiMem wiki-schema in this file. That schema has been
> archived to [AGENTS.md.example](./AGENTS.md.example) for reference; this file is now the real,
> repo-specific orchestration guide.

## Directory map (what lives where)

```
src/                  # THE PRODUCT — the agent-booster CLI (single entry: index.ts)
  index.ts            #   transform registry + the 6 transforms + arg parsing + file walker
  __tests__/          #   vitest suite (runs the compiled CLI end-to-end)
dist/                 # tsc build output (gitignored; compiled on publish)
eval/                 # eval + observer harness (scaffold; see eval/README.md)
identity/             # who this agent is: SOUL.md, BRAND.md, MEMORY.md, HEARTBEAT.md
memory/               # long-term memory: MEMORY.md (index) + LEARNINGS.md (append-only)
  archive/            #   compressed entries >30 days (never deleted)
  daily/              #   per-session logs
  topics/             #   deep-dive topic files
  maintainer-prompts/ #   raw maintainer directives (kept empty in this public repo)
brain/                # Obsidian knowledge graph: MOC + ORG_CONTEXT + ORG_MEMORY
skills/               # repo-local skills (scaffold; inherited skills live in .claude/skills/)
hooks/                # repo-local hooks (scaffold; active hooks live in .claude/hooks/)
tools/                # repo-local tools (scaffold)
scripts/              # harness utilities (memory-search, memory-compress, budget-manager, …)
.claude/              # the Claude Code harness: rules/, skills/, hooks/, agents/, commands/
  rules/              #   operating rules, glob-loaded every session
  skills/             #   on-demand capabilities
  hooks/              #   lifecycle automation (session start, pre-compact, …)
  agents/             #   specialist sub-agents (code-reviewer, research-agent, …)
  commands/           #   slash commands (/start, /wrap-up, /status, …)
.github/workflows/    # CI (build + test on push)
```

Empty scaffold dirs (`eval/`, `skills/`, `hooks/`, `tools/`, `memory/*`) each carry a one-line
`README.md` explaining their intended role until they are populated.

## How to work this repo (agent boot sequence)

1. Read [CLAUDE.md](./CLAUDE.md) (operating model), then [CONTEXT.md](./CONTEXT.md) (current state).
2. Read [`brain/MOC - agent-booster.md`](./brain/MOC%20-%20agent-booster.md) to navigate the docs.
3. Check [memory/LEARNINGS.md](./memory/LEARNINGS.md) for known pitfalls before changing `src/`.
4. `.claude/rules/*.md` are glob-loaded automatically — they are the hard rules.

## Build & test (the only commands you need)

```bash
pnpm install      # install deps (Node >= 18)
pnpm build        # tsc → dist/
pnpm test         # vitest — runs the compiled CLI end-to-end (7 tests)
pnpm dev          # tsc --watch
```

**Self-test gate:** never claim a `src/` change works until `pnpm build && pnpm test` are both
green AND you have run the real CLI on sample input (e.g.
`echo 'var x = 5;' | node dist/index.js var-to-const --stdin`).

## Editing rules (repo-specific)

- **Honesty bar:** the README documents exactly 6 implemented transforms and 2 roadmap transforms
  (`add-types`, `async-await`). Do **not** advertise transforms that aren't in the `transforms`
  registry in `src/index.ts`. No fabricated benchmarks (no "352x", no "WASM" — this is pure regex).
- **Transforms are heuristic, not AST.** Keep them conservative; when in doubt, skip the edit
  rather than risk a wrong rewrite. AST-level work belongs to the roadmap milestone.
- **Adding a transform:** add the function in `src/index.ts`, register it in the `transforms` map,
  add it to BOTH the `list`/`--help` text and the README transform table, and add a vitest case.
- Keep `src/index.ts` self-contained — zero runtime dependencies is a feature.

## Commit convention

This repo inherits Energy's snap-back grammar (git revert works at 3 granularities):

```
feat(skill):    — a new/changed capability
feat(employee): — an agent-role / persona change
feat(company):  — repo-wide structural change
fix: / docs: / refactor: / test: / chore:  — conventional commits
```

## Memory & brain protocol

- New durable decision → one line in [memory/MEMORY.md](./memory/MEMORY.md) under the right header.
- Error fixed → root-cause entry in [memory/LEARNINGS.md](./memory/LEARNINGS.md).
- Anything worth navigating later → wikilink it into the [MOC](./brain/MOC%20-%20agent-booster.md);
  every brain note backlinks the MOC and carries YAML frontmatter.
