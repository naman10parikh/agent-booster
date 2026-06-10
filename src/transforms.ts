/**
 * Shared transform registry — the canonical, importable form of the six zero-LLM
 * transforms. `src/index.ts` keeps its own self-contained copies (so the published
 * single-file CLI stays dependency-free); this module re-exports the same transform
 * functions for the routing loop (`route.ts`) and the sandbox runner (`sandbox-run.ts`)
 * to consume programmatically without shelling out to the CLI.
 *
 * The transform bodies here are identical in behaviour to those in `src/index.ts`.
 */

export interface TransformResult {
  code: string;
  changes: number;
  description: string;
}

export type TransformFn = (code: string, filename: string) => TransformResult;

export function varToConst(code: string): TransformResult {
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

export function removeConsole(code: string): TransformResult {
  let changes = 0;
  const result = code.replace(
    /^\s*console\.(log|warn|error|debug|info|trace|dir|table|time|timeEnd|group|groupEnd)\([\s\S]*?\);\s*\n?/gm,
    () => {
      changes++;
      return "";
    },
  );
  return { code: result, changes, description: "Removed console statements" };
}

export function addLogging(code: string, filename: string): TransformResult {
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

export function addErrorHandling(code: string): TransformResult {
  let changes = 0;
  const result = code.replace(
    /^(\s*)((?:export\s+)?async\s+function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)\n([\s\S]*?)^(\s*\})/gm,
    (
      _match,
      indent: string,
      declaration: string,
      funcName: string,
      body: string,
      closingBrace: string,
    ) => {
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

export function formatImports(code: string): TransformResult {
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
      if (importLines.length > 0 && line.trim() !== "" && !pastImports)
        pastImports = true;
      otherLines.push(line);
    }
  }
  if (importLines.length < 2)
    return { code, changes: 0, description: "No import sorting needed" };
  const nodeImports: string[] = [];
  const externalImports: string[] = [];
  const relativeImports: string[] = [];
  for (const imp of importLines) {
    if (
      /from\s+["']node:/.test(imp) ||
      /from\s+["'](?:fs|path|os|url|http|https|crypto|stream|events|child_process|util|assert|buffer|net|tls|dns|cluster|worker_threads)["']/.test(
        imp,
      )
    ) {
      nodeImports.push(imp);
    } else if (/from\s+["']\./.test(imp)) {
      relativeImports.push(imp);
    } else {
      externalImports.push(imp);
    }
  }
  nodeImports.sort();
  externalImports.sort();
  relativeImports.sort();
  const sorted: string[] = [];
  if (nodeImports.length > 0) {
    sorted.push(...nodeImports, "");
    changes++;
  }
  if (externalImports.length > 0) {
    sorted.push(...externalImports, "");
    changes++;
  }
  if (relativeImports.length > 0) {
    sorted.push(...relativeImports, "");
    changes++;
  }
  const result = [...sorted, ...otherLines].join("\n");
  return { code: result, changes, description: "Sorted and grouped imports" };
}

export function addStrict(code: string): TransformResult {
  if (code.startsWith('"use strict"') || code.startsWith("'use strict'"))
    return { code, changes: 0, description: "Already has 'use strict'" };
  return {
    code: `"use strict";\n\n${code}`,
    changes: 1,
    description: "Added 'use strict'",
  };
}

/** The canonical registry of zero-LLM transforms, keyed by CLI name. */
export const transforms: Record<string, TransformFn> = {
  "var-to-const": varToConst,
  "remove-console": removeConsole,
  "add-logging": addLogging,
  "add-error-handling": addErrorHandling,
  "format-imports": formatImports,
  "add-strict": addStrict,
};

/** Transforms that genuinely need AST analysis — NOT in the registry; route to an LLM. */
export const LLM_ONLY_TRANSFORMS = ["add-types", "async-await"] as const;
