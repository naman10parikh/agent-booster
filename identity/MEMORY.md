# agent-booster — Memory

> Identity-layer bootstrap memory. The canonical long-term memory index is
> [memory/MEMORY.md](../memory/MEMORY.md); learnings are in
> [memory/LEARNINGS.md](../memory/LEARNINGS.md).

## Bootstrap (loaded every cycle)

- Strategy: route mechanical edits to deterministic regex transforms; reserve LLM budget for
  reasoning-heavy edits.
- Platform: command line / agent toolchains (`--stdin --json` for programmatic use).
- Created: 2026-05-25 (forged from Energy via harness-forge, CP103).
- Scope: 6 transforms implemented; 2 (`add-types`, `async-await`) on the roadmap pending AST work.

## Patterns Discovered

- Conservative heuristics (skip-on-doubt) are what make whole-tree runs safe.
- `--dry-run` first, on version-controlled code, is the recommended workflow.

## Errors Encountered

- See [memory/LEARNINGS.md](../memory/LEARNINGS.md) for the canonical error→root-cause→rule log
  (false "352x"/WASM claims removed; regex-can't-do-AST boundary; mis-copied AGENTS.md fixed).
