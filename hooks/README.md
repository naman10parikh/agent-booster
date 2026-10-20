# hooks/

The Claude Code plugin's hooks. [`hooks.json`](hooks.json) wires one `PostToolUse` hook,
[`suggest-transforms.cjs`](suggest-transforms.cjs): after an agent edits a JavaScript or TypeScript
file, it counts the console calls and `var` declarations left in it and names the free
`agent-booster` transform that fixes them. It never blocks and never edits the file. The same hook
runs for maintainers through `.claude/settings.json`, beside the general safety hooks in
`.claude/hooks/`.

Test it: `echo '{"tool_name":"Edit","tool_input":{"file_path":"src/index.ts"}}' | node hooks/suggest-transforms.cjs`
prints `{}` for a clean file, or a note naming the transforms to run.
