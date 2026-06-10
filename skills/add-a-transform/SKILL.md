---
name: add-a-transform
description: >-
  Add a new zero-LLM code transform to agent-booster correctly and consistently —
  the function, the two registry registrations, the help/README docs, and a vitest
  case — without breaking the "single self-contained binary, zero runtime deps"
  invariant. Use whenever the task is "add a transform that does X" or "agent-booster
  should also be able to Y" for a deterministic, regex-level source edit.
---

# Skill: Add a Transform

agent-booster's transforms are deterministic, regex-based source edits. Adding one
touches FOUR surfaces that must stay in sync, or the README will lie about what the tool
does (the honesty bar in AGENTS.md). This skill is the checklist that keeps them aligned.

## Trigger

- "add a transform that …" / "make agent-booster also do …"
- a request for a new mechanical edit that is genuinely regex-expressible (no AST needed).

If the edit needs the TypeScript compiler API / semantic analysis (e.g. type inference,
control-flow rewrites), it is an `LLM_ONLY_TRANSFORMS` roadmap item — do NOT implement it
with regex. Add it to `LLM_ONLY_TRANSFORMS` in `src/transforms.ts` and the roadmap section
of the README instead.

## Steps

1. **Decide: regex-able or not.** Conservative is correct — a transform must *skip*
   rather than risk a wrong rewrite. If you cannot express it as a safe regex, stop and
   route it to the LLM-only list.

2. **Write the transform function** with the canonical signature
   `(code: string, filename: string) => { code, changes, description }`. It MUST:
   - count every edit in `changes` (callers and the router rely on this),
   - be a no-op (`changes: 0`, original `code`) when nothing matches,
   - have zero runtime dependencies (Node builtins only).

3. **Register it in BOTH registries** (this is the step people forget):
   - `src/transforms.ts` → the exported `transforms` map (used by `route.ts` +
     `sandbox-run.ts`),
   - `src/index.ts` → the inline `transforms` map (the published single-file CLI keeps
     its own copy so it stays dependency-free).
   The two bodies must be behaviourally identical.

4. **Document it in BOTH doc surfaces:**
   - the `list` / `--help` text in `src/index.ts`,
   - the transform table in `README.md`.
   No fabricated benchmarks, no "WASM" — this is pure regex.

5. **Add a vitest case** in `src/__tests__/` that exercises the new transform through the
   compiled CLI (`--stdin --json`), asserting both `changes` and the resulting `code`.
   Include a negative case proving it is a no-op when it shouldn't fire.

6. **Self-test gate.** Do not claim done until all three pass:
   ```bash
   pnpm build && pnpm test
   echo 'var x = 5;' | node dist/index.js <new-transform> --stdin   # eyeball the output
   ```

## Output

A new transform that is registered in both maps, documented in help + README, covered by
a passing test, and verified on real input. Report the four touched surfaces explicitly
so a reviewer can confirm nothing drifted.

## Anti-patterns (from AGENTS.md)

- Advertising a transform in the README that isn't in the registry.
- Adding a runtime dependency (zero deps is a feature).
- Implementing an AST-level transform with regex.
- Updating one registry/doc surface but not the other.
