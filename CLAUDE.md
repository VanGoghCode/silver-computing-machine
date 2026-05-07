## What This Repo Is

Silver-Computing-Machine is the **Gatekeeper** for the Crispy Adventure AI company system. It owns orchestration, RBAC, the role graph, prompt assembly, task assignment, human/AI meetings, messages, context artifacts, local PRs, project isolation, and worker supervision.

Crispy Adventure is the subordinate worker runtime. Workers communicate with Silver only through authenticated APIs.

## Architecture

```text
Backend:  Node.js + Express
Database: SQLite with WAL mode (better-sqlite3)
Frontend: React + Vite (future)
Container: Docker
Worker:   Crispy Adventure
```

Current structure:

```text
server.js              — Entry point
src/
  app.js               — Express app factory
  config.js            — Environment config
  db/                  — Connection, migration runner, seed runner, helpers
  migrations/          — 001–011 table migrations
  seeds/               — Role templates, model profiles, permission profiles, human owner
  middleware/auth.js   — Bearer token auth
  routes/              — health, files, agents, tasks
  services/            — agents, path safety
  utils/tokens.js      — Token generation and hashing
```

## Repo Boundary

**Silver computing machine owns:** projects, humans, departments, role graph, agents, tokens, Kanban, PRs, conversations, context artifacts, prompts, scheduler, audit trails, dashboard.

**Crispy Adventure (other repo which has AI agents) owns:** LLM loop, tool calling, task execution inside project containers, reporting results back.

**Project repos own:** application source code, tests, project docs, git history, `graphify-out/`.

## Security Rules

- All worker APIs require `Authorization: Bearer <token>`. Never add authless worker endpoints.
- Store only SHA-256 hashes of tokens in SQLite. Never log raw tokens.
- Each token maps to one agent identity (project, department, role).
- Workers never access SQLite directly. All state goes through APIs.
- Agents cannot access other projects or Silver repo internals.
- Path traversal and project isolation are enforced in `src/services/path_safety.js`.
- RBAC is enforced in the backend, not only in the UI.

## Role Graph

Roles are data, not code. Do not hardcode `if role === "CEO"` logic.

Tables: `role_templates`, `project_role_instances`, `role_edges`, `permission_profiles`, `model_profiles`.

Adding a new role should be possible through DB changes without code changes.

Each project has four departments: frontend, backend, infra, deployment.

Each department has these roles: CEO, CTO, Product Manager, Project Manager, Architect, Tech Lead, Engineer(s), Reviewer, Tester, Git Manager, Weekly Audit Agent.

## Core Rule: No Guessing

If something is unclear, ask upstream. Lower roles ask upper roles. CEO/CTO/PM ask the human if needed. All questions, answers, and decisions must be stored in the database.

## Coding Conventions

- Keep services separated by domain. Route handlers stay thin.
- Use migrations for schema changes. Never create tables in route handlers.
- Write tests for RBAC, lifecycle transitions, and security rules.
- Do not silently overwrite context. Create revisions.
- Do not hardcode role behavior. Use role templates, instances, edges, and permission profiles.
- Backend enforces all rules. UI is a view layer.

## Common Commands

```bash
npm install
npm start           # Starts server on port 4000
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check

docker build -t silver-computing-machine -f .devcontainer/Dockerfile .
docker run -it --rm -p 4000:4000 -v $(pwd):/workspace silver-computing-machine
```

## Environment

| Variable         | Default                   | Description          |
| ---------------- | ------------------------- | -------------------- |
| `PORT`           | `4000`                    | Server port          |
| `WORKSPACE_DIR`  | `/workspace`              | Workspace root       |
| `PROJECTS_DIR`   | `$WORKSPACE_DIR/Projects` | Project directories  |
| `SQLITE_DB_PATH` | `./data/silver.db`        | SQLite database path |

## Graphify

This project has a graphify knowledge graph at `graphify-out/`.

- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md`.
- After modifying code, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current.

## Definition of Done

1. Worker APIs remain authenticated.
2. RBAC is enforced in the backend.
3. Project isolation is preserved.
4. State changes create audit events.
5. Task lifecycle rules are tested.
6. Message hierarchy rules are tested.
7. No worker can directly access SQLite.
8. No project container mounts another project or the Silver repo.
9. UI changes reflect backend state accurately.
10. Seed data updated when roles, permissions, or workflows change.
