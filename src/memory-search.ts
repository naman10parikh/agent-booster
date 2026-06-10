/**
 * Memory search — a real, queryable BM25 index over THIS repo's own corpus.
 *
 * The harness "Memory" component requires more than a flat key-value store or a `grep`:
 * it needs a genuine ranked retrieval index over the agent's durable knowledge. This module
 * builds an in-memory BM25 (Okapi BM25) index at query time over the markdown corpus that
 * makes up agent-booster's brain — `MEMORY.md`, `memory/`, `brain/`, and `docs/` — and returns
 * the top-N most relevant passages with a real relevance score.
 *
 * It is a code port of the scoring idea in `scripts/memory-search.sh` (term-frequency x source
 * weight) upgraded to true BM25 (length-normalized TF-IDF), so the same retrieval is available
 * to the product as a first-class CLI command: `agent-booster memory-search "<query>"`.
 *
 * Zero runtime dependencies — Node builtins only, consistent with the rest of the CLI.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo root = parent of the compiled `dist/` (or `src/` in source layout). */
const REPO_ROOT = join(HERE, "..");

/** Directories + files that make up this repo's durable knowledge corpus. */
const CORPUS_ROOTS = ["MEMORY.md", "memory", "brain", "docs"];

/** A single retrievable passage (one markdown paragraph / heading block). */
export interface Passage {
  /** Repo-relative source file. */
  file: string;
  /** 1-based line where the passage begins. */
  line: number;
  /** The passage text. */
  text: string;
}

/** A scored search hit. */
export interface SearchHit extends Passage {
  /** BM25 relevance score (higher = more relevant). */
  score: number;
}

/** Lowercase, split on non-word chars, drop empties + 1-char tokens. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1);
}

/** Recursively collect markdown files under a path, skipping noise dirs. */
function collectMarkdown(path: string, out: string[]): void {
  if (!existsSync(path)) return;
  const st = statSync(path);
  if (st.isFile()) {
    if (extname(path) === ".md") out.push(path);
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".git" ||
      entry.name === ".obsidian" ||
      entry.name === "archive" // compressed >30d entries are low-signal noise
    )
      continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) collectMarkdown(full, out);
    else if (extname(entry.name) === ".md") out.push(full);
  }
}

/**
 * Split a markdown file into passages: blank-line-delimited blocks (paragraphs,
 * list groups, headings). Each block keeps its starting line number.
 */
export function splitPassages(content: string, file: string): Passage[] {
  const passages: Passage[] = [];
  const lines = content.split("\n");
  let buf: string[] = [];
  let blockStart = 0;

  const flush = (endLineIdx: number): void => {
    const text = buf.join("\n").trim();
    if (text.length > 0) {
      passages.push({ file, line: blockStart + 1, text });
    }
    buf = [];
    blockStart = endLineIdx + 1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      flush(i);
    } else {
      if (buf.length === 0) blockStart = i;
      buf.push(line);
    }
  }
  flush(lines.length);
  return passages;
}

/** Load every corpus passage from the repo (built fresh per query — corpus is small). */
export function loadCorpus(root: string = REPO_ROOT): Passage[] {
  const files: string[] = [];
  for (const r of CORPUS_ROOTS) collectMarkdown(join(root, r), files);
  const passages: Passage[] = [];
  for (const f of files) {
    let content: string;
    try {
      content = readFileSync(f, "utf8");
    } catch {
      continue; // unreadable file — skip, never crash the index
    }
    const rel = relative(root, f);
    for (const p of splitPassages(content, rel)) passages.push(p);
  }
  return passages;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/**
 * Rank corpus passages against a query using Okapi BM25.
 * Returns the top `limit` hits, score-descending.
 */
export function search(
  query: string,
  limit = 5,
  corpus: Passage[] = loadCorpus(),
): SearchHit[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || corpus.length === 0) return [];

  // Pre-tokenize every passage once.
  const docs = corpus.map((p) => ({ passage: p, terms: tokenize(p.text) }));
  const N = docs.length;
  const avgdl = docs.reduce((sum, d) => sum + d.terms.length, 0) / N || 1;

  // Document frequency per query term.
  const df = new Map<string, number>();
  for (const term of new Set(queryTerms)) {
    let count = 0;
    for (const d of docs) if (d.terms.includes(term)) count++;
    df.set(term, count);
  }

  const hits: SearchHit[] = [];
  for (const d of docs) {
    const dl = d.terms.length;
    if (dl === 0) continue;
    // Term-frequency table for this doc.
    const tf = new Map<string, number>();
    for (const t of d.terms) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term);
      if (!f) continue;
      const n = df.get(term) ?? 0;
      // BM25 IDF with +1 smoothing (always positive).
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgdl);
      score += idf * ((f * (BM25_K1 + 1)) / denom);
    }
    if (score > 0) {
      hits.push({ ...d.passage, score: Math.round(score * 1000) / 1000 });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Render hits as a human-readable report (used by the CLI). */
export function formatHits(query: string, hits: SearchHit[]): string {
  if (hits.length === 0) return `No memory results for: "${query}"`;
  const out: string[] = [`=== Memory search: "${query}" (BM25) ===`, ""];
  hits.forEach((h, i) => {
    const snippet = h.text.length > 280 ? h.text.slice(0, 277) + "…" : h.text;
    out.push(`[${i + 1}] ${h.file}:${h.line}  (score ${h.score})`);
    out.push(
      snippet
        .split("\n")
        .map((l) => "    " + l)
        .join("\n"),
    );
    out.push("");
  });
  return out.join("\n");
}
