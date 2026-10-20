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

// ─── Transforms: the one copy, shared with the CLI, the router and the sandbox runner ───
import {
  varToConst,
  removeConsole,
  addLogging,
  addErrorHandling,
  formatImports,
  addStrict,
  type TransformResult,
} from "./transforms.js";

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
