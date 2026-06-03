# TODOS — agent-booster

> Human- and agent-readable task list. Check items off as you complete them.
> IDs are stable across sessions — reference them in commit messages.

## CP117 Wave-D gaps

- [x] **T-001** Rename package to `@energy/agent-booster` (code prep — bare name `agent-booster` squatted on npm). Done in `package.json`. **Publish blocked on chairman** (needs `npm login` + org creation under `@energy` scope on npmjs.com — see §Blocked below).
- [x] **T-002** Add MCP shim at `src/mcp-server.ts`. Zero-dependency JSON-RPC 2.0 stdio server exposing all 6 transforms as MCP tools. Compiled to `dist/mcp-server.js`. Registered in `.mcp.json` as `"agent-booster"` server.

## Roadmap transforms (not yet implemented)

- [ ] **T-003** `add-types` — add basic TypeScript type annotations. Needs AST (TypeScript compiler API), not regex. Medium effort.
- [ ] **T-004** `async-await` — convert `.then()` chains to `async/await`. Needs AST. Medium effort.

## Harness improvements

- [ ] **T-005** Add a vitest test for the MCP server (`src/__tests__/mcp-server.test.ts`) — validate initialize + tools/list + tools/call for each transform over the JSON-RPC wire.
- [ ] **T-006** Populate `eval/` with a golden-set eval harness (L3 eval, 5–10 golden inputs per transform, CI-gated).
- [ ] **T-007** Add `agentgrid` / `agentdial` integration to skills — so the agent can invoke these transforms from within a running grid.

## Chairman-blocked

- **PUBLISH** `@energy/agent-booster` to npm: requires `npm login` as `naman10parikh` + `npm org create energy` (or confirm org exists) + `pnpm publish --access public`. Run `pnpm prepublishOnly` locally first to confirm clean tarball. CODE IS READY.
