import { defineConfig } from "vitest/config";

// Golden evals run against the built CLI and MCP server: run `pnpm build` first.
export default defineConfig({
  test: {
    include: ["eval/**/*.test.ts"],
    testTimeout: 20000,
  },
});
