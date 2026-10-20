#!/usr/bin/env node
/**
 * suggest-transforms: a PostToolUse hook for Edit, Write and MultiEdit.
 *
 * After an agent edits a JavaScript or TypeScript file, it counts the mechanical work left in it
 * (console calls, `var` declarations) and tells the agent which agent-booster transform fixes it
 * for free, with no model call. It never blocks and never edits the file. It is self-contained,
 * so it runs from a plugin checkout without a build.
 *
 * Input: the hook JSON on stdin. Output: {} or an additionalContext note.
 * Test: echo '{"tool_name":"Edit","tool_input":{"file_path":"src/x.ts"}}' | node hooks/suggest-transforms.cjs
 */
const fs = require("fs");

const CODE = /\.(m|c)?(j|t)sx?$/;
const CONSOLE = /^[ \t]*console\.(log|warn|error|debug|info|trace|dir|table|time|timeEnd|group|groupEnd)\(/gm;
const VAR = /\bvar\s+\w+\s*=/g;

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let note = "";
  try {
    const { tool_input: input } = JSON.parse(raw || "{}");
    const file = String(input?.file_path ?? "");
    if (CODE.test(file) && fs.existsSync(file)) {
      const src = fs.readFileSync(file, "utf8");
      const consoles = (src.match(CONSOLE) || []).length;
      const vars = (src.match(VAR) || []).length;
      const fixes = [];
      if (consoles) fixes.push(`${consoles} console call(s): \`agent-booster remove-console ${file}\``);
      if (vars) fixes.push(`${vars} var declaration(s): \`agent-booster var-to-const ${file}\``);
      if (fixes.length) {
        note = `agent-booster: ${file} still has ${fixes.join("; ")}. These edits are mechanical, so run the transform (add --dry-run to preview) instead of spending model tokens on them.`;
      }
    }
  } catch {
    note = ""; // a hook must never break the agent's turn
  }
  process.stdout.write(
    note ? JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: note } }) + "\n" : "{}\n",
  );
});
