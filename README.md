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

Context engine tables:

- `context_artifacts` — versioned context documents (requirements, specs, reports, etc.)
- `context_revisions` — revision history for each artifact
- `context_links` — directed links between artifacts (references, drives, etc.)
- `document_sets` — grouped sets of aligned documents per lifecycle stage
- `document_set_items` — artifacts belonging to a document set

Collaboration and execution tables:

- `tasks` — Kanban tasks with lifecycle, priority, branch info, linked artifacts
- `task_todos` — per-task checklist items with positions
- `task_events` — audit trail for task lifecycle changes and comments
- `task_attempts` — per-attempt tracking with start/end times and results
- `conversations` — message threads linked to projects
- `messages` — role-to-role and role-to-human messages with type and priority
- `local_prs` — local PR objects for code review without GitHub integration

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

## Dynamic Context Engine

All important knowledge is stored as **versioned context artifacts**. Context is never silently overwritten. Every artifact has a lifecycle stage, status, and revision history.

### Context Artifacts

Artifacts are versioned documents that capture important decisions, requirements, specs, and reports.

**Artifact types:** `customer_brief`, `ceo_analysis`, `cto_strategy`, `product_requirements`, `acceptance_criteria`, `risk_register`, `open_questions`, `milestone_plan`, `architecture_spec`, `implementation_plan`, `task_context`, `decision_record`, `review_notes`, `test_report`, `audit_report`, `blocker_report`, `daily_report`, `research_note`

**Lifecycle stages:** `discovery` → `mvp` → `v1` → `v2` → `future` → `maintenance`

Each artifact belongs to a lifecycle stage. This allows MVP, v1, and v2 requirements to coexist independently.

**Artifact statuses:** `draft` → `needs_review` → `approved` → `superseded` / `archived` / `rejected`

Rules:

- Only **approved** artifacts are used as default task source-of-truth
- Draft artifacts can be previewed but do not drive engineering tasks
- Superseding creates a new artifact and marks the old one `superseded`
- Archiving soft-hides from prompts but preserves audit history
- No hard deletes — only archive or supersede

| Method | Path                                         | Description                   |
| ------ | -------------------------------------------- | ----------------------------- |
| POST   | `/api/context-artifacts`                     | Create artifact               |
| GET    | `/api/context-artifacts/:id`                 | Get artifact                  |
| PATCH  | `/api/context-artifacts/:id`                 | Update artifact               |
| POST   | `/api/context-artifacts/:id/revise`          | Create new version (revision) |
| POST   | `/api/context-artifacts/:id/approve`         | Approve artifact              |
| POST   | `/api/context-artifacts/:id/reject`          | Reject artifact               |
| POST   | `/api/context-artifacts/:id/archive`         | Archive artifact              |
| GET    | `/api/context-artifacts/:id/revisions`       | List revision history         |
| POST   | `/api/context-artifacts/:id/link`            | Link to another artifact      |
| GET    | `/api/context-artifacts/:id/links`           | Get linked artifacts          |
| GET    | `/api/projects/:projectId/context-artifacts` | List project artifacts        |
| GET    | `/api/context?q=`                            | Search artifacts              |

Query parameters for listing: `?artifact_type=product_requirements&lifecycle_stage=mvp&include_archived=true`

### Document Sets

Document sets group aligned artifacts for a lifecycle stage. For example, an MVP document set might include a customer brief, product requirements, acceptance criteria, and architecture spec.

| Method | Path                                     | Description          |
| ------ | ---------------------------------------- | -------------------- |
| POST   | `/api/projects/:projectId/document-sets` | Create document set  |
| GET    | `/api/projects/:projectId/document-sets` | List document sets   |
| GET    | `/api/document-sets/:id`                 | Get set with items   |
| POST   | `/api/document-sets/:id/items`           | Add artifacts to set |
| PATCH  | `/api/document-sets/:id`                 | Update document set  |
| POST   | `/api/document-sets/:id/approve`         | Approve document set |

### Source-of-Truth Validation

