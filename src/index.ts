#!/usr/bin/env node

/**
 * Agent Booster — Zero-LLM Code Transforms
 *
 * Handles simple code transformations without any API calls.
 * Inspired by Ruflo's Agent Booster WASM module.
 *
 * Transforms (defined once, in src/transforms.ts):
 *   var-to-const    — Convert var/let to const where safe
 *   add-logging     — Inject debug logging statements
 *   remove-console  — Strip console.log/warn/error
 *   add-error-handling — Wrap async functions in try/catch
 *   format-imports  — Sort and group imports
 *   add-strict      — Add 'use strict'
 * add-types and async-await need a model: the router only flags them (LLM_ONLY_TRANSFORMS).
 *
 * Usage:
 *   agent-booster var-to-const file.ts
 *   agent-booster remove-console src/
 *   cat file.ts | agent-booster format-imports --stdin
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { search, formatHits } from "./memory-search.js";
import { routeFile, formatPlan } from "./route.js";
import { recordRun, readRuns } from "./run-log.js";
// The one copy of the transforms, shared with the MCP server, the router and the sandbox runner.
import { transforms } from "./transforms.js";

// ─── File Processing ───

function getFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return [path];

  const files: string[] = [];
  const entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name.startsWith(".") ||
      entry.name === "node_modules" ||
      entry.name === "dist"
    )
      continue;
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// ─── CLI ───

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Agent Booster — Zero-LLM Code Transforms

Usage:
  agent-booster <transform> <file-or-dir>
  agent-booster <transform> --stdin
  agent-booster list

Transforms:
  var-to-const       Convert var/let to const where safe
  remove-console     Strip console.log/warn/error statements
  add-logging        Inject debug logging at function entries
  add-error-handling Wrap async functions in try/catch
  format-imports     Sort and group import statements
  add-strict         Add 'use strict' directive

Commands:
  route <file>           Classify edits → run mechanical ones for $0, escalate the rest to an LLM
                         (--only=t1,t2 limits it to the transforms you name)
  memory-search "<q>"    BM25 search over this repo's brain (MEMORY.md, memory/, brain/, docs/)
  sandbox-run <t> <f>    Run transform <t> over file <f> inside an isolated E2B sandbox
  log [N]                Show the last N runs from the observability trail (logs/runs.jsonl)
  list                   List available transforms

Options:
  --dry-run          Show changes without writing
  --stdin            Read from stdin
  --json             Output results as JSON

Examples:
  agent-booster var-to-const src/
  agent-booster remove-console src/utils.ts --dry-run
  agent-booster route src/utils.ts --dry-run --only=remove-console,format-imports
  agent-booster memory-search "zero-LLM regex transforms"
  cat file.ts | agent-booster format-imports --stdin
`);
    process.exit(0);
  }

  if (args[0] === "list") {
    console.log("Available transforms:");
    for (const [name] of Object.entries(transforms)) {
      console.log(`  ${name}`);
    }
    process.exit(0);
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log("agent-booster v1.0.0");
    process.exit(0);
  }

  // ─── Meta-commands (route / memory-search / log / sandbox-run) ───
  // These run BEFORE the transform-registry lookup so they don't collide with transform names.

  if (args[0] === "memory-search") {
    const start = Date.now();
    const query = args.slice(1).filter((a) => !a.startsWith("-")).join(" ");
    const jsonOut = args.includes("--json");
    const hits = search(query, 5);
    recordRun({
      ts: new Date().toISOString(),
      command: "memory-search",
      args: [query],
      durationMs: Date.now() - start,
      outcome: "ok",
      note: `${hits.length} hit(s)`,
    });
    console.log(jsonOut ? JSON.stringify(hits) : formatHits(query, hits));
    process.exit(0);
  }

  if (args[0] === "log") {
    const n = Number(args[1]) || 20;
    const runs = readRuns(n);
    if (args.includes("--json")) {
      console.log(JSON.stringify(runs));
    } else if (runs.length === 0) {
      console.log(
        "No runs logged yet — every agent-booster invocation appends one entry to logs/runs.jsonl.",
      );
    } else {
      console.log(`agent-booster run-log — last ${runs.length} run(s):`);
      for (const r of runs) {
        const detail =
          r.files !== undefined
            ? ` files=${r.files} changes=${r.changes ?? 0}`
            : r.note
              ? ` (${r.note})`
              : "";
        console.log(
          `  ${r.ts}  ${r.command.padEnd(16)} ${r.outcome.padEnd(5)} ${r.durationMs}ms${detail}`,
        );
      }
    }
    process.exit(0);
  }

  if (args[0] === "route") {
    const start = Date.now();
    const dryRun = args.includes("--dry-run");
    const jsonOut = args.includes("--json");
    const file = args
      .slice(1)
      .find((a) => !a.startsWith("-"));
    const onlyArg = args.find((a) => a.startsWith("--only="));
    const only = onlyArg ? onlyArg.slice("--only=".length).split(",").filter(Boolean) : undefined;
    if (!file) {
      console.error("route: no file specified. Usage: agent-booster route <file>");
      process.exit(1);
    }
    try {
      const plan = routeFile(file, { dryRun, ...(only ? { only } : {}) });
      recordRun({
        ts: new Date().toISOString(),
        command: "route",
        args: [file],
        durationMs: Date.now() - start,
        outcome: "ok",
        files: 1,
        changes: plan.totalChanges,
        note: `${plan.mechanical.length} mechanical, ${plan.escalated.length} escalated`,
      });
      console.log(jsonOut ? JSON.stringify(plan) : formatPlan(plan));
      process.exit(0);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      recordRun({
        ts: new Date().toISOString(),
        command: "route",
        args: [file],
        durationMs: Date.now() - start,
        outcome: "error",
        error: error.message,
      });
      console.error(`route: ${error.message}`);
      process.exit(1);
    }
  }

  if (args[0] === "sandbox-run") {
    void runSandbox(args.slice(1));
    return;
  }

  const transformName = args[0] as string;
  const transform = transforms[transformName];

  if (!transform) {
    console.error(`Unknown transform: ${transformName}`);
    console.error(`Available: ${Object.keys(transforms).join(", ")}`);
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run");
  const jsonOutput = args.includes("--json");
  const useStdin = args.includes("--stdin");

  if (useStdin) {
    let input = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      const result = transform(input, "stdin.ts");
      if (jsonOutput) {
        console.log(JSON.stringify(result));
      } else {
        process.stdout.write(result.code);
      }
    });
    return;
  }

  const target = args.find((a) => !a.startsWith("-") && a !== transformName);
  if (!target) {
    console.error("No file or directory specified");
    process.exit(1);
  }

  const runStart = Date.now();
  const files = getFiles(target);
  let totalChanges = 0;
  const results: Array<{ file: string; changes: number; description: string }> =
    [];

  for (const file of files) {
    const code = readFileSync(file, "utf-8");
    const result = transform(code, file);

    if (result.changes > 0) {
      totalChanges += result.changes;
      results.push({
        file,
        changes: result.changes,
        description: result.description,
      });

      if (!dryRun) {
        writeFileSync(file, result.code);
      }

      if (!jsonOutput) {
        const action = dryRun ? "would change" : "changed";
        console.log(
          `  ${file}: ${result.changes} ${action} (${result.description})`,
        );
      }
    }
  }

  // ─── Observability: append one audit record for this transform run. ───
  recordRun({
    ts: new Date().toISOString(),
    command: transformName,
    args: [target],
    durationMs: Date.now() - runStart,
    outcome: "ok",
    files: results.length,
    changes: totalChanges,
    note: dryRun ? "dry-run" : undefined,
  });

  if (jsonOutput) {
    console.log(
      JSON.stringify({
        transform: transformName,
        files: results,
        totalChanges,
        dryRun,
      }),
    );
  } else {
    console.log(
      `\n${dryRun ? "[DRY RUN] " : ""}${totalChanges} changes across ${results.length} files`,
    );
  }
}

/** sandbox-run command: dynamically import the E2B path so the SDK only loads when used. */
async function runSandbox(rest: string[]): Promise<void> {
  const start = Date.now();
  const positional = rest.filter((a) => !a.startsWith("-"));
  const [transformName, file] = positional;
  const jsonOut = rest.includes("--json");
  if (!transformName || !file) {
    console.error(
      "sandbox-run: usage: agent-booster sandbox-run <transform> <file>",
    );
    process.exit(1);
  }
  try {
    const { sandboxRun } = await import("./sandbox-run.js");
    const res = await sandboxRun(transformName, file);
    recordRun({
      ts: new Date().toISOString(),
      command: "sandbox-run",
      args: [transformName, file],
      durationMs: Date.now() - start,
      outcome: "ok",
      changes: res.changes,
      note: `sandbox=${res.sandboxId}`,
    });
    if (jsonOut) {
      console.log(JSON.stringify(res));
    } else {
      console.log(
        `sandbox-run: ${transformName} on ${file} inside E2B sandbox ${res.sandboxId} ` +
          `(${res.changes} change(s), ${res.durationMs}ms)\n`,
      );
      process.stdout.write(res.code);
    }
    process.exit(0);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    recordRun({
      ts: new Date().toISOString(),
      command: "sandbox-run",
      args: [transformName, file],
      durationMs: Date.now() - start,
      outcome: "error",
      error: error.message,
    });
    console.error(`sandbox-run failed: ${error.message}`);
    process.exit(1);
  }
}

main();
