# Silver-Computing-Machine

**Silver** is the Gatekeeper, sandbox orchestrator, local database, web dashboard, scheduler, RBAC authority, project-container manager, and source of truth for the Crispy Adventure AI company system.

**Crispy Adventure** is the worker runtime. Silver is the company brain and policy layer.

## Silver vs Crispy Adventure

| Concern                       | Silver | Crispy Adventure |
| ----------------------------- | ------ | ---------------- |
| Orchestration                 | Owns   | —                |
| Database (SQLite)             | Owns   | —                |
| RBAC / Policies               | Owns   | —                |
| Role graph / Prompt assembly  | Owns   | —                |
| Task assignment / Kanban      | Owns   | —                |
| Human-AI meetings             | Owns   | —                |
| Messages / Context artifacts  | Owns   | —                |
| Local PRs                     | Owns   | —                |
| Project isolation             | Owns   | —                |
| Worker supervision            | Owns   | —                |
| Dashboard UI                  | Owns   | —                |
| LLM loop / Tool calling       | —      | Owns             |
| Task execution inside project | —      | Owns             |
| Reporting results             | —      | Owns             |

## Local Setup

```bash
npm install
npm start
```

The server starts on port 4000 by default.

## SQLite Database

Silver uses **SQLite with WAL mode** for all durable state.

- Default path: `./data/silver.db` (configurable via `SQLITE_DB_PATH` or `DATABASE_URL`)
- Migrations run automatically on startup
- Seed data (role templates, model profiles, etc.) runs automatically on startup
- Workers never access the database directly — all operations go through the API

### Database Schema

Core tables:

- `projects` — isolated project containers
- `humans` — customer and local-owner records
- `departments` — per-project (frontend, backend, infra, deployment)
- `model_profiles` — LLM model configurations
- `permission_profiles` — role permission sets
- `role_templates` — 11 standard roles (CEO, CTO, PM, etc.)
- `role_prompt_files` — static prompt content per role, versioned
- `project_role_instances` — role instances within a project department
- `role_edges` — communication and authority edges between roles
- `agents` — worker identities with token hashes
- `agent_heartbeats` — worker status updates

## Role Library

Static context for every role lives in `role-library/` as markdown files. These files are imported into the database and assembled into prompts.

### Structure

```
role-library/
  global/                          # Shared across all roles
    company-vision.md
    company-mission.md
    communication-rules.md
    quality-standards.md
    security-rules.md
    context-rules.md
    no-assumption-rules.md
  roles/
    ceo/
      persona.md                   # Who this role is
      instructions.md              # What this role does
      rules.md                     # Hard constraints
      communication.md             # Who this role can talk to
      output-format.md             # Expected output shape
    cto/
    product-manager/
    project-manager/
    architect/
    tech-lead/
    engineer/
    reviewer/
    tester/
    git-manager/
    weekly-audit/
```

### Import

```bash
# Trigger import via API
curl -X POST http://localhost:4000/api/role-templates/import-from-files \
  -H "Content-Type: application/json" \
  -d '{"path": "./role-library"}'
```

The import service:

- Reads all markdown files from the library directory
- Creates/updates `role_templates` and `role_prompt_files` records
- Tracks `content_hash` (SHA-256) to detect changes
- Increments `version` when content changes, preserving old versions as inactive
- Skips unchanged files (no duplicate versions)

### Editing Context

Edit markdown files in `role-library/`, then re-import. Changed files get new versions; unchanged files are skipped. Old versions are preserved in the database with `is_active = 0`.

## Role Graph and Canvas

Each project has a **role graph** — a network of role instances connected by edges that define communication permissions, task assignment authority, and escalation paths.

### Role Nodes

Every role instance in a project is a node with:

- `department_id` — which department it belongs to
- `role_template_id` — which role template it instantiates
- `display_name` — human-readable name
- `canvas_x`, `canvas_y` — position on the visual canvas
- `model_profile_id` — which LLM model to use
- `permission_profile_id` — which permission set applies

### Role Edges

Edges connect two role nodes and define what they can do:

- `can_message` — can exchange messages
- `can_assign_task` — can assign tasks
- `can_escalate` — can escalate issues
- `can_share_context` — can share context artifacts
- `can_request_approval` — can request approval
- `requires_approval` — actions need approval
- `policy_json` — extensible policy rules

Edges are directional (`upstream`, `downstream`, `bidirectional`).

### Default Communication Graph

When a project is created, default edges follow this hierarchy:

```
CEO <-> CTO <-> Product Manager <-> Human
Product Manager -> Project Manager
CTO -> Architect
Project Manager -> Tech Lead
Architect -> Tech Lead
Tech Lead <-> Engineer
Tech Lead <-> Reviewer
Tech Lead <-> Tester
Reviewer <-> Tester
Reviewer -> Git Manager
Tester -> Git Manager
Weekly Audit Agent -> Tech Lead
```

### Human Communication Policy

Human stakeholders communicate **only through** CEO, CTO, or Product Manager. No other role can reach the human directly. This is enforced by the edge graph — if no edge exists between a role and a human-interface role, communication is denied.

## Prompt Assembler

The prompt assembler builds the full static context for an agent:

**Input:** agent ID, role node ID, optional task ID

**Output:** ordered context bundle

### Stable Prompt Order

1. Global: Company Vision
2. Global: Company Mission
3. Global: Communication Rules
4. Global: Quality Standards
5. Global: Security Rules
6. Global: Context Rules
7. Global: No-Assumption Rules
8. Role: Persona
9. Role: Instructions
10. Role: Rules
11. Role: Communication
12. Role: Output Format
13. Permission Summary
14. Agent Identity Block

