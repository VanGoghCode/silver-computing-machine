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

Intake and alignment tables:

- `problem_statements` — human problem descriptions
- `alignment_sessions` — alignment brainstorming sessions
- `alignment_participants` — session participants (AI roles + humans)
- `clarification_questions` — structured AI-to-human questions
- `clarification_answers` — human answers to questions
- `research_notes` — agent research findings
- `alignment_reviews` — alignment review assessments
- `human_approvals` — artifact approval tracking

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

## Human Intake and Alignment Workflow

The system supports a structured human-AI brainstorming loop before any engineering work begins. No engineering tasks can be created until the alignment workflow produces approved, versioned documents.

### Flow

```
Human submits problem statement
→ AI leadership team (CEO, CTO, Product Manager) joins alignment session
→ AI asks structured clarification questions
→ Human answers
→ AI researches and documents findings
→ AI reviews alignment (may loop back to more questions)
→ Repeat until ready_for_docs
→ Draft context artifacts generated
→ Human approves artifacts
→ Engineering tasks may begin
```

### Problem Statement

A human creates a problem statement describing what they need.

Statuses: `draft` → `submitted` → `in_alignment` → `aligned` → `archived`

| Method | Path                                          | Description              |
| ------ | --------------------------------------------- | ------------------------ |
| POST   | `/api/projects/:projectId/problem-statements` | Create problem statement |
| GET    | `/api/projects/:projectId/problem-statements` | List for project         |
| GET    | `/api/problem-statements/:id`                 | Get by ID                |
| PATCH  | `/api/problem-statements/:id`                 | Update                   |

### Alignment Sessions

An alignment session is created from a problem statement. It auto-selects CEO, CTO, and Product Manager participants from the project's role instances.

Statuses: `active` → `waiting_for_human` → `reviewing` → `ready_for_docs` → `approved` → `closed`

| Method | Path                                          | Description                |
| ------ | --------------------------------------------- | -------------------------- |
| POST   | `/api/projects/:projectId/alignment-sessions` | Create session             |
| GET    | `/api/projects/:projectId/alignment-sessions` | List for project           |
| GET    | `/api/alignment-sessions/:id`                 | Get session + participants |
| PATCH  | `/api/alignment-sessions/:id`                 | Update session             |

### Clarification Questions

AI roles ask the human structured questions during alignment.

Question types: `note`, `mcq_single`, `mcq_multi`, `yes_no`, `priority_rank`, `numeric`, `date`, `file_reference`

Question statuses: `open` → `answered` → `superseded` → `archived`

| Method | Path                                    | Description       |
| ------ | --------------------------------------- | ----------------- |
| POST   | `/api/alignment-sessions/:id/questions` | Ask a question    |
| GET    | `/api/alignment-sessions/:id/questions` | List questions    |
| POST   | `/api/questions/:id/answer`             | Answer a question |
| GET    | `/api/alignment-sessions/:id/answers`   | List answers      |

### Research Notes

AI agents document research findings during alignment.

| Method | Path                                         | Description          |
| ------ | -------------------------------------------- | -------------------- |
| POST   | `/api/alignment-sessions/:id/research-notes` | Create research note |
| GET    | `/api/alignment-sessions/:id/research-notes` | List notes           |
| PATCH  | `/api/research-notes/:id`                    | Update note          |

### Alignment Reviews

AI roles review the current state of alignment and decide if more questions are needed.

| Method | Path                                 | Description   |
| ------ | ------------------------------------ | ------------- |
| POST   | `/api/alignment-sessions/:id/review` | Submit review |

When `next_questions_needed` is 0, the session moves to `ready_for_docs`.

### Human Approvals

When alignment is complete, draft context artifacts are created and sent for human approval.

Artifact types: `customer_brief`, `ceo_analysis`, `cto_strategy`, `product_requirements`, `acceptance_criteria`, `risk_register`, `open_questions`, `milestone_plan`

Approval statuses: `pending` → `approved` | `rejected`

| Method | Path                                        | Description                    |
| ------ | ------------------------------------------- | ------------------------------ |
| POST   | `/api/projects/:projectId/approvals`        | Create approval                |
| PATCH  | `/api/approvals/:id`                        | Approve or reject              |
| GET    | `/api/projects/:projectId/alignment-status` | Check if engineering can start |

### Engineering Gate

Engineering tasks **cannot** be created from unapproved alignment documents. The `/api/projects/:projectId/alignment-status` endpoint returns `can_create_engineering_tasks: true` only when the project has approved alignment sessions or aligned problem statements.

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
│   │   ├── problem_statements.js — Problem statement CRUD
│   │   ├── alignment_sessions.js — Alignment session CRUD + participant auto-select
│   │   ├── clarification.js — Clarification Q&A cycle
│   │   ├── research_notes.js — Research note CRUD
│   │   ├── alignment_reviews.js — Alignment review submission
│   │   └── human_approvals.js — Approval CRUD + engineering gate
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
