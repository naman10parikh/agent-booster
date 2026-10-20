# skills/

Agent Booster's own skills, one folder per skill (`skills/<name>/SKILL.md`). The Claude Code plugin
loads this folder, and any agent that reads Agent Skills can install one skill from it.

| Skill | Use it when |
| --- | --- |
| [route-the-boring-path](route-the-boring-path/SKILL.md) | Before spending model tokens on an edit to a JavaScript or TypeScript file. |
| [sandbox-untrusted-transform](sandbox-untrusted-transform/SKILL.md) | The code to transform came from a pull request, another repository or a model. |
| [add-a-transform](add-a-transform/SKILL.md) | You are adding a new transform to Agent Booster itself. |

The skills under `.claude/skills/` are a general maintainer toolkit shared across the fleet; the
three above are written for Agent Booster's job. See the hub
[`brain/MOC - agent-booster.md`](../brain/MOC%20-%20agent-booster.md).
