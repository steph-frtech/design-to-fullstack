# Skills

Claude Code skills used by this project. Each subdirectory is one skill with a `SKILL.md` file at its root (Markdown with YAML frontmatter).

## Layout

```
skills/
  <skill-name>/
    SKILL.md          # required — frontmatter + instructions
    scripts/          # optional — helper scripts the skill invokes
    templates/        # optional — file templates the skill writes
```

## Frontmatter

`SKILL.md` must start with:

```yaml
---
name: kebab-case-skill-name
description: One-line trigger description — when should Claude use this skill?
---
```

## Loading

Skills here are not auto-discovered by Claude Code. Symlink or copy them into `.claude/skills/` to make them available:

```bash
ln -s ../../skills/<name> .claude/skills/<name>
```

(Or wire them up in `.claude/stack.json` if you use `claude-code-up`.)