Before a task can move to ready, the system validates that the required approved artifacts exist for the target lifecycle stage.

| Method | Path                                                | Description                  |
| ------ | --------------------------------------------------- | ---------------------------- |
| POST   | `/api/projects/:projectId/validate-source-of-truth` | Validate approved docs exist |

Required artifacts: `product_requirements`, `acceptance_criteria` (both must be approved for the given lifecycle stage).

### Prompt Assembler Dynamic Context

The prompt assembler now includes dynamic context from approved artifacts alongside static role context. Query parameters control what is included:

- `lifecycle_stage` — which stage to pull artifacts from (default: `mvp`)
- `include_draft` — include draft artifacts (default: false, only for review/alignment tasks)

Rules:

- Excludes archived and superseded artifacts
- Selects the latest approved artifact per type
- Includes artifact IDs so workers know their exact source of truth

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

## Kanban Task Lifecycle

Tasks follow a structured Kanban workflow with validation gates and pipeline iteration limits.

### Lifecycle States

```
backlog → ready → assigned → in_progress → review → testing → done
                       ↑          ↑            ↓        ↓
                       └──────────┴────────────┘        │
                            rework allowed              │
                       ←────────────────────────────────┘
                          review/test can return to in_progress or assigned
```

### Transition Rules

| From          | To            | Condition                             |
| ------------- | ------------- | ------------------------------------- |
| `backlog`     | `ready`       | All linked artifacts must be approved |
| `ready`       | `assigned`    | Must have `assigned_agent_id`         |
| `assigned`    | `in_progress` | Agent claims via `/claim`             |
| `in_progress` | `review`      | Pipeline iteration increments         |
| `review`      | `testing`     | Normal flow                           |
| `review`      | `in_progress` | Rework — requires reason              |
| `review`      | `assigned`    | Reassignment — requires reason        |
| `testing`     | `done`        | Normal completion                     |
| `testing`     | `in_progress` | Test failures found                   |
| `testing`     | `review`      | Needs another review                  |
| `testing`     | `assigned`    | Major rework needed                   |

### Pipeline Iteration Limit

The `pipeline_iteration` counter tracks how many times a task enters the review/test cycle. Default max is **2**. Once exceeded, the task cannot re-enter review. This prevents infinite review/test loops.

### Task Creation

Tasks are always created in `backlog` status. Moving to `ready` requires approved linked context artifacts (source-of-truth validation).

| Method | Path                    | Description           |
| ------ | ----------------------- | --------------------- |
| POST   | `/api/tasks`            | Create task (backlog) |
| GET    | `/api/tasks?project_id` | List project tasks    |
| GET    | `/api/tasks/:id`        | Get task with todos   |

## Worker Task APIs

Crispy Adventure workers interact with tasks through these endpoints.

| Method | Path                               | Description                     |
| ------ | ---------------------------------- | ------------------------------- |
| GET    | `/api/my-tasks`                    | Tasks assigned to current agent |
| POST   | `/api/tasks/:id/claim`             | Claim assigned task             |
| GET    | `/api/tasks/:id/execution-context` | Full worker context bundle      |
| PATCH  | `/api/tasks/:id/move`              | Transition task status          |
| POST   | `/api/tasks/:id/events`            | Log task event                  |
| PATCH  | `/api/tasks/:id/todos/:todoId`     | Update checklist item           |
| POST   | `/api/tasks/:id/complete`          | Mark task complete              |
| POST   | `/api/tasks/:id/fail`              | Report task failure             |

Rules:

- `/api/my-tasks` returns only tasks assigned to the authenticated agent
- `claim` moves `assigned` → `in_progress` and creates a task attempt
- `complete` stores a structured result and moves task through the workflow
- `fail` stores failure result without losing history, moves back to `assigned`

## Execution Context Bundle

`GET /api/tasks/:id/execution-context` returns everything a Crispy Adventure worker needs to execute a task.

### Response Structure

