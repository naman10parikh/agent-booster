# agent-booster — Quickstart

The fastest path from clone to a working transform.

## Use it (no install)

```bash
npx agent-booster list                       # see the 6 transforms
echo 'var x = 5;' | npx agent-booster var-to-const --stdin   # → const x = 5;
```

## Build & run from source

```bash
pnpm install        # deps (Node >= 18)
pnpm build          # tsc → dist/index.js
node dist/index.js list                       # run the freshly built CLI
echo 'var x = 5;' | node dist/index.js var-to-const --stdin   # → const x = 5;
pnpm test           # vitest — runs the compiled CLI end-to-end (7 tests)
```

## Common commands

```bash
node dist/index.js var-to-const src/          # recurse a dir, write in place
node dist/index.js remove-console src/x.ts --dry-run   # preview, don't write
node dist/index.js remove-console --stdin --json       # machine-readable for agents
node dist/index.js --help                     # full help
```

## Where everything lives

The product CLI is `src/index.ts`. The rest of the tree is the agent-native harness — its
component map is in [CLAUDE.md](./CLAUDE.md) ("Harness components"), and every doc is navigable
from the brain hub [`brain/MOC - agent-booster.md`](./brain/MOC%20-%20agent-booster.md). For the
full feature/limit story (and the 2 roadmap transforms), see [README.md](./README.md). Agent
operators read [AGENTS.md](./AGENTS.md).
