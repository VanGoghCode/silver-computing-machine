## What This Repository Is

Silver-Computing-Machine is the Gatekeeper, sandbox orchestrator, local database, web dashboard, scheduler, RBAC authority, project-container manager, and source of truth for the Crispy Adventure AI company system.

This repo owns the outer layer. Project code lives inside isolated project folders and project runtime containers. Crispy Adventure workers run inside those project containers and poll this Gatekeeper for tasks.

Crispy Adventure is the worker runtime. Silver is the company brain, policy layer, and audit trail.

## Vision

Build a fully managed, hierarchy-driven AI company where autonomous agents collaborate like a real software engineering organization.

Each project has four departments:

- Frontend
- Backend
- Infra
- Deployment

Each department has its own focused team and hierarchy:

```text
Human Customer
    -> Department CEO
    -> Department CTO
    -> Product Manager
    -> Project Manager
    -> Architect
    -> Tech Lead
    -> Engineers
    -> Reviewer
    -> Tester
    -> Git Manager
    -> Weekly Audit Agent
```

The human customer communicates at a high level with department CEOs, CTOs, and Product Managers. Lower roles ask questions through their hierarchy.

## Mission

Create a secure, local-first, zero-trust orchestration platform that gives AI coding agents maximum autonomy inside strict project boundaries.

Silver must:

1. Isolate each project from every other project.
2. Start and supervise workers for each project.
3. Own all durable state in a local database.
4. Enforce RBAC for tools, tasks, messages, commands, files, git, PRs, and context access.
5. Provide a dashboard for the human customer.
6. Keep complete audit trails of agent actions.
7. Prevent hidden communication loops that bypass hierarchy.
8. Track project progress through local PR objects and Kanban states.
9. Assemble role-specific static and dynamic prompt context.
10. Run Graphify after merges and before large architecture work.
11. Support scheduled weekly audit agents that create markdown findings and notify Tech Leads.

## Repo Boundary

### Silver Owns

- Projects table and project lifecycle
- Department/team structure
- Agents, roles, names, tokens, model profiles
- Static role prompt templates
- Dynamic context artifacts
- Kanban tasks and task lifecycle
- Local PR objects
- Review/test/merge workflow state
- Conversations and message permissions
- Human meeting rooms
- Dopamine ledger
- Worker supervisor and heartbeats
- Scheduler for daily reports and weekly audits
- Command policy and RBAC checks
- Project container lifecycle
- SQLite database and migrations
- React/Vite dashboard
- Graphify run records and post-merge orchestration

### Crispy Adventure Owns

- Headless worker runtime
- LLM loop and tool-calling runtime
- Worker polling
- Local task execution inside a project container
- Safe command/git execution when Gatekeeper permits
- Reporting results back to Silver

### Project Repos Own

- Application source code
- Tests
- Project-specific docs
- Project git history
- `graphify-out/` outputs

## Target Stack

Keep v1 simple:

```text
Backend: Node.js + Express
Database: SQLite with WAL mode
Frontend: React + Vite
Container: Docker
Worker runtime: Crispy Adventure
Project isolation: one Docker container per project
Agents: many worker processes inside the project container
```

Do not prematurely introduce Kubernetes, distributed queues, remote cloud infrastructure, or multiple database services.

## Current Code Status

The current file CRUD API and single-file `server.js` are scaffolding only. They are not the final architecture.

It is acceptable to refactor from `server.js` into a structured backend such as:

```text
src/
  server.ts
  app.ts
  db/
  routes/
  services/
  policies/
  workers/
  containers/
  scheduler/
  prompts/
  ui/
```

Maintain working tests during refactors.

## Security Model

Silver uses layered zero-trust security:

```text
Host safety:
  Docker isolates project containers from the host.

Project isolation:
  One project container mounts only one project folder.

Agent identity:
  Every worker has one token mapped to one project, department, role, and agent.

RBAC:
  Every API operation checks permissions.

Command safety:
  Worker command requests are checked by policy before execution.

State safety:
  Workers never access SQLite directly.

Audit safety:
  Every important action becomes an event log.
```

Do not rely on container networking alone. Use bearer-token authentication from v1.

## Authentication Rules

- Every worker request must include `Authorization: Bearer <CRISPY_AGENT_TOKEN>`.
- Store only hashed token values in SQLite.
- Never log raw tokens.
- Tokens map to exactly one agent identity.
- Human dashboard auth can be simple in v1, but do not leave worker APIs unauthenticated.

