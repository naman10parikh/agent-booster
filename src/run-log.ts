/**
 * Observability spine — append-only JSONL run-log for every agent-booster invocation.
 *
 * The harness audit's "Observability" component requires a runtime append-only audit
 * trail the product WRITES on each invocation: which transform ran, over how many
 * files, how many changes, the wall-clock duration, and whether it succeeded. This is
 * that trail. It is best-effort: a logging failure must NEVER break the CLI, so every
 * write is wrapped and swallowed.
 *
 * Ported from the helios `pipeline/run-log.ts` pattern (energy/agents/earning/helios).
 */

import {
  appendFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Default audit trail location: `<repo>/logs/runs.jsonl` (gitignored runtime state). */
export const RUN_LOG_PATH = join(HERE, "..", "logs", "runs.jsonl");

/** One append-only audit record per agent-booster invocation. */
export interface RunLogEntry {
  /** ISO-8601 timestamp of when the run finished. */
  ts: string;
  /** CLI subcommand or transform name (e.g. "remove-console", "route", "sandbox-run"). */
  command: string;
  /** Remaining argv tokens passed after the command. */
  args: string[];
  /** Wall-clock duration of the invocation, milliseconds. */
  durationMs: number;
  /** Whether the invocation completed cleanly or threw. */
  outcome: "ok" | "error";
  /** Number of files touched (transform runs over a path); 0 for stdin / meta commands. */
  files?: number;
  /** Total change count the transform reported (0 if none / not applicable). */
  changes?: number;
  /** Error message when outcome === "error". */
  error?: string;
  /** Optional one-line summary the command can attach. */
  note?: string;
}

/** Append one run entry to the JSONL audit trail. Best-effort — never throws. */
export function recordRun(
  entry: RunLogEntry,
  logPath: string = RUN_LOG_PATH,
): void {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch {
    // Observability is best-effort; a log-write failure must not break the CLI.
  }
}

/** Read the most-recent run entries (oldest→newest), capped at `limit`. */
export function readRuns(
  limit = 20,
  logPath: string = RUN_LOG_PATH,
): RunLogEntry[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as RunLogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is RunLogEntry => e !== null)
    .slice(-limit);
}

/**
 * Helper to time a unit of work and record exactly one run entry for it.
 * Returns the work's result; records `outcome:"error"` and re-throws on failure.
 */
export function withRunLog<T>(
  command: string,
  args: string[],
  fn: () => T,
  meta: (result: T) => Pick<RunLogEntry, "files" | "changes" | "note"> = () => ({}),
  logPath: string = RUN_LOG_PATH,
): T {
  const start = Date.now();
  try {
    const result = fn();
    recordRun(
      {
        ts: new Date().toISOString(),
        command,
        args,
        durationMs: Date.now() - start,
        outcome: "ok",
        ...meta(result),
      },
      logPath,
    );
    return result;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    recordRun(
      {
        ts: new Date().toISOString(),
        command,
        args,
        durationMs: Date.now() - start,
        outcome: "error",
        error: error.message,
      },
      logPath,
    );
    throw error;
  }
}
