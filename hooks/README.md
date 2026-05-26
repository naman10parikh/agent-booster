# hooks/

Repo-local lifecycle hooks for `agent-booster` (scaffold — not yet populated).

The **active** Claude Code hooks live in [`.claude/hooks/`](../.claude/hooks/) (session-start
context injection, pre-compact memory flush, stop-verify, quality-check, etc.). This top-level
`hooks/` directory is reserved for product-level hooks specific to the CLI, should the tool grow
its own plugin/lifecycle surface.

See the harness component map in [CLAUDE.md](../CLAUDE.md) and the hub
[`brain/MOC - agent-booster.md`](../brain/MOC%20-%20agent-booster.md).
