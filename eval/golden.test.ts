// Golden tasks for agent-booster: binary pass or fail, run by `pnpm eval` and by CI on every push.
// Each case pins the exact output of a transform on a small input, including the cases a regex
// transform gets wrong if it is careless (compound assignment, loop counters, strings). The last
// cases check that the CLI and the MCP server give the same answer, and that every transform is
// defined once, in src/transforms.ts, so no second copy can drift from it.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";

const ROOT = join(__dirname, "..");
const CLI = join(ROOT, "dist/index.js");
const MCP = join(ROOT, "dist/mcp-server.js");

interface Result {
  code: string;
  changes: number;
}

function cli(transform: string, code: string): Result {
  const out = spawnSync("node", [CLI, transform, "--stdin", "--json"], { input: code, encoding: "utf8" });
  return JSON.parse(out.stdout) as Result;
}

function mcp(calls: { name: string; arguments: Record<string, unknown> }[]): unknown[] {
  const lines = [
    { jsonrpc: "2.0", id: 0, method: "initialize", params: {} },
    ...calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.name === "tools/list" ? "tools/list" : "tools/call", params: c.name === "tools/list" ? {} : c })),
  ].map((l) => JSON.stringify(l));
  const out = spawnSync("node", [MCP], { input: lines.join("\n") + "\n", encoding: "utf8" });
  const byId = new Map<number, unknown>();
  for (const line of out.stdout.split("\n").filter(Boolean)) {
    const msg = JSON.parse(line) as { id: number; result: unknown };
    byId.set(msg.id, msg.result);
  }
  return calls.map((_, i) => byId.get(i + 1));
}

const GOLDEN: { id: string; transform: string; input: string; output: string; changes: number }[] = [
  { id: "G1 var and let become const", transform: "var-to-const", input: "var a = 1;\nlet b = 2;\nuse(a, b);\n", output: "const a = 1;\nconst b = 2;\nuse(a, b);\n", changes: 2 },
  { id: "G2 compound assignment keeps let", transform: "var-to-const", input: "let count = 0;\ncount += 1;\n", output: "let count = 0;\ncount += 1;\n", changes: 0 },
  { id: "G3 loop counter keeps let", transform: "var-to-const", input: "for (let i = 0; i < 3; i++) {}\n", output: "for (let i = 0; i < 3; i++) {}\n", changes: 0 },
  { id: "G4 reassigned var stays var", transform: "var-to-const", input: "var x = 5;\nx = 10;\n", output: "var x = 5;\nx = 10;\n", changes: 0 },
  { id: "G5 console calls go, indentation stays", transform: "remove-console", input: "function f() {\n  console.log('x');\n  return 1;\n}\n", output: "function f() {\n  return 1;\n}\n", changes: 1 },
  { id: "G6 console text inside a string stays", transform: "remove-console", input: "const s = 'console.log(1)';\n", output: "const s = 'console.log(1)';\n", changes: 0 },
  { id: "G7 debug line at a function entry", transform: "add-logging", input: "function load(id) {\n  return id;\n}\n", output: 'function load(id) {\n  console.debug("[stdin] load() called");\n  return id;\n}\n', changes: 1 },
  { id: "G9 existing try/catch is left alone", transform: "add-error-handling", input: "async function safe() {\n  try {\n    await x();\n  } catch (e) {\n    throw e;\n  }\n}\n", output: "async function safe() {\n  try {\n    await x();\n  } catch (e) {\n    throw e;\n  }\n}\n", changes: 0 },
  { id: "G10 imports grouped builtin, external, relative", transform: "format-imports", input: 'import b from "./b.js";\nimport fs from "node:fs";\nimport z from "zod";\n', output: 'import fs from "node:fs";\n\nimport z from "zod";\n\nimport b from "./b.js";\n', changes: 3 },
  { id: "G11 use strict added once", transform: "add-strict", input: "const x = 1;\n", output: '"use strict";\n\nconst x = 1;\n', changes: 1 },
  { id: "G12 use strict is idempotent", transform: "add-strict", input: '"use strict";\nconst x = 1;\n', output: '"use strict";\nconst x = 1;\n', changes: 0 },
];

describe("golden transforms (CLI)", () => {
  for (const g of GOLDEN) {
    it(g.id, () => {
      const r = cli(g.transform, g.input);
      expect(r.code).toBe(g.output);
      expect(r.changes).toBe(g.changes);
    });
  }

  it("G8 error handling wraps an async function in valid JavaScript", () => {
    const r = cli("add-error-handling", "async function fetchUser(id) {\n  return await db.get(id);\n}\n");
    expect(r.changes).toBe(1);
    expect(r.code).toContain("try {");
    expect(r.code).toContain("} catch (err) {");
    expect(() => new Script(r.code)).not.toThrow(); // parses as plain JavaScript, not only TypeScript
  });
});

describe("the CLI and the MCP server agree", () => {
  it("G13 every golden input gives the same code over MCP", () => {
    const cases = GOLDEN.filter((g) => g.transform !== "add-logging"); // the module label differs by design
    const results = mcp(cases.map((g) => ({ name: `transform_${g.transform.replace(/-/g, "_")}`, arguments: { code: g.input } })));
    cases.forEach((g, i) => {
      const text = (results[i] as { content: { text: string }[] }).content[0].text;
      expect((JSON.parse(text) as Result).code, g.id).toBe(cli(g.transform, g.input).code);
    });
  });

  it("G14 the MCP server lists the six transforms", () => {
    const [list] = mcp([{ name: "tools/list", arguments: {} }]);
    expect((list as { tools: { name: string }[] }).tools.map((t) => t.name)).toEqual([
      "transform_var_to_const",
      "transform_remove_console",
      "transform_add_logging",
      "transform_add_error_handling",
      "transform_format_imports",
      "transform_add_strict",
    ]);
  });
});

describe("one copy", () => {
  it("G16 each transform is defined once, in src/transforms.ts, and the CLI and the MCP server import it", async () => {
    const { transforms } = (await import(join(ROOT, "dist/transforms.js"))) as { transforms: Record<string, { name: string }> };
    const sources = readdirSync(join(ROOT, "src")).filter((f) => f.endsWith(".ts"));
    const read = (f: string) => readFileSync(join(ROOT, "src", f), "utf8");
    for (const fn of Object.values(transforms)) {
      expect(sources.filter((f) => new RegExp(`^\\s*(?:export\\s+)?function ${fn.name}\\(`, "m").test(read(f))), fn.name).toEqual(["transforms.ts"]);
    }
    for (const f of ["index.ts", "mcp-server.ts"]) expect(read(f), f).toContain('from "./transforms.js"');
  });
});

describe("routing", () => {
  it("G15 route --only runs only the named transforms and writes nothing on --dry-run", () => {
    const dir = mkdtempSync(join(tmpdir(), "booster-eval-"));
    const file = join(dir, "sample.js");
    const src = 'var a = 1;\nconsole.log(a);\nimport z from "./z.js";\nimport fs from "node:fs";\n';
    writeFileSync(file, src);
    const out = spawnSync("node", [CLI, "route", file, "--dry-run", "--json", "--only=remove-console"], { encoding: "utf8" });
    const plan = JSON.parse(out.stdout) as { mechanical: { transform: string }[]; code: string };
    expect(plan.mechanical.map((m) => m.transform)).toEqual(["remove-console"]);
    expect(plan.code).toBe(src);
  });
});
