# agent-booster — Long-Term Memory (index)

> Inherited memory-harness structure from Energy. One line per durable fact.
> Layers: this index → topics/ deep-dives → daily/ logs → archive/ (compressed >30d, never deleted).

## Architecture Decisions

- **Zero-LLM, regex-only.** All transforms are deterministic regular-expression edits — no API
  calls, no WASM, no native bindings, no network. `$0` per run, fully reproducible. (2026-05-25)
- **Single self-contained binary.** The product is one file, `src/index.ts`, with zero runtime
  dependencies (Node builtins only). Keeps install instant and the tool auditable. (2026-05-25)
- **6 transforms shipped, 2 deferred.** `add-types` and `async-await` need AST-level analysis (the
  TypeScript compiler API), so they are roadmap, not regex. Implemented: `var-to-const`,
  `remove-console`, `add-logging`, `add-error-handling`, `format-imports`, `add-strict`. (2026-05-25)

## Key Patterns

- **Route-the-boring-path.** An orchestrating agent classifies an edit and routes mechanical ones
  to `agent-booster`, reserving LLM budget for edits that need reasoning. This is the tool's reason
  to exist.
- **Conservative heuristics.** Transforms skip rather than risk a wrong rewrite (e.g.
  `var-to-const` leaves anything that looks reassigned). Users `--dry-run` first.
- **`--stdin --json`** is the agent-facing interface: pipe code in, get a parseable
  `{code, changes, description}` result out.

## Technology Choices

- TypeScript (strict) compiled with `tsc` → `dist/`. Test runner: Vitest (runs the compiled CLI
  end-to-end). Package manager: pnpm. Node >= 18.

## People & Resources

- Inspired by Ruflo's Agent Booster WASM module (this is a pure-regex reimplementation).
- Forged from the Energy harness formula via harness-forge (CP103).

## What NOT to Do

- Do **not** advertise transforms not in the `transforms` registry, or quote benchmarks the code
  can't reproduce (the original "352x"/WASM claims were false and were removed in CP103).
- Do **not** attempt `add-types`/`async-await` with regex — they require AST analysis.
- Do **not** add runtime dependencies — zero deps is a feature.

## Operating Model

- Co-founder mode: act, don't ask; self-improve each session; test as a user. Inherited
  `.claude/rules/*.md` are glob-loaded every session. Commit grammar:
  `feat(skill|employee|company):` + conventional commits.

## Topic Files Index

- (none yet — deep-dives go in [topics/](./topics/) and get linked here)
