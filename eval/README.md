# eval/

Eval + observer harness for `agent-booster` (scaffold — not yet populated).

This directory will hold the evaluation rubric and observer that score transform correctness over
time (the AutoLab pattern: same code, measured against golden input→output pairs, so regressions
are caught automatically). Until then, the live regression gate is the vitest suite in
[`src/__tests__/`](../src/__tests__/), run via `pnpm test`.

See the harness component map in [CLAUDE.md](../CLAUDE.md) and the hub
[`brain/MOC - agent-booster.md`](../brain/MOC%20-%20agent-booster.md).
