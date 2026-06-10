---
name: sandbox-untrusted-transform
description: >-
  Run an agent-booster transform over UNTRUSTED source (a file pulled from a PR, an
  external repo, or a model-generated buffer) inside an isolated E2B Firecracker microVM
  instead of against the host filesystem. Use whenever the code to be transformed did not
  originate from the trusted working tree, or when a task says "transform this in a
  sandbox / isolation / safely".
---

# Skill: Sandbox an Untrusted Transform

agent-booster's transforms run regexes over arbitrary source files. Regex execution over
attacker-controlled bytes on the host is low-risk but not zero-risk, and an orchestrating
agent often needs to transform code it does not trust (a PR diff, a scraped file, an LLM
output). This skill runs the transform *inside* an E2B sandbox so the host never executes
against the untrusted bytes.

## Trigger

- The source to transform came from outside the trusted tree (PR, external clone, web,
  model output).
- A task explicitly asks for "sandboxed", "isolated", or "safe" transformation.
- You want a clean, disposable environment for a one-off transform run.

For trusted, in-repo files the plain `route` / transform commands are fine — sandboxing
adds latency (a microVM boot) and is unnecessary there.

## Steps

1. **Confirm the E2B key is present.** `sandbox-run` requires `E2B_API_KEY` in the
   environment (this repo ships it in `.env`; never commit it). Without it the command
   fails fast with an actionable message rather than pretending to isolate.

2. **Run the transform in the sandbox:**
   ```bash
   node dist/index.js sandbox-run <transform> <file>
   # JSON form for an orchestrator:
   node dist/index.js sandbox-run <transform> <file> --json
   ```
   This boots a fresh E2B microVM, writes the untrusted source + a tiny transform driver
   *into* it, runs the transform inside the VM, reads the transformed code back out, and
   tears the sandbox down (`Sandbox.create → files.write → commands.run → kill`).

3. **Read the result.** Output includes the `sandboxId` (proof of a real boot), the
   transformed `code`, `changes`, and `durationMs`. The run is appended to
   `logs/runs.jsonl` with `note=sandbox=<id>`.

4. **Apply or discard.** The host only ever sees the *result* string — decide whether to
   write it into your tree. The untrusted input never ran on the host.

## Output

Report the isolation explicitly, e.g.:

```
sandbox-run remove-console on /tmp/pr-file.ts inside E2B sandbox iabc123…
  3 change(s), 812ms — host FS never executed the untrusted bytes.
```

## Implementation

See `src/sandbox-run.ts`. The real integration point is `Sandbox.create("base", {...})`
— not a dead import. Reference pattern:
`energy/packages/runtime/src/sandbox/container-runner.ts`.

## Anti-patterns

- Sandboxing trusted in-repo files (wastes a microVM boot — use `route` instead).
- Committing `E2B_API_KEY`.
- Claiming isolation while running the transform on the host (the whole point is the VM).
