# agent-booster — Session Context

Current state of the repo. Read this at session start; deeper docs are linked at the bottom.

## Where we are

- **Status:** working v1.0.0 CLI. `pnpm build` is green; `pnpm test` is green (7 tests passing).
  6 transforms implemented (`var-to-const`, `remove-console`, `add-logging`, `add-error-handling`,
  `format-imports`, `add-strict`); 2 transforms on the roadmap (`add-types`, `async-await` — need
  AST analysis, not regex).
- **Product:** single self-contained TypeScript binary at `src/index.ts`, zero runtime deps.
- **Harness:** inherited Energy agent-native scaffold (identity / memory / brain / skills / hooks /
  rules / sub-agents). Forged 2026-05-25 via harness-forge (CP103); docs standardized to the
  agent-native doc standard (CP104, 2026-05-26).

## What's next

- Implement the 2 roadmap transforms (`add-types`, `async-await`) using the TypeScript compiler
  API for AST-level correctness — this is the next milestone.
- Publish to npm (the `prepublishOnly` script gates on build + test).

## Deeper docs

- [README.md](./README.md) — full transform table, maturity notes, why zero-LLM.
- [QUICKSTART.md](./QUICKSTART.md) — build + run commands inline.
- [CLAUDE.md](./CLAUDE.md) — operating model + harness component map.
- [AGENTS.md](./AGENTS.md) — agent-orchestration conventions + directory map.
- [`brain/MOC - agent-booster.md`](./brain/MOC%20-%20agent-booster.md) — knowledge-graph hub.