```json
{
  "agent": { "agent_id": "...", "agent_name": "..." },
  "role": { "role_key": "engineer", "role_display_name": "Engineer", "role_instance_id": "..." },
  "project": { "project_id": "...", "project_name": "...", "project_slug": "..." },
  "department": { "department_id": "...", "department_key": "...", "department_name": "..." },
  "task": { "id": "...", "title": "...", "status": "in_progress", "priority": "high" },
  "lifecycle_stage": "mvp",
  "todos": [...],
  "acceptance_criteria_md": "- Criteria...",
  "branch_info": { "base_branch": "main", "branch_name": "feature/auth" },
  "static_prompt": [...],
  "dynamic_context": [...],
  "recent_messages": [...],
  "local_pr": null,
  "allowed_tools": ["read", "write", "edit", "search", "bash", "glob", "grep"],
  "forbidden_actions": ["delete_project", "modify_permissions", "escalate_without_approval"],
  "dopamine_info": { "placeholder": true },
  "source_artifacts": [{ "artifact_id": "...", "artifact_type": "product_requirements", "version": 1, "status": "approved" }]
}
```

### Context Assembly

The execution context pulls from multiple sources:

- **Static prompt**: Global and role-specific markdown from `role_prompt_files`
- **Dynamic context**: Approved artifacts linked to the task
- **Source artifacts**: IDs and versions of all linked approved documents
- **Recent messages**: Last 10 messages relevant to the task's project
- **Local PR**: If a PR exists for this task, included automatically

## Messaging and Hierarchy Edges

Messages flow through the role graph. Every message is validated against `role_edges` with `can_message = 1`.

### Message Types

`question`, `answer`, `escalation`, `blocker`, `decision`, `notification`

### APIs

| Method | Path                              | Description              |
| ------ | --------------------------------- | ------------------------ |
| POST   | `/api/messages`                   | Send a message           |
| GET    | `/api/conversations?project_id=`  | List conversations       |
| GET    | `/api/conversations/:id/messages` | Get conversation history |

### Permission Rules

- Messages between roles require a `can_message` edge (direct or bidirectional)
- Human communication is only allowed through CEO, CTO, or Product Manager roles
- Same-role cross-department communication requires an explicit edge
- Messages are stored permanently and can link to tasks or alignment sessions

## Question Escalation Path

When an Engineer has a question that cannot be resolved locally, the escalation path follows the role hierarchy:

```
Engineer asks Tech Lead (via message, type: question)
  → Tech Lead cannot answer
    → Tech Lead escalates to Reviewer or Architect (type: escalation)
      → Architect escalates to CTO (type: escalation)
        → CTO escalates to CEO or Product Manager (type: escalation)
          → CEO/Product Manager asks human if needed
```

Each escalation creates a message with `message_type: 'escalation'` and links to the original question. The chain is fully traceable through the `conversations` and `messages` tables.

## Local PR Objects

Silver tracks pull requests locally without GitHub integration. Local PRs are created by agents and go through a review/test workflow.

| Method | Path                        | Description |
| ------ | --------------------------- | ----------- |
| POST   | `/api/local-prs`            | Create PR   |
| GET    | `/api/local-prs?project_id` | List PRs    |
| GET    | `/api/local-prs/:id`        | Get PR      |
| PATCH  | `/api/local-prs/:id`        | Update PR   |

### PR Fields

- `title`, `summary_md` — description
- `branch_name`, `base_branch` — git branches
- `changed_files_json` — list of changed files
- `self_review_md` — agent's self-review
- `status` — `draft`, `ready`, `merged`, `closed`
- `review_status`, `test_status`, `merge_status` — sub-statuses

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
15. Dynamic Context (approved artifacts for lifecycle stage)

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

### Worker Status Lifecycle

Valid worker statuses: `idle`, `busy`, `error`, `offline`, `starting`, `stopped`

Heartbeats update `worker_status` on the agent record. Stale heartbeat detection marks agents as `offline` when no heartbeat arrives within the configured threshold (`AGENT_HEARTBEAT_STALE_MS`, default 60000ms).

## Agent Token Lifecycle

