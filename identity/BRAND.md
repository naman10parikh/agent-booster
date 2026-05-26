# agent-booster — BRAND

## Name rationale

**agent-booster** — a "booster" gives an agent a cheap, instant speed-up on the mechanical parts of
its work, so its expensive reasoning (the LLM) is reserved for what actually needs thinking. The
name nods to Ruflo's Agent Booster module that inspired it; this is a pure-TypeScript/regex
reimplementation.

## Tagline

> Zero-LLM code transforms — deterministic, `$0` cost, no API calls.

## Symbolic connection to the workflow

The tool sits on the "boring path" of an agent's edit loop: classify → if mechanical, boost (regex
transform) → else escalate to the LLM. The booster is the fast lane.

## Colors / aesthetic

CLI-first; output is plain, readable text with a per-file change count. No web UI today. If a
landing page is built, follow the Energy design system (warm black `#141312`, serif display +
sans body) — see [`.claude/rules/design.md`](../.claude/rules/design.md).

## Landing copy (draft)

> **agent-booster** — Stop paying an LLM to strip a `console.log`.
> Mechanical edits — dead-code removal, import sorting, `var`→`const`, async `try/catch` — done by
> deterministic regex transforms. Free, offline, reproducible, reviewable. Save your token budget
> for the edits that actually need a brain.

See the full feature/limit story in [README.md](../README.md) and identity in
[SOUL.md](./SOUL.md).
