#!/usr/bin/env node

/**
 * agent-booster MCP server shim
 *
 * Exposes the six deterministic code-transform tools via the Model Context Protocol
 * (MCP) stdio transport (JSON-RPC 2.0).  Zero external dependencies — the full MCP
 * SDK is NOT required here; we speak the wire protocol directly.
 *
 * Exposed tools (one per transform):
 *   transform_var_to_const       — var/let → const where safe
 *   transform_remove_console     — strip console.* statements
 *   transform_add_logging        — inject console.debug at function entries
 *   transform_add_error_handling — wrap async fns in try/catch
 *   transform_format_imports     — sort + group import statements
 *   transform_add_strict         — prepend "use strict"
 *
 * Usage (add to .mcp.json):
 *   {
 *     "agent-booster": {
 *       "command": "node",
 *       "args": ["./dist/mcp-server.js"]
 *     }
 *   }
 *
 * Or run directly:
 *   node dist/mcp-server.js
 */

// ─── Transform implementations (identical to src/index.ts) ───────────────────
// Kept inline so this file is self-contained and the shim can run standalone.

interface TransformResult {
  code: string;
  changes: number;
  description: string;
}

function varToConst(code: string): TransformResult {
  let changes = 0;
  let result = code.replace(/\bvar\s+(\w+)\s*=/g, (_match, name: string) => {
    const reassignPattern = new RegExp(`\\b${name}\\s*=[^=]`, "g");
    const matches = code.match(reassignPattern);
    if (matches && matches.length <= 1) {
      changes++;
      return `const ${name} =`;
    }
    return _match;
  });
  result = result.replace(/\blet\s+(\w+)\s*=/g, (_match, name: string) => {
    const reassignPattern = new RegExp(
      `(?<!(?:const|let|var)\\s*)\\b${name}\\s*=[^=]`,
      "g",
    );
    const fullMatches = result.match(reassignPattern);
    if (!fullMatches || fullMatches.length === 0) {
      changes++;
      return `const ${name} =`;
    }
    return _match;
  });
  return { code: result, changes, description: "var/let → const" };
}

function removeConsole(code: string): TransformResult {
  let changes = 0;
  const result = code.replace(
    /^\s*console\.(log|warn|error|debug|info|trace|dir|table|time|timeEnd|group|groupEnd)\([\s\S]*?\);\s*\n?/gm,
    () => { changes++; return ""; },
  );
  return { code: result, changes, description: "Removed console statements" };
}

function addLogging(code: string, filename: string): TransformResult {
  let changes = 0;
  const module = filename.replace(/\.[^.]+$/, "");
  const result = code.replace(
    /^(\s*)((?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)/gm,
    (_match, indent: string, declaration: string, funcName: string) => {
      changes++;
      return `${indent}${declaration}\n${indent}  console.debug("[${module}] ${funcName}() called");`;
    },
  );
  return { code: result, changes, description: "Added debug logging" };
}

function addErrorHandling(code: string): TransformResult {
  let changes = 0;
  const result = code.replace(
    /^(\s*)((?:export\s+)?async\s+function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)\n([\s\S]*?)^(\s*\})/gm,
    (_match, indent: string, declaration: string, funcName: string, body: string, closingBrace: string) => {
      if (body.includes("try {") || body.includes("try{")) return _match;
      changes++;
      const innerIndent = indent + "  ";
      const wrappedBody = body
        .split("\n")
        .map((line: string) => (line.trim() ? innerIndent + line.trim() : ""))
        .join("\n");
      return `${indent}${declaration}
${innerIndent}try {
${wrappedBody}
${innerIndent}} catch (err: unknown) {
${innerIndent}  const error = err instanceof Error ? err : new Error(String(err));
${innerIndent}  console.error("[${funcName}]", error.message);
${innerIndent}  throw error;
${innerIndent}}
${closingBrace}`;
    },
  );
  return { code: result, changes, description: "Added error handling" };
}