Tokens are generated on agent creation and shown **only once**. The system stores only the SHA-256 hash.

- **Create**: `POST /api/agents` returns `{ agent, token }` — save the token immediately
- **Rotate**: `POST /api/agents/:id/token/rotate` invalidates the old token, returns a new one
- **Revoke**: `POST /api/agents/:id/revoke` permanently disables the agent
- Revoked agents cannot authenticate (401)

## Model Profiles

Model profiles define which LLM each role uses. Profiles store a provider, model name, purpose, and an `api_key_ref` pointing to an environment variable (never a raw key).

Default seeded profiles:

| Key                | Provider  | Model             | Purpose                     |
| ------------------ | --------- | ----------------- | --------------------------- |
| `strong_reasoning` | anthropic | claude-sonnet-4-6 | Complex reasoning, strategy |
| `coding`           | anthropic | claude-sonnet-4-6 | Code implementation         |
| `economy`          | anthropic | claude-haiku-4-5  | Lightweight tasks           |
| `audit_strong`     | anthropic | claude-opus-4-6   | Audits, security reviews    |

API key refs map to env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`. Raw keys are never stored in logs or API responses.

## Permission Profiles

Permission profiles control what each role can do. They attach to role nodes and agents.

Supported fields in `permissions_json`:

- `allowed_tools` / `forbidden_tools` — tool access control
- `allowed_commands` / `blocked_commands` — command execution control
- `git_permissions` — commit, push, branch management
- `file_permissions` — read, write, delete
- `task_permissions` — create, claim, complete
- `message_permissions` — send, escalate
- `context_permissions` — view approved/draft artifacts
- `human_contact_permissions` — contact human directly

## Project Runtime Model

Each project runs in its own isolated runtime container. Many worker processes run inside a single project runtime.

```
Silver (control plane)
├── Project-A runtime (container/process)
│   ├── Engineer-1 worker
│   ├── Reviewer worker
│   └── Tester worker
├── Project-B runtime (container/process)
│   ├── Engineer-1 worker
│   └── Tech Lead worker
```

### Runtime Rules

- One runtime container per project
- Many worker processes inside each runtime
- Project runtime mounts only that project folder
- Project runtime must **not** mount the Silver repo
- Agents receive only their own token and model env config
- Project-A agents cannot access Project-B data

### Runtime Manager Interface

The `ProjectRuntimeManager` interface supports:

- `createProjectRuntime(projectId)` — initialize runtime
- `startProjectRuntime(projectId)` — start the container/process
- `stopProjectRuntime(projectId)` — stop runtime and all workers
- `getProjectRuntimeStatus(projectId)` — check status + worker list
- `spawnWorker(projectId, agentId)` — start a worker process
- `stopWorker(projectId, agentId)` — stop a specific worker
- `getWorkerLogs(projectId, agentId)` — retrieve worker logs

Two adapters:

- `MockRuntimeManager` — for tests
- `ProcessRuntimeManager` — for MVP local development (future)

## Project Creation Workflow

Creating a project via `POST /api/projects` performs:

1. Create project row with slug, name, and root path
2. Create project folder under `Projects/<slug>` (path traversal blocked)
3. Create default department (`core`)
4. Create role nodes from all 11 role templates
5. Create default role edges (communication graph)
6. Create initial discovery document set
7. Optionally create agents with tokens (`create_agents: true`)

Workers are not started automatically. Use the runtime management APIs:

| Method | Path                              | Description              |
| ------ | --------------------------------- | ------------------------ |
| POST   | `/api/projects/:id/start-runtime` | Start project runtime    |
| POST   | `/api/projects/:id/stop-runtime`  | Stop project runtime     |
| POST   | `/api/projects/:id/spawn-workers` | Spawn workers for agents |

### Project Isolation

Path safety ensures:

- Slugs must match `^[a-zA-Z0-9_-]+$`
- Paths are resolved and verified to stay within `Projects/<slug>`
- Path traversal (`../`, null bytes, absolute paths) is blocked
- `safePath()` and `isWithinProject()` enforce boundaries at the service layer

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

| Method | Path                                  | Description              |
| ------ | ------------------------------------- | ------------------------ |
| GET    | `/api/agents/me`                      | Current agent identity   |
| POST   | `/api/agents/heartbeat`               | Update agent status      |
| GET    | `/api/agents/:agentId/prompt-preview` | Assembled prompt context |
| GET    | `/api/my-tasks`                       | Agent's assigned tasks   |

### Agent Management

| Method | Path                           | Description          |
| ------ | ------------------------------ | -------------------- |
| POST   | `/api/agents`                  | Create agent + token |
| GET    | `/api/agents`                  | List agents          |
| GET    | `/api/agents/:id`              | Get agent by ID      |
| POST   | `/api/agents/:id/token/rotate` | Rotate agent token   |
| POST   | `/api/agents/:id/revoke`       | Revoke agent         |

### Model Profiles

| Method | Path                      | Description    |
| ------ | ------------------------- | -------------- |
| GET    | `/api/model-profiles`     | List profiles  |
| POST   | `/api/model-profiles`     | Create profile |
| PATCH  | `/api/model-profiles/:id` | Update profile |

### Permission Profiles

| Method | Path                           | Description    |
| ------ | ------------------------------ | -------------- |
| GET    | `/api/permission-profiles`     | List profiles  |
| POST   | `/api/permission-profiles`     | Create profile |
| PATCH  | `/api/permission-profiles/:id` | Update profile |

### Project Management

| Method | Path                              | Description    |
| ------ | --------------------------------- | -------------- |
| POST   | `/api/projects`                   | Create project |
| POST   | `/api/projects/:id/start-runtime` | Start runtime  |
| POST   | `/api/projects/:id/stop-runtime`  | Stop runtime   |
| POST   | `/api/projects/:id/spawn-workers` | Spawn workers  |

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
│   ├── migrations/        — 001 through 017 table migrations
│   ├── seeds/             — Role templates, model profiles, permission profiles, default edges
│   ├── middleware/
│   │   └── auth.js        — Bearer token authentication (rejects revoked agents)
│   ├── routes/
│   │   ├── health.js      — Public health endpoint
│   │   ├── files.js       — Workspace file CRUD
│   │   ├── agents.js      — Agent identity, heartbeat, token management, prompt preview
│   │   ├── tasks.js       — Task CRUD, lifecycle, worker APIs, execution context
│   │   ├── messages.js    — Messaging with role edge enforcement
│   │   ├── local_prs.js   — Local PR object CRUD
│   │   ├── model_profiles.js — Model profile CRUD
│   │   ├── permission_profiles.js — Permission profile CRUD
│   │   ├── projects.js    — Project creation, runtime management
│   │   ├── role_templates.js — Role template CRUD + import
│   │   ├── role_nodes.js  — Project role node CRUD
│   │   └── role_edges.js  — Role edge CRUD
│   │   ├── problem_statements.js — Problem statement CRUD
│   │   ├── alignment_sessions.js — Alignment session CRUD + participant auto-select
│   │   ├── clarification.js — Clarification Q&A cycle
│   │   ├── research_notes.js — Research note CRUD
│   │   ├── alignment_reviews.js — Alignment review submission
│   │   ├── human_approvals.js — Approval CRUD + engineering gate
│   │   ├── context_artifacts.js — Context artifact CRUD + lifecycle + search
│   │   └── document_sets.js — Document set grouping + approval
│   ├── services/
│   │   ├── agents.js      — Agent lookup, heartbeat
│   │   ├── agent_tokens.js — Agent token CRUD (generate, rotate, revoke)
│   │   ├── heartbeat.js   — Valid statuses, stale detection
│   │   ├── projects.js    — Project creation workflow
│   │   ├── runtime_manager.js — Runtime manager interface + MockRuntimeManager
│   │   ├── tasks.js       — Task lifecycle, execution context, todos, events
│   │   ├── messages.js    — Message sending, role edge checks, conversations
│   │   ├── local_prs.js   — Local PR CRUD
│   │   ├── path_safety.js — Path traversal protection
│   │   ├── role_library_import.js — Import markdown to DB
│   │   ├── role_graph_policy.js — Edge-driven permission checks
│   │   └── prompt_assembler.js — Static + dynamic prompt assembly
│   └── utils/
│       └── tokens.js      — Token generation and hashing
├── tests/                 — Jest + Supertest tests
├── client/                — React/Vite dashboard (v1)
│   ├── src/
│   │   ├── api/           — API client module
│   │   ├── components/    — Layout, sidebar
│   │   └── pages/         — All dashboard pages
│   └── dist/              — Production build (served by backend)
├── Projects/              — Isolated project directories
├── graphify-out/          — Graphify knowledge graph output
└── data/                  — SQLite database files (gitignored)
```

