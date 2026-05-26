# agent-booster — Heartbeat

`agent-booster` is a CLI tool, not a long-running daemon, so its "heartbeat" is the health of the
repo and its release pipeline rather than a scanning loop.

## Schedule

| Check                | Frequency                | Action on Anomaly                                          |
| -------------------- | ------------------------ | --------------------------------------------------------- |
| Build + test (CI)    | Every push (.github/ci)  | Fail the run; do not publish until green                  |
| Self-test before pub | Pre-publish              | `prepublishOnly` gates `npm publish` on `build && test`   |
| Doc/scope drift      | Each maintenance session | If README lists a transform not in the registry → fix it  |
| Dependency freshness | Periodic                 | Bump devDeps; keep runtime deps at zero                   |

## Health Indicators

- **Healthy:** `pnpm build` and `pnpm test` both green (7 tests); README transform table matches
  the `transforms` registry in `src/index.ts`.
- **Warning:** CI failing on main, or docs advertising more than is implemented.
- **Critical:** published package fails a fresh `npx agent-booster list` → yank/patch.

## Recovery

1. Reproduce locally: `pnpm install && pnpm build && pnpm test`.
2. Check [memory/LEARNINGS.md](../memory/LEARNINGS.md) for a known fix.
3. If fixable: patch, re-run the gate, commit with a `fix:` message.
4. If a scope/honesty drift: reconcile README ↔ registry before anything else.