function formatImports(code: string): TransformResult {
  let changes = 0;
  const lines = code.split("\n");
  const importLines: string[] = [];
  const otherLines: string[] = [];
  let pastImports = false;
  for (const line of lines) {
    if (!pastImports && /^\s*import\s/.test(line)) {
      importLines.push(line);
    } else {
      if (importLines.length > 0 && !pastImports && line.trim() === "") continue;
      if (importLines.length > 0 && line.trim() !== "" && !pastImports) pastImports = true;
      otherLines.push(line);
    }
  }
  if (importLines.length < 2) return { code, changes: 0, description: "No import sorting needed" };
  const nodeImports: string[] = [];
  const externalImports: string[] = [];
  const relativeImports: string[] = [];
  for (const imp of importLines) {
    if (/from\s+["']node:/.test(imp) || /from\s+["'](?:fs|path|os|url|http|https|crypto|stream|events|child_process|util|assert|buffer|net|tls|dns|cluster|worker_threads)["']/.test(imp)) {
      nodeImports.push(imp);
    } else if (/from\s+["']\./.test(imp)) {
      relativeImports.push(imp);
    } else {
      externalImports.push(imp);
    }
  }
  nodeImports.sort(); externalImports.sort(); relativeImports.sort();
  const sorted: string[] = [];
  if (nodeImports.length > 0)    { sorted.push(...nodeImports, "");    changes++; }
  if (externalImports.length > 0) { sorted.push(...externalImports, ""); changes++; }
  if (relativeImports.length > 0) { sorted.push(...relativeImports, ""); changes++; }
  const result = [...sorted, ...otherLines].join("\n");
  return { code: result, changes, description: "Sorted and grouped imports" };
}

function addStrict(code: string): TransformResult {
  if (code.startsWith('"use strict"') || code.startsWith("'use strict'"))
    return { code, changes: 0, description: "Already has 'use strict'" };
  return { code: `"use strict";\n\n${code}`, changes: 1, description: "Added 'use strict'" };
}

// ─── Tool registry ────────────────────────────────────────────────────────────

const TOOLS: Record<string, {
  description: string;
  inputSchema: object;
  run: (args: Record<string, unknown>) => TransformResult;
}> = {
  transform_var_to_const: {
    description:
      "Convert var/let declarations to const where the variable is never reassigned. " +
      "Heuristic (regex-based), conservative — skips any binding that looks reassigned.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code to transform." },
      },
      required: ["code"],
    },
    run: (args) => varToConst(String(args.code)),
  },
  transform_remove_console: {
    description:
      "Strip console.log / console.warn / console.error (and other console.* methods) " +
      "from the source code.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code to transform." },
      },
      required: ["code"],
    },
    run: (args) => removeConsole(String(args.code)),
  },
  transform_add_logging: {
    description:
      "Inject a console.debug('[module] fn() called') statement at the entry of each " +
      "top-level or exported function. Provide a filename hint for the module label.",
    inputSchema: {
      type: "object",
      properties: {
        code:     { type: "string", description: "Source code to transform." },
        filename: { type: "string", description: "Filename hint for the [module] label (e.g. 'utils.ts').", default: "module.ts" },
      },
      required: ["code"],
    },
    run: (args) => addLogging(String(args.code), String(args.filename ?? "module.ts")),
  },
  transform_add_error_handling: {
    description:
      "Wrap async functions that lack a try/catch in a try/catch block that logs the " +
      "error and re-throws it.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code to transform." },
      },
      required: ["code"],
    },
    run: (args) => addErrorHandling(String(args.code)),
  },
  transform_format_imports: {
    description:
      "Sort and group import statements: Node built-ins first, then external packages, " +
      "then relative imports. Each group is separated by a blank line.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code to transform." },
      },
      required: ["code"],
    },
    run: (args) => formatImports(String(args.code)),
  },
  transform_add_strict: {
    description:
      'Prepend a "use strict"; directive to JavaScript source. No-op on code that ' +
      "already has the directive.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Source code to transform." },
      },
      required: ["code"],
    },
    run: (args) => addStrict(String(args.code)),
  },
};

// ─── MCP JSON-RPC 2.0 stdio transport ────────────────────────────────────────

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

function send(msg: object): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function reply(id: JsonRpcId, result: unknown): void {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id: JsonRpcId, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handleRequest(req: JsonRpcRequest): void {
  const id = req.id ?? null;

  switch (req.method) {
    // MCP initialize handshake
    case "initialize": {
      reply(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "agent-booster", version: "1.0.0" },
      });
      break;
    }

    // Notification — no response needed
    case "notifications/initialized":
      break;

    // List available tools
    case "tools/list": {
      reply(id, {
        tools: Object.entries(TOOLS).map(([name, t]) => ({
          name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      break;
    }

    // Invoke a tool
    case "tools/call": {
      const params = req.params as { name?: string; arguments?: Record<string, unknown> };
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};

      if (!toolName || !(toolName in TOOLS)) {
        replyError(id, -32602, `Unknown tool: ${String(toolName)}`);
        break;
      }

      try {
        const result = TOOLS[toolName].run(toolArgs);
        reply(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        replyError(id, -32000, `Transform error: ${msg}`);
      }
      break;
    }

    default:
      if (id !== null && id !== undefined) {
        replyError(id, -32601, `Method not found: ${req.method}`);
      }
  }
}

// Read newline-delimited JSON from stdin
let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";       // keep partial last line in buffer
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      handleRequest(req);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
  }
});
process.stdin.on("end", () => {
  process.exit(0);
});