## Environment Variables

| Variable                   | Default                   | Description                    |
| -------------------------- | ------------------------- | ------------------------------ |
| `PORT`                     | `4000`                    | Server port                    |
| `WORKSPACE_DIR`            | `/workspace`              | Workspace root                 |
| `PROJECTS_DIR`             | `$WORKSPACE_DIR/Projects` | Project directories            |
| `SQLITE_DB_PATH`           | `./data/silver.db`        | SQLite database path           |
| `AGENT_HEARTBEAT_STALE_MS` | `60000`                   | Stale heartbeat threshold (ms) |
| `GRAPHIFY_COMMAND`         | `graphify`                | Graphify CLI command           |

## Commands

```bash
# Backend
npm install           # Install dependencies
npm start             # Start server (port 4000)
npm test              # Run all tests (285+ tests)
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format with Prettier
npm run format:check  # Check formatting

# Frontend (dashboard)
cd client
npm install           # Install frontend dependencies
npm run dev           # Start dev server with proxy to backend
npm run build         # Production build → client/dist/
```

The backend serves the frontend dashboard automatically when `client/dist/` exists. In development, run both the backend (`npm start`) and the frontend dev server (`cd client && npm run dev`) separately.

## Dashboard (React/Vite)

Silver v1 includes a full web dashboard for human-AI interaction.

