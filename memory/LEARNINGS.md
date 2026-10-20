# agent-booster — LEARNINGS (append-only)

Every error → root cause → rule. Auto-compressed when >500 lines (memory-compress.sh).

## 2026-05-25 — Docs must match the code, not the aspiration

- **What broke:** the initial extracted docs claimed a "352x" speedup and a WASM core; the tool is
  pure regex with no benchmark behind that number.
- **Root cause:** marketing copy was carried over from the inspiration (Ruflo's WASM module)
  instead of describing what this implementation actually does.
- **Rule:** document only what ships. Transforms must appear in the `transforms` registry in
  `src/index.ts` before they appear in the README/help; no benchmark unless the repo can reproduce
  it. (Fixed in CP103 README rewrite.)

## 2026-05-25 — Regex can't safely do type/async rewrites

- **What broke:** `add-types` and `async-await` were listed as transforms but produced unsafe or
  no-op results when attempted with regex.
- **Root cause:** both require understanding scope/types — i.e. an AST — which regex cannot model.
- **Rule:** mark them as roadmap, gated on the TypeScript compiler API. Keep regex transforms
  conservative (skip on doubt) so they're safe to run across a whole tree.

## 2026-05-26 — Mis-copied AGENTS.md from cross-repo extraction

- **What broke:** `AGENTS.md` shipped the generic WikiMem wiki-schema (sha `627eebad`) instead of
  agent-booster orchestration conventions — a wrong-repo artifact from harness-forge.
- **Root cause:** the forge copied a template `AGENTS.md` without specializing it per repo.
- **Rule:** every extracted repo's `AGENTS.md` must describe THIS repo's dirs and build/commit
  conventions; keep the generic template as `AGENTS.md.example` if it's worth referencing. (Fixed
  in CP104 doc-standardization.)

## 2026-10-19 — "Skips anything reassigned" missed `+=` and `++`

- **What broke:** `var-to-const` turned `let count = 0; count += 1;` and `for (let i = 0; ...; i++)`
  into `const`, which throws at run time. `remove-console` also ate the next line's indentation, and
  `add-error-handling` wrote `catch (err: unknown)`, which is not valid JavaScript.
- **Root cause:** the reassignment check only matched a plain `name =`; the console regex ended in
  `\s*`, which swallows the next line's spaces; the catch clause used TypeScript-only syntax.
- **Rule:** a reassignment check covers every assignment operator and `++`/`--`; a line-removal regex
  ends in `[ \t]*\n?`; generated code must parse as plain JavaScript. Each fix lands in all three
  copies (CLI, `src/transforms.ts`, MCP server) with a golden case in `eval/golden.test.ts` that
  failed before it, and the CLI-and-MCP agreement case guards the copies from drifting.

## 2026-10-20: Three copies of the transforms, and a skill that named two

- **What broke:** the transforms lived in `src/index.ts`, `src/transforms.ts` and `src/mcp-server.ts`. The
  add-a-transform skill named only the first two, so a transform added by following it never reached the MCP
  server. The reason given for the copies, a single-file CLI, was no longer true: the CLI already imported
  `transforms.ts` through the router.
- **Root cause:** copies made for an old packaging reason were kept after the reason went away.
- **Rule:** a transform is defined once, in `src/transforms.ts`, and every surface imports it. Golden case G16
  fails if a transform is defined in any other file.
