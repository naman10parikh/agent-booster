# eval/

Golden evals: binary pass or fail, run by `pnpm build && pnpm eval` and by CI on every push.
[`golden.test.ts`](golden.test.ts) holds 16 cases. Each pins the exact output of a transform on a
small input, including the inputs a careless regex gets wrong (compound assignment, loop counters,
console text inside a string, an existing try/catch). It also checks that generated code parses as
plain JavaScript, that `route --only` runs only the named transforms, and that the CLI and the MCP
server return the same code for every input. G16 checks that each transform is defined once, in
`src/transforms.ts`, and that the CLI and the MCP server import it from there.

[`baseline.json`](baseline.json) records the accepted pass count. The scheduled improvement loop
(`scripts/improve.mjs`) fails when the count drops below it and writes a proposal either way. The
end-to-end CLI tests live in [`src/__tests__/`](../src/__tests__/) and run with `pnpm test`.
