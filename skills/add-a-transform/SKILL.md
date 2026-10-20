---
name: add-a-transform
description: >-
  Add a new zero-LLM code transform to agent-booster correctly and consistently —
  the function and its registry entry in src/transforms.ts, its MCP tool, the
  help/README docs, and the tests — without adding a runtime dependency to the
  transforms. Use whenever the task is "add a transform that does X" or "agent-booster
  should also be able to Y" for a deterministic, regex-level source edit.
---

# Skill: Add a Transform

agent-booster's transforms are deterministic, regex-based source edits. Each one is defined
once, in `src/transforms.ts`; the CLI, the MCP server, the router and the sandbox runner all
import it from there. Adding one still touches five places that must stay in sync, or the
README will lie about what the tool does (the honesty bar in AGENTS.md). This skill is the
checklist that keeps them aligned.

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
   - have zero runtime dependencies (Node builtins only),
   - stay self-contained: `sandbox-run` sends the function's own source text into the
     sandbox, so it may not call helpers defined elsewhere in the file.

3. **Put it in `src/transforms.ts`, and only there:** export the function and add it to
   the exported `transforms` map. The CLI (`src/index.ts`), the router (`route.ts`) and the
   sandbox runner (`sandbox-run.ts`) read that map, so the new name works in all three at
   once. Never paste a second copy of the function into another file: golden case G16 fails
   if a transform is defined anywhere but `src/transforms.ts`.

   Then give it an MCP tool: add a `transform_<name>` entry to `TOOLS` in
   `src/mcp-server.ts` with a description, an input schema and a `run` that calls the
   imported function. The MCP server lists only the tools in `TOOLS`.

4. **Document it in both doc surfaces:**
   - the `--help` text in `src/index.ts` (`list` reads the map by itself),
   - the transform table in `README.md`.
   No fabricated benchmarks, no "WASM" — this is pure regex.

5. **Add the tests:**
   - a vitest case in `src/__tests__/` that exercises the new transform through the
     compiled CLI (`--stdin --json`), asserting both `changes` and the resulting `code`,
     with a negative case proving it is a no-op when it shouldn't fire,
   - a golden case in `eval/golden.test.ts`, and the new tool's name in the list that
     G14 expects from the MCP server.

6. **Self-test gate.** Do not claim done until all of these pass:
   ```bash
   pnpm build && pnpm test && pnpm eval
   echo 'var x = 5;' | node dist/index.js <new-transform> --stdin   # eyeball the output
   ```

## Output

A new transform defined once in `src/transforms.ts` and its map, offered as an MCP tool in
`src/mcp-server.ts`, documented in `--help` and the README, covered by passing tests and
evals, and verified on real input. Report the five touched places explicitly
(`src/transforms.ts`, `src/mcp-server.ts`, `src/index.ts` help, `README.md`, the tests)
so a reviewer can confirm nothing drifted.

## Anti-patterns (from AGENTS.md)

- Advertising a transform in the README that isn't in the registry.
- Adding a runtime dependency (zero deps is a feature).
- Implementing an AST-level transform with regex.
- Pasting a second copy of a transform into another file instead of importing it.
- Adding the transform but not its MCP tool, help line or README row.