### Pages

| Page                | Path             | Description                                          |
| ------------------- | ---------------- | ---------------------------------------------------- |
| Projects            | `/`              | List and create projects                             |
| Project Detail      | `/project/:id`   | Project overview: alignment status, artifacts, tasks |
| Human Intake        | `/intake`        | Submit problem statements, start brainstorming       |
| Alignment Sessions  | `/alignment`     | View and start alignment sessions                    |
| Questions & Answers | `/questions`     | View AI questions, answer them                       |
| Documents           | `/documents`     | View/approve/reject context artifacts                |
| Document Sets       | `/document-sets` | Create/approve MVP/v1/v2 document sets               |
| Agents              | `/agents`        | List all worker agents                               |
| Kanban              | `/kanban`        | Task board with lifecycle columns                    |
| Role Canvas         | `/role-canvas`   | Visual role graph: nodes, edges, permissions         |
| Conversations       | `/conversations` | Message threads between roles                        |
| Local PRs           | `/local-prs`     | Review/test/merge local PRs                          |
| Reports             | `/reports`       | Daily reports and weekly audit runs                  |
| Graphify            | `/graphify`      | Run graphify, view run history                       |
| Settings            | `/settings`      | Model profiles, permission profiles, role templates  |

### Human Intake Workflow

1. Human creates a project on the Projects page
2. Navigates to Human Intake, selects the project, submits a problem statement
3. Starts an alignment session from the Alignment Sessions page
4. AI leadership (CEO, CTO, Product Manager) auto-joins the session
5. AI asks clarification questions visible on the Questions page
6. Human answers questions (MCQ, yes/no, free text)
7. AI creates research notes during the process
8. Alignment reviews determine if more questions are needed
9. When ready, draft context artifacts are generated
10. Human approves artifacts on the Documents page
11. Human creates and approves an MVP Document Set
12. Engineering tasks can now be created on the Kanban page

## Graphify Integration