### Preview

```bash
curl http://localhost:4000/api/agents/<agentId>/prompt-preview \
  -H "Authorization: Bearer <token>"
```

## Auth Model

### Worker Auth (Bearer Token)

All worker API endpoints require `Authorization: Bearer <token>`.

- Tokens are generated by Silver and hashed (SHA-256) before storage
- Only token hashes are stored in the database
- Raw tokens are never logged
- Each token maps to exactly one agent identity (project, department, role)

### Human Auth (Local-Owner MVP)

The dashboard uses a simple local-owner mode for v1. A `humans` record with `role: 'local_owner'` is seeded by default. Real authentication (OAuth, JWT, etc.) can be added later without schema changes.

## API Endpoints

### Public

| Method | Path          | Description         |
| ------ | ------------- | ------------------- |
| GET    | `/api/health` | Server health check |

### Workspace File Operations

| Method | Path                  | Description             |
| ------ | --------------------- | ----------------------- |
| GET    | `/api/files?dir=path` | List files in workspace |
| GET    | `/api/files/:path`    | Read file content       |
| PUT    | `/api/files/:path`    | Write file content      |

### Protected (requires Bearer token)

| Method | Path                                  | Description                   |
| ------ | ------------------------------------- | ----------------------------- |
| GET    | `/api/agents/me`                      | Current agent identity        |
| POST   | `/api/agents/heartbeat`               | Update agent status           |
| GET    | `/api/agents/:agentId/prompt-preview` | Assembled prompt context      |
| GET    | `/api/my-tasks`                       | Agent's assigned tasks (stub) |

### Role Templates

| Method | Path                                    | Description                 |
| ------ | --------------------------------------- | --------------------------- |
| GET    | `/api/role-templates`                   | List all role templates     |
| GET    | `/api/role-templates/:id`               | Get single template         |
| GET    | `/api/role-templates/:id/prompt-files`  | Get template's prompt files |
| POST   | `/api/role-templates`                   | Create new template         |
| PATCH  | `/api/role-templates/:id`               | Update template             |
| POST   | `/api/role-templates/import-from-files` | Import from role-library    |

### Project Role Nodes

| Method | Path                                          | Description       |
| ------ | --------------------------------------------- | ----------------- |
| GET    | `/api/projects/:projectId/role-nodes`         | List active nodes |
| POST   | `/api/projects/:projectId/role-nodes`         | Create node       |
| PATCH  | `/api/projects/:projectId/role-nodes/:nodeId` | Update node       |
| DELETE | `/api/projects/:projectId/role-nodes/:nodeId` | Soft-delete node  |

### Role Edges

| Method | Path                                          | Description |
| ------ | --------------------------------------------- | ----------- |
| GET    | `/api/projects/:projectId/role-edges`         | List edges  |
| POST   | `/api/projects/:projectId/role-edges`         | Create edge |
| PATCH  | `/api/projects/:projectId/role-edges/:edgeId` | Update edge |
| DELETE | `/api/projects/:projectId/role-edges/:edgeId` | Delete edge |

## Core Architecture

```
Silver-Computing-Machine/
├── server.js              — Entry point, starts server
├── role-library/          — Static markdown context files
│   ├── global/            — Shared context (vision, rules, etc.)
│   └── roles/             — Per-role prompt files
├── src/
│   ├── app.js             — Express app factory
│   ├── config.js          — Environment config
│   ├── db/
│   │   ├── index.js       — SQLite connection with WAL
│   │   ├── migrate.js     — Migration runner
│   │   ├── seed.js        — Seed runner
│   │   └── helpers.js     — generateId, withTransaction
│   ├── migrations/        — 001 through 011 table migrations
│   ├── seeds/             — Role templates, model profiles, default edges
│   ├── middleware/
│   │   └── auth.js        — Bearer token authentication
│   ├── routes/
│   │   ├── health.js      — Public health endpoint
│   │   ├── files.js       — Workspace file CRUD
│   │   ├── agents.js      — Agent identity, heartbeat, prompt preview
│   │   ├── tasks.js       — Task assignment (stub)
│   │   ├── role_templates.js — Role template CRUD + import
│   │   ├── role_nodes.js  — Project role node CRUD
│   │   └── role_edges.js  — Role edge CRUD
│   ├── services/
│   │   ├── agents.js      — Agent lookup, heartbeat
│   │   ├── path_safety.js — Path traversal protection
│   │   ├── role_library_import.js — Import markdown to DB
│   │   ├── role_graph_policy.js — Edge-driven permission checks
│   │   └── prompt_assembler.js — Static prompt assembly
│   └── utils/
│       └── tokens.js      — Token generation and hashing
├── tests/                 — Jest + Supertest tests
├── Projects/              — Isolated project directories
└── data/                  — SQLite database files (gitignored)
```

## Environment Variables

| Variable         | Default                   | Description          |
| ---------------- | ------------------------- | -------------------- |
| `PORT`           | `4000`                    | Server port          |
| `WORKSPACE_DIR`  | `/workspace`              | Workspace root       |
| `PROJECTS_DIR`   | `$WORKSPACE_DIR/Projects` | Project directories  |
| `SQLITE_DB_PATH` | `./data/silver.db`        | SQLite database path |

## Commands

```bash
npm install           # Install dependencies
npm start             # Start server
npm test              # Run tests
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format with Prettier
npm run format:check  # Check formatting
```

## Docker

```bash
docker build -t silver-computing-machine -f .devcontainer/Dockerfile .
docker run -it --rm -p 4000:4000 -v $(pwd):/workspace silver-computing-machine
```
