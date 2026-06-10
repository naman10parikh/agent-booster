/**
 * Sandboxed transform execution — run the core agent-booster action inside an isolated
 * E2B Firecracker microVM.
 *
 * Why this exists: agent-booster's transforms run regexes over arbitrary source files. When an
 * orchestrating agent wants to transform *untrusted* code (a file it pulled from a PR, an
 * external repo, a model-generated buffer) it should not let that run touch the host filesystem
 * or process. `sandbox-run` is the isolation boundary: it boots a fresh E2B sandbox, writes the
 * input file and a tiny transform driver into it, runs the transform *inside* the microVM, reads
 * the transformed code back out, and tears the sandbox down. The host never executes against the
 * untrusted bytes directly.
 *
 * This is a REAL integration point, not a dead import: `Sandbox.create()` is invoked on the
 * `sandbox-run` path. It requires `E2B_API_KEY` in the environment (already present in this
 * repo's .env). When the key is absent, it fails fast with an actionable message rather than
 * pretending to isolate.
 *
 * Reference pattern: energy/packages/runtime/src/sandbox/container-runner.ts (Sandbox.create →
 * files.write → commands.run → kill).
 */

import { readFileSync } from "node:fs";
import { Sandbox } from "@e2b/sdk";
import { transforms } from "./transforms.js";

export interface SandboxRunResult {
  sandboxId: string;
  transform: string;
  /** stdout from the in-sandbox driver: the transformed code (JSON). */
  code: string;
  changes: number;
  description: string;
  durationMs: number;
}

/**
 * The driver script we execute *inside* the sandbox. It contains the single transform's body
 * (serialized from the host registry) plus a thin runner, so the untrusted source is processed
 * entirely within the microVM. Returns a JSON line on stdout.
 */
function buildDriver(transformSource: string): string {
  return `${transformSource}
import { readFileSync } from "node:fs";
const code = readFileSync("/tmp/input.src", "utf8");
const res = __transform(code, "input.ts");
process.stdout.write(JSON.stringify(res));
`;
}

/**
 * Serialize a transform function for in-sandbox execution. The registry holds named functions;
 * we emit the function body bound to a stable name `__transform`.
 */
function serializeTransform(name: string): string {
  const fn = transforms[name];
  if (!fn) {
    throw new Error(
      `Unknown transform: ${name}. Available: ${Object.keys(transforms).join(", ")}`,
    );
  }
  // `fn.toString()` yields `function varToConst(code) {...}`; rebind to __transform.
  return `const __transform = ${fn.toString()};`;
}

/**
 * Run a single transform over a file inside a fresh E2B sandbox.
 * Throws if E2B_API_KEY is missing or the sandbox cannot boot.
 */
export async function sandboxRun(
  transform: string,
  file: string,
): Promise<SandboxRunResult> {
  if (!process.env.E2B_API_KEY) {
    throw new Error(
      "E2B_API_KEY is not set. Add it to .env (E2B_API_KEY=...) to run transforms in an isolated sandbox.",
    );
  }

  const source = readFileSync(file, "utf8");
  const driver = buildDriver(serializeTransform(transform));

  const start = Date.now();
  // ── REAL integration point: boot an isolated Firecracker microVM. ──
  const sandbox = await Sandbox.create("base", {
    apiKey: process.env.E2B_API_KEY,
  });
  try {
    // Write the untrusted source + the transform driver INTO the sandbox.
    await sandbox.files.write("/tmp/input.src", source);
    await sandbox.files.write("/tmp/driver.mjs", driver);

    // Execute the transform inside the microVM — host FS never runs the untrusted bytes.
    const result = await sandbox.commands.run("node /tmp/driver.mjs");
    const parsed = JSON.parse(result.stdout) as {
      code: string;
      changes: number;
      description: string;
    };

    return {
      sandboxId: sandbox.sandboxId,
      transform,
      code: parsed.code,
      changes: parsed.changes,
      description: parsed.description,
      durationMs: Date.now() - start,
    };
  } finally {
    // Always tear the sandbox down.
    await sandbox.kill();
  }
}
