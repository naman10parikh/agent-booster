---
name: route-the-boring-path
description: >-
  Classify a code edit and route the mechanical part to agent-booster's zero-LLM
  transforms ($0, deterministic) while reserving the LLM only for edits that need
  real reasoning. Use this BEFORE spending a model token on any edit to a .ts/.tsx/
  .js/.jsx/.mjs/.cjs file — especially batch edits like "strip all console.logs",
  "var→const across src/", "sort the imports", or "wrap async fns in try/catch".
---

# Skill: Route the Boring Path

The core reason agent-booster exists: a coding agent's token budget is its scarcest
resource, yet a large fraction of real edits are mechanical (formatting, dead-code
removal, trivial syntax migrations). Sending those to an LLM is slow, costs money, and
is non-deterministic. This skill is the decision procedure for routing each edit to the
cheapest capable executor.

## Trigger

Invoke when you are about to edit source code and the edit *might* be mechanical:

- "remove all console statements", "strip debug logging"
- "convert var/let to const", "modernize this file"
- "sort/group the imports"
- "wrap the async functions in try/catch"
- any batch edit across a directory of `.ts .tsx .js .jsx .mjs .cjs` files

If the edit is clearly semantic (rename a concept, change business logic, refactor an
algorithm), skip this skill — that work needs the model.

## Steps

1. **Dry-run the router first — never edit blind.** From the repo root run:
   ```bash
   node dist/index.js route <file> --dry-run --json
   ```
   (Build first with `pnpm build` if `dist/` is stale.) The router INSPECTs the file,
   CLASSIFIES each finding as `mechanical` (a deterministic transform can do it) or
   `llm` (needs AST/semantic reasoning — `add-types`, `async-await`), PLANs the order,
   and reports what it *would* run.

2. **Read the plan.** The JSON has `mechanical[]` (what runs for $0), `escalated[]`
   (what must go to a model), `totalChanges`, and `llmCallsSaved`.

3. **Execute the mechanical branch for $0.** Drop `--dry-run` to apply, or run a single
   transform directly:
   ```bash
   node dist/index.js route <file>            # apply all mechanical transforms
   node dist/index.js remove-console <file>   # or one specific transform
   ```
   Every run appends an audit record to `logs/runs.jsonl` (observability spine).

4. **Handle the escalated branch yourself (the model).** Only the edits in
   `escalated[]` deserve a token. For each, do the reasoning-heavy rewrite by hand —
   this is the budget you just protected.

5. **Verify.** Re-run `route <file> --dry-run` (should now report fewer mechanical
   findings) and run `pnpm test` if you touched product code.

## Output

Report the routing decision explicitly, e.g.:

```
Routed src/utils.ts:
  $0 (mechanical, applied): remove-console (3), var-to-const (1)
  → LLM (escalated, did by hand): async-await (1 .then chain)
  Saved 2 LLM edit-passes; logged to logs/runs.jsonl.
```

## Why this is the boring-path optimization

Deterministic transforms are **free** (`$0`, no API key), **fast** (no network),
**reproducible** (same input → same output), and **reviewable** (a fixed regex you can
read). The skill's whole job is to make sure those edits never burn a model token.

See `src/route.ts` for the implementation and `memory/MEMORY.md` → "Route-the-boring-path".
