import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CLI = join(__dirname, "../../dist/index.js");

function boost(transform: string, code: string): string {
  return execSync(
    `echo '${code.replace(/'/g, "'\\''")}' | node ${CLI} ${transform} --stdin --json`,
    {
      encoding: "utf-8",
    },
  );
}

describe("Agent Booster Transforms", () => {
  describe("var-to-const", () => {
    it("converts var to const when not reassigned", () => {
      const result = JSON.parse(boost("var-to-const", "var x = 5;"));
      expect(result.changes).toBeGreaterThan(0);
      expect(result.code).toContain("const x = 5;");
    });

    it("preserves var when reassigned", () => {
      const result = JSON.parse(boost("var-to-const", "var x = 5;\nx = 10;"));
      expect(result.code).toContain("var x = 5;");
    });
  });

  describe("remove-console", () => {
    it("removes console.log statements", () => {
      const result = JSON.parse(
        boost("remove-console", "console.log('hello');\nconst x = 5;"),
      );
      expect(result.changes).toBe(1);
      expect(result.code).not.toContain("console.log");
      expect(result.code).toContain("const x = 5;");
    });

    it("removes console.error and console.warn", () => {
      const code = "console.error('err');\nconsole.warn('warn');\nreturn true;";
      const result = JSON.parse(boost("remove-console", code));
      expect(result.changes).toBe(2);
    });
  });

  describe("format-imports", () => {
    it("groups node, external, and relative imports", () => {
      const code = `import { join } from "node:path";
import React from "react";
import { foo } from "./utils";
import { readFileSync } from "node:fs";`;
      const result = JSON.parse(boost("format-imports", code));
      expect(result.changes).toBeGreaterThan(0);
      // Node imports should come first
      const lines = result.code.split("\n");
      const firstNodeImport = lines.findIndex((l: string) =>
        l.includes("node:"),
      );
      const reactImport = lines.findIndex((l: string) => l.includes("react"));
      expect(firstNodeImport).toBeLessThan(reactImport);
    });
  });

  describe("CLI", () => {
    it("lists available transforms", () => {
      const output = execSync(`node ${CLI} list`, { encoding: "utf-8" });
      expect(output).toContain("var-to-const");
      expect(output).toContain("remove-console");
      expect(output).toContain("format-imports");
    });

    it("shows help with --help flag", () => {
      const output = execSync(`node ${CLI} --help`, { encoding: "utf-8" });
      expect(output).toContain("Agent Booster");
      expect(output).toContain("Zero-LLM");
    });
  });
});
