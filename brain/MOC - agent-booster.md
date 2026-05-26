---
type: moc
status: active
created: 2026-05-25
updated: 2026-05-26
tags: [agent-booster, moc]
related: ["[[ORG_CONTEXT]]", "[[ORG_MEMORY]]"]
---

# MOC — agent-booster

The master hub for this harness's brain. `agent-booster` is a **zero-LLM, regex-based
code-transform CLI** ($0 cost, no API calls) shipped as a self-contained Energy agent-native
harness. Every doc and every top-level folder is reachable from here.

## Product & front-door docs

- [README.md](../README.md) — human / OSS front door: install, the 6 transforms, why zero-LLM,
  maturity notes, 2 roadmap transforms.
- [QUICKSTART.md](../QUICKSTART.md) — build + run commands inline (clone → working transform).
- [CONTEXT.md](../CONTEXT.md) — current repo state (build/test green; 6 of 8 transforms shipped).
- [LICENSE](../LICENSE) — MIT.

## Agent-operating docs

- [CLAUDE.md](../CLAUDE.md) — operating model + the harness component "formula".
- [AGENTS.md](../AGENTS.md) — this repo's agent-orchestration conventions + directory map.
- [AGENTS.md.example](../AGENTS.md.example) — generic WikiMem wiki-schema kept for reference.

## Company brain

- [[ORG_CONTEXT]] — what this repo/company is and the context every agent reads before acting.
- [[ORG_MEMORY]] — what the fleet has learned operating this harness.

## Memory

- [memory/MEMORY.md](../memory/MEMORY.md) — long-term memory index (decisions / patterns / tech).
- [memory/LEARNINGS.md](../memory/LEARNINGS.md) — append-only error→root-cause→rule log.
- Scaffold sub-folders: [archive/](../memory/archive/), [daily/](../memory/daily/),
  [topics/](../memory/topics/), [maintainer-prompts/](../memory/maintainer-prompts/).

## Identity

- [identity/SOUL.md](../identity/SOUL.md) — who this agent is (identity → personality → boundaries).
- [identity/BRAND.md](../identity/BRAND.md) — name rationale, tagline, landing copy.
- [identity/MEMORY.md](../identity/MEMORY.md) — bootstrap memory for the identity layer.
- [identity/HEARTBEAT.md](../identity/HEARTBEAT.md) — cron-like health schedule.

## Architecture

- The product is a single binary: [src/index.ts](../src/index.ts) — transform registry, the 6
  transforms, arg parsing, file walker. Tests: [src/__tests__/](../src/__tests__/).
- [src/README is the code itself]; behavior is documented in [README.md](../README.md).

## Operations

- [scripts/](../scripts/) — harness utilities: `memory-search.sh`, `memory-compress.sh`,
  `budget-manager.sh`, `doc-health-check.sh`, `auto-switch.sh`.
- [.github/workflows/ci.yml](../.github/workflows/ci.yml) — CI: build + test on push.
- [.claude/](../.claude/) — the Claude Code harness: `rules/`, `skills/`, `hooks/`, `agents/`,
  `commands/` (glob-loaded rules + on-demand capabilities + lifecycle automation).

## Scaffold folders (kept empty, each with a README)

- [eval/](../eval/README.md) — eval + observer harness (planned).
- [skills/](../skills/README.md) — repo-local skills (inherited skills live in `.claude/skills/`).
- [hooks/](../hooks/README.md) — repo-local hooks (active hooks live in `.claude/hooks/`).
- [tools/](../tools/README.md) — repo-local auxiliary tooling.

## Decisions

Durable decisions are logged in [memory/MEMORY.md](../memory/MEMORY.md) → "Architecture Decisions".
Key ones: zero-LLM/regex-only (no WASM, no API); single self-contained binary; honest 6-of-8
transform scope; AST-level transforms deferred to roadmap.
