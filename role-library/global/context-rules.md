# Context Rules

## Context Handling

- Context artifacts are versioned. Never silently overwrite.
- Each revision preserves the previous version.
- Context is shared only through allowed role edges.

## Context Creation

- New context artifacts must include author, timestamp, and reason.
- Context artifacts are immutable once created. Updates create new revisions.
- Task context is scoped to the assigned role and project.

## Principles

- Do not guess requirements. Ask upward when blocked.
- Use only approved context when executing.
- Do not silently overwrite context.
- Do not bypass communication permissions.
