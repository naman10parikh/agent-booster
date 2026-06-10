/**
 * Edit router — the orchestration loop at the heart of agent-booster.
 *
 * README, verbatim: "an orchestrating agent classifies an edit, routes the mechanical ones to
 * agent-booster, and reserves the LLM for edits that need real reasoning." This module IS that
 * router, implemented as a real multi-step dispatch flow:
 *
 *   1. INSPECT  — read the file and detect which mechanical edits apply (dry-run every transform).
 *   2. CLASSIFY — bucket findings into MECHANICAL (a deterministic transform can do it, $0) vs
 *                 LLM (needs AST/semantic reasoning: add-types, async-await — out of scope here).
 *   3. PLAN     — order the mechanical transforms into an execution plan.
 *   4. EXECUTE  — apply the planned transforms in sequence, accumulating the diff (or dry-run).
 *   5. REPORT   — emit a routing decision: what ran locally, what is escalated to an LLM, savings.
 *
 * This is the "route-the-boring-path" decision an orchestrator makes per edit, made concrete and
 * testable. It assigns each unit of work to the cheapest capable executor — the definition of a
 * dispatch loop.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  transforms,
  LLM_ONLY_TRANSFORMS,
  type TransformResult,
} from "./transforms.js";

/** One classified, planned edit. */
export interface RoutedEdit {
  transform: string;
  /** "mechanical" → handled here for $0; "llm" → must be escalated. */
  route: "mechanical" | "llm";
  /** Number of changes this transform would / did make. */
  changes: number;
  description: string;
  reason: string;
}

/** The full routing decision for a file (or stdin buffer). */
export interface RoutePlan {
  target: string;
  /** Edits that ran (or would run) locally as deterministic transforms. */
  mechanical: RoutedEdit[];
  /** Edits that require an LLM (escalated, not run here). */
  escalated: RoutedEdit[];
  /** Total mechanical changes applied across all transforms. */
  totalChanges: number;
  /** Estimated LLM calls avoided (one per mechanical transform that fired). */
  llmCallsSaved: number;
  /** Final code after applying the mechanical plan (unchanged if dry-run or no edits). */
  code: string;
  dryRun: boolean;
}

/**
 * Heuristic signals that an LLM-only edit is *wanted* for this file. Conservative: we only
 * flag escalation when the source clearly contains the pattern that the (unimplemented,
 * AST-level) transform would target. This is the "reserve the LLM for reasoning" branch.
 */
function detectLlmNeeds(code: string): RoutedEdit[] {
  const out: RoutedEdit[] = [];
  // async-await: `.then(` chains are a semantic rewrite, not a regex one.
  if (/\.then\s*\(/.test(code)) {
    out.push({
      transform: "async-await",
      route: "llm",
      changes: 0,
      description: "Convert .then() chains to async/await",
      reason:
        ".then() → async/await is a control-flow rewrite that needs AST analysis; escalate to LLM.",
    });
  }
  // add-types: untyped function params in a .ts file are an inference task.
  if (/function\s+\w+\s*\([^)]*\b[a-zA-Z_]\w*\s*(?:,|\))/.test(code)) {
    out.push({
      transform: "add-types",
      route: "llm",
      changes: 0,
      description: "Add basic TypeScript type annotations",
      reason:
        "Type inference for untyped params requires semantic analysis; escalate to LLM.",
    });
  }
  return out;
}

/**
 * Build and (optionally) execute a routing plan for a buffer of code.
 * `filename` is used by transforms that need a module label (e.g. add-logging).
 */
export function routeCode(
  code: string,
  filename: string,
  opts: { dryRun?: boolean; only?: string[] } = {},
): RoutePlan {
  const dryRun = opts.dryRun ?? false;

  // ── Step 1+2: INSPECT + CLASSIFY — dry-run every mechanical transform to see what applies.
  const planned: { name: string; result: TransformResult }[] = [];
  const candidates = opts.only?.length
    ? opts.only.filter((n) => n in transforms)
    : Object.keys(transforms);

  for (const name of candidates) {
    const result = transforms[name](code, filename);
    if (result.changes > 0) planned.push({ name, result });
  }

  // ── Step 3+4: PLAN + EXECUTE — apply mechanical transforms in sequence on the live buffer.
  let working = code;
  const mechanical: RoutedEdit[] = [];
  let totalChanges = 0;
  for (const { name } of planned) {
    // Re-run on the *accumulated* buffer so transforms compose correctly.
    const res = transforms[name](working, filename);
    if (res.changes > 0) {
      if (!dryRun) working = res.code;
      mechanical.push({
        transform: name,
        route: "mechanical",
        changes: res.changes,
        description: res.description,
        reason: `Deterministic regex transform handled this in-process for $0 (no LLM call).`,
      });
      totalChanges += res.changes;
    }
  }

  // ── Step 2 (LLM branch): detect edits that must be escalated to a model.
  const escalated = detectLlmNeeds(code).filter(
    (e) =>
      !opts.only?.length || (opts.only?.includes(e.transform) ?? false) ||
      (LLM_ONLY_TRANSFORMS as readonly string[]).includes(e.transform),
  );

  return {
    target: filename,
    mechanical,
    escalated,
    totalChanges,
    llmCallsSaved: mechanical.length,
    code: working,
    dryRun,
  };
}

/** Route a file on disk; writes the result unless dryRun. Returns the plan. */
export function routeFile(
  file: string,
  opts: { dryRun?: boolean; only?: string[] } = {},
): RoutePlan {
  const code = readFileSync(file, "utf8");
  const plan = routeCode(code, file, opts);
  if (!opts.dryRun && plan.totalChanges > 0) {
    writeFileSync(file, plan.code);
  }
  return plan;
}

/** Render a RoutePlan as a human-readable routing report. */
export function formatPlan(plan: RoutePlan): string {
  const out: string[] = [];
  out.push(
    `=== Edit routing for ${plan.target}${plan.dryRun ? " [DRY RUN]" : ""} ===`,
  );
  out.push("");
  if (plan.mechanical.length === 0 && plan.escalated.length === 0) {
    out.push("No applicable edits found. Nothing to route.");
    return out.join("\n");
  }
  if (plan.mechanical.length > 0) {
    out.push(`MECHANICAL → handled locally ($0, ${plan.totalChanges} changes):`);
    for (const e of plan.mechanical) {
      out.push(`  • ${e.transform.padEnd(20)} ${e.changes} change(s) — ${e.description}`);
    }
    out.push("");
  }
  if (plan.escalated.length > 0) {
    out.push(`LLM → escalate (reasoning required, ${plan.escalated.length}):`);
    for (const e of plan.escalated) {
      out.push(`  • ${e.transform.padEnd(20)} ${e.reason}`);
    }
    out.push("");
  }
  out.push(
    `Decision: ${plan.llmCallsSaved} mechanical edit-pass(es) ran for $0; ` +
      `${plan.escalated.length} edit(s) routed to an LLM.`,
  );
  return out.join("\n");
}
