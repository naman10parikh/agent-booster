---
type: company-brain
status: active
created: 2026-05-25
updated: 2026-05-26
tags: [agent-booster, company-brain, context]
related: ["[[MOC - agent-booster]]", "[[ORG_MEMORY]]"]
---

# agent-booster — ORG_CONTEXT (the company brain's context)

Every agent reads this before acting. "If it is recorded, it happened to the AI."

Backlink: [[MOC - agent-booster]]

## What this repo is

`agent-booster` is a zero-LLM code-transform CLI. It performs simple, mechanical source edits —
stripping `console.log`s, sorting imports, converting `var`/`let` to `const`, wrapping async
functions in `try/catch`, and similar — using deterministic regular-expression transforms. There
are no API calls, the cost per run is `$0`, and the same input always produces the same output.

## Why it exists

A coding agent's token budget is its scarcest resource, and a large fraction of real edits are
purely mechanical. Sending those to an LLM is slow, costs money, and is non-deterministic. The
intended pattern is: an orchestrating agent classifies an edit, routes the trivial/mechanical ones
to `agent-booster`, and reserves the LLM for edits that genuinely need reasoning. It is the
"boring path" optimization for coding agents — inspired by Ruflo's Agent Booster module, but
implemented in pure TypeScript/regex (no WASM, no native bindings, no network).

## Current scope (honest)

Six transforms are implemented and tested today (`var-to-const`, `remove-console`, `add-logging`,
`add-error-handling`, `format-imports`, `add-strict`). Two more (`add-types`, `async-await`) are on
the roadmap — they require AST-level analysis via the TypeScript compiler API rather than regex.
The transforms are intentionally conservative heuristics, not a full codemod engine; users are told
to `--dry-run` first and run on version-controlled code.

## How it relates to the fleet

This repo is one flavor of the Energy agent-native harness, extracted via harness-forge (CP103).
Energy is the control center; `agent-booster` is a standalone, self-improving harness an agent can
operate, test, and extend on its own. The product lives in `src/`; the surrounding identity /
memory / brain / skills / hooks / rules layers are the inherited formula. See
[[MOC - agent-booster]] for the full map.
