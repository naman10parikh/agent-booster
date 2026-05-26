---
type: company-brain
status: active
created: 2026-05-25
updated: 2026-05-26
tags: [agent-booster, company-brain, memory]
related: ["[[MOC - agent-booster]]", "[[ORG_CONTEXT]]"]
---

# agent-booster — ORG_MEMORY (the company brain's memory)

Every agent writes back here after acting. The fleet inherits every workflow's learnings.

Backlink: [[MOC - agent-booster]]

## Durable learnings

- **Honesty over hype (CP103).** The first cut of this repo's docs claimed a "352x" speedup and a
  WASM core. Neither was true — the tool is pure regex. The README was rewritten to document
  exactly what ships: 6 implemented transforms, 2 roadmap transforms, no fabricated benchmarks.
  Rule: never advertise a transform that isn't in the `transforms` registry in `src/index.ts`, and
  never quote a benchmark the code can't reproduce.

- **Regex, not AST — and that's a deliberate boundary.** `add-types` and `async-await` were left on
  the roadmap precisely because they can't be done safely with regex; they need the TypeScript
  compiler API. Keeping the regex transforms conservative (skip when in doubt) is what makes the
  tool trustworthy enough to run on a whole source tree.

- **Zero runtime dependencies is a feature.** `src/index.ts` is self-contained (only Node builtins).
  This keeps install instant, the binary auditable, and the "no network" promise literally true.

- **Docs standardized to the agent-native doc standard (CP104, 2026-05-26).** Rewrote the
  mis-copied WikiMem `AGENTS.md` into a repo-specific orchestration guide (the original schema is
  preserved as `AGENTS.md.example`); made QUICKSTART self-standing; expanded the brain MOC to link
  every doc and name every folder; seeded `memory/MEMORY.md` and `memory/LEARNINGS.md`.

## How to extend

When you act on this repo, append the learning here (and the error→root-cause version in
[memory/LEARNINGS.md](../memory/LEARNINGS.md)). See [[ORG_CONTEXT]] for what the repo is and
[[MOC - agent-booster]] to navigate the rest.