## Project Isolation Rules

Agents working on Project-A must not read Project-B. Agents must not read the Silver repo.

The preferred v1 runtime is:

```text
Silver container/process
  owns DB and API

Project-A runtime container
  mounts only Projects/Project-A as /project
  runs all Project-A Crispy worker processes

Project-B runtime container
  mounts only Projects/Project-B as /project
  runs all Project-B Crispy worker processes
```

Do not mount the entire Silver workspace into a project container.

## Departments and Roles

Each project has four departments in v1:

- frontend
- backend
- infra
- deployment

Each department has these roles:

- CEO
- CTO
- Product Manager
- Project Manager
- Architect
- Tech Lead
- Engineer(s)
- Reviewer
- Tester
- Git Manager
- Weekly Audit Agent

Different departments may communicate only through approved same-role cross-team edges or hierarchy escalation.

## Role Responsibilities

### CEO

Owns customer alignment, business goal, priority, and high-level report quality. The CEO listens to the human customer and shares required context downstream.

### CTO

Owns technical strategy, feasibility, technology decisions, risks, and technical alignment. The CTO receives CEO context and provides technical direction to Architect/Project Manager/Product Manager as needed.

### Product Manager

Owns product requirements, user behavior, acceptance criteria, and customer-facing clarity.

### Project Manager

Owns Kanban structure, task lifecycle, timelines, dependencies, blockers, and progress reporting.

### Architect

Owns architecture spec, module boundaries, system design, infrastructure design, and Graphify-informed codebase understanding.

### Tech Lead

Owns ticket breakdown, branch names, todo lists, developer assignment, developer questions, and technical execution quality.

### Engineer

Implements assigned tickets on assigned branches, follows todo list strictly, self-reviews, and opens local PRs.

### Reviewer

Reviews PRs, catches bugs, improves quality, and may make small safe fixes when the task allows it.

### Tester

Runs tests, writes/updates tests when allowed, checks edge cases, and may make small safe fixes when the task allows it.

### Git Manager

Owns branch hygiene, local PR state, merge safety, tags/releases when added later, and Graphify post-merge runs.

### Weekly Audit Agent

Runs scheduled audits, writes markdown findings, and shares them with the Tech Lead. It does not create fix branches in v1.

## Human Communication Rules

The human customer can communicate directly with:

- Department CEO
- Department CTO
- Department Product Manager

Lower roles must not ask the human directly. They ask their upstream role.

Initial project intake is a meeting with department CEOs, CTOs, and Product Managers. They ask MCQ and note-style questions until alignment is strong enough to create planning artifacts.

## Messaging Rules

Inside one department:

```text
Engineer -> Tech Lead
Reviewer -> Tech Lead
Tester -> Tech Lead
Git Manager -> Tech Lead / Project Manager
Tech Lead -> Architect / Project Manager
Architect -> CTO
Project Manager -> Product Manager / CTO
Product Manager -> CEO / CTO / Human
CTO -> CEO / Human
CEO -> Human
```

Across departments, same-role communication is allowed for coordination:

```text
Frontend CTO <-> Backend CTO
Frontend Product Manager <-> Backend Product Manager
Frontend Architect <-> Backend Architect
Frontend Tech Lead <-> Backend Tech Lead
```

Developers do not have cross-department direct messaging. They escalate to Tech Leads.

All messages are stored in conversations and rendered later as chat windows in the UI.

## Task Lifecycle

Use this primary lifecycle:

```text
backlog -> ready -> assigned -> in_progress -> review -> testing -> done
```

Use metadata for finer state:

```text
review_status: pending | changes_requested | approved
test_status: pending | failed | passed
merge_status: not_ready | ready_to_merge | merged
pipeline_iteration: number
```

Prevent infinite loops. Recommended v1 loop control:

```text
Reviewer correction cycles: max 2
Tester production-code fix re-checks: max 1 reviewer re-check
After limit: escalate to Tech Lead and create/flag a follow-up bug ticket
```

## Git and Local PR Workflow

V1 uses local Silver PR objects, not mandatory GitHub/GitLab integration.

Required flow:

```text
Tech Lead assigns ticket with exact branch name and base branch
Engineer creates branch
Engineer implements ticket
Engineer self-reviews
Engineer opens Silver local PR
Reviewer reviews and may make small fixes
Tester tests and may make small fixes
If Tester changed production code, Reviewer re-checks once
Git Manager verifies approvals/checks and merges
Graphify runs after merge
Task becomes done
```