Silver integrates with Graphify for automated knowledge graph generation.

### APIs

| Method | Path                                     | Description              |
| ------ | ---------------------------------------- | ------------------------ |
| POST   | `/api/projects/:projectId/graphify/run`  | Run graphify for project |
| GET    | `/api/projects/:projectId/graphify/runs` | List graphify runs       |
| GET    | `/api/graphify/query?q=`                 | Search graph summaries   |

### Configuration

- `GRAPHIFY_COMMAND` env var (default: `graphify`)
- Handles missing command gracefully — marks run as `error` instead of crashing
- Reads `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` when available
- Stores run records in `graphify_runs` table with status, output path, summary

### Run Triggers

- Manual: Dashboard Graphify page or API call
- Post-merge: Trigger after local PR marked as merged
- Pre-architecture: Before large architecture tasks

## Weekly Audit Flow

The weekly audit agent reviews project health without directly fixing code.

### APIs

| Method | Path                                  | Description     |
| ------ | ------------------------------------- | --------------- |
| POST   | `/api/projects/:projectId/audits/run` | Run audit       |
| GET    | `/api/projects/:projectId/audits`     | List audit runs |

### Behavior

1. Creates an `audit_report` context artifact
2. Includes task summary, agent count, artifact count
3. Sends notification message to the Tech Lead role
4. Stores run in `audit_runs` table

## Daily Report Generation

CEO/CTO/PM receive daily reports with project status.

### APIs

| Method | Path                                     | Description     |
| ------ | ---------------------------------------- | --------------- |
| POST   | `/api/projects/:projectId/reports/daily` | Generate report |
| GET    | `/api/projects/:projectId/reports`       | List reports    |

### Report Sections

- Yesterday completed tasks
- Today planned tasks
- Blockers
- Risks (placeholder)
- Questions for customer
- Team morale (placeholder)
- Budget/cost (placeholder)
- Security concerns
- Documentation/version changes
- Open alignment issues
- Task statistics by status

## Additional Database Tables

### graphify_runs

| Column                | Type | Description                     |
| --------------------- | ---- | ------------------------------- |
| id                    | TEXT | Primary key                     |
| project_id            | TEXT | FK to projects                  |
| triggered_by_agent_id | TEXT | FK to agents                    |
| trigger_reason        | TEXT | manual/post-merge               |
| status                | TEXT | pending/running/completed/error |
| output_path           | TEXT | Path to graphify-out            |
| summary_md            | TEXT | Truncated summary               |
| started_at            | TEXT | ISO timestamp                   |
| finished_at           | TEXT | ISO timestamp                   |
| error_md              | TEXT | Error message if failed         |

### audit_runs

| Column             | Type | Description                     |
| ------------------ | ---- | ------------------------------- |
| id                 | TEXT | Primary key                     |
| project_id         | TEXT | FK to projects                  |
| department_id      | TEXT | FK to departments               |
| audit_agent_id     | TEXT | FK to agents                    |
| status             | TEXT | pending/running/completed/error |
| report_artifact_id | TEXT | FK to context_artifacts         |
| started_at         | TEXT | ISO timestamp                   |
| finished_at        | TEXT | ISO timestamp                   |
| error_md           | TEXT | Error message                   |

## Current Limitations

- Human auth uses simple local-owner mode (no OAuth/JWT for v1)
- Frontend does not have authentication — API calls require Bearer tokens from agent creation
- Graphify runs synchronously — may timeout for large projects
- Role Canvas is a basic list/box view — no drag-and-drop positioning
- No real LLM integration — AI responses must be triggered manually via API
- No Docker Compose for backend + frontend
- No WebSocket/SSE for real-time updates
- Pipeline iteration limit is hardcoded at 2
- Worker runtime management uses MockRuntimeManager (ProcessRuntimeManager not yet implemented)

## Docker

```bash
docker build -t silver-computing-machine -f .devcontainer/Dockerfile .
docker run -it --rm -p 4000:4000 -v $(pwd):/workspace silver-computing-machine
```