Do not let engineers merge main.

## Context Model

Do not use one giant mutable context blob.

Store dynamic context as typed, versioned artifacts:

- customer_brief
- ceo_analysis
- cto_strategy
- product_requirements
- acceptance_criteria
- architecture_spec
- risk_register
- milestone_plan
- implementation_plan
- ticket_todo_list
- decision_record
- blocker_report
- implementation_report
- self_review
- review_report
- test_report
- daily_report
- weekly_audit_report

Each artifact should include:

```text
project_id
department_id
author_agent_id
role
artifact_type
title
body
version
supersedes_artifact_id
related_task_id
related_pr_id
visibility
created_at
```

When an upper role changes context, create a new artifact revision and notify downstream roles. Do not overwrite history silently.

## Prompt Assembly

Silver should assemble worker prompt payloads in this order:

```text
1. Static company and role prompt
2. Department identity
3. Agent identity/name
4. Allowed tools and permissions
5. Communication rules
6. Project universal context
7. Latest approved upstream artifacts
8. Current Kanban ticket
9. Ticket todo list
10. Relevant Graphify/codebase context
11. Recent related messages
12. Dopamine text
13. Required output schema
```

Static role prompts can live in markdown templates and/or database seed data. Dynamic context must come from database artifacts, task records, messages, Graphify output, and git state.

## Dopamine

Dopamine is prompt-only motivational feedback. It must not be used for auth, RBAC, or scheduling in v1.

Store dopamine events in a ledger for display and prompt inclusion.

## Graphify Integration

Graphify is used as the codebase context map for technical roles.

V1 rules:

- Commit `graphify-out/` inside each project.
- Run Graphify after merge to main.
- Run Graphify before large architecture tasks when requested.
- Store graphify run metadata in Silver.
- Use Graphify output as context, not as a replacement for tests or review.

## Weekly Audit

Weekly Audit Agents run on a schedule configured in Silver.

They should:

- inspect main branch/project state through allowed tools
- find security issues, edge cases, vulnerabilities, drift, failing assumptions, stale tests, dependency risks
- create a markdown audit report artifact
- notify the Tech Lead
- suggest tickets

They should not create fix branches in v1.

## API Design Rules

- All worker APIs require bearer auth.
- All state transitions must validate RBAC.
- All task transitions must validate lifecycle.
- All message sends must validate message edges.
- All command checks must validate role, task, cwd, command, and reason.
- Return structured errors.
- Prefer idempotency keys for state-changing worker calls.
- Log events for important actions.

## UI Requirements

V1 dashboard should include:

- Project selector
- Department selector
- Human meeting room
- Kanban board
- Agent status/heartbeat page
- Task detail page
- Local PR page
- Conversation viewer
- Context/artifact viewer
- Daily report page
- Weekly audit report page
- Model/API-key settings

## Local Database Rules

Use SQLite with WAL mode in v1.

Use migrations. Do not create tables ad hoc inside route handlers.

Do not let workers access the database file. All worker operations go through APIs.

## Coding Conventions

- Keep backend services separated by domain: tasks, agents, messages, RBAC, context, PRs, containers, scheduler, prompts.
- Keep route handlers thin.
- Write tests for RBAC and lifecycle transitions.
- Use explicit typed objects where possible.
- Never add authless worker endpoints.
- Never bypass path/project isolation for convenience.
- Avoid implementing permanent business logic in the UI only; backend must enforce rules.

## Common Commands

```bash
npm install
npm start
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check

docker build -t silver-computing-machine -f .devcontainer/Dockerfile .
docker run -it --rm -p 4000:4000 -v $(pwd):/workspace silver-computing-machine
```

Commands may change as the repo moves from scaffolding to structured backend/frontend. Update this file when commands change.

## Definition Of Done

A change in this repo is done only when:

1. Worker APIs remain authenticated.
2. RBAC is enforced in the backend, not only in the UI.
3. Project isolation is preserved.
4. State changes create audit events.
5. Task lifecycle rules are tested.
6. Message hierarchy rules are tested.
7. No worker can directly access SQLite.
8. No project container mounts another project or the Silver repo.
9. UI changes reflect backend state accurately.
10. Documentation and seed data are updated when roles, permissions, or workflows change.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
