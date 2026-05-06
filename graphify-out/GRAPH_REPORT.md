# Graph Report - . (2026-05-05)

## Corpus Check

- Corpus is ~2,560 words - fits in a single context window. You may not need a graph.

## Summary

- 61 nodes · 108 edges · 10 communities detected
- Extraction: 71% EXTRACTED · 29% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Security & Isolation|Security & Isolation]]
- [[_COMMUNITY_Engineering Workflow|Engineering Workflow]]
- [[_COMMUNITY_Backend Stack|Backend Stack]]
- [[_COMMUNITY_Leadership & Strategy|Leadership & Strategy]]
- [[_COMMUNITY_Dashboard & Audit|Dashboard & Audit]]
- [[_COMMUNITY_Departments|Departments]]
- [[_COMMUNITY_Prompt Assembly|Prompt Assembly]]
- [[_COMMUNITY_Server Core|Server Core]]
- [[_COMMUNITY_Test Suite|Test Suite]]
- [[_COMMUNITY_Test Configuration|Test Configuration]]

## God Nodes (most connected - your core abstractions)

1. `Silver-Computing-Machine (Gatekeeper)` - 23 edges
2. `Local PR Workflow` - 10 edges
3. `Tech Lead` - 9 edges
4. `Typed Versioned Context Artifacts` - 8 edges
5. `V1 Dashboard UI` - 7 edges
6. `Department CTO` - 6 edges
7. `Task Lifecycle (backlog -> done)` - 6 edges
8. `Graphify Integration` - 6 edges
9. `Zero-Trust Security Model` - 5 edges
10. `RBAC (Role-Based Access Control)` - 5 edges

## Surprising Connections (you probably didn't know these)

- `File CRUD API Endpoints` --semantically_similar_to--> `Node.js + Express Backend` [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `server.js (Current Entry Point)` --semantically_similar_to--> `server.js (Scaffolding)` [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Projects/ Directory (Agent Workspace)` --implements--> `Project Isolation (Docker)` [INFERRED]
  README.md → CLAUDE.md

## Hyperedges (group relationships)

- **Local PR Review Pipeline (Engineer -> Reviewer -> Tester -> Git Manager)** — claude_role_engineer, claude_role_reviewer, claude_role_tester, claude_role_gitmgr, claude_local_pr_workflow, claude_task_lifecycle [EXTRACTED 1.00]
- **Hierarchical Communication Flow (Human -> CEO -> CTO -> Architect/Tech Lead -> Engineers)** — claude_human_customer, claude_role_ceo, claude_role_cto, claude_role_pm, claude_role_architect, claude_role_techlead, claude_role_engineer, claude_messaging_hierarchy [EXTRACTED 1.00]
- **Layered Zero-Trust Security (Docker Isolation + RBAC + Bearer Auth + Audit Trail)** — claude_project_isolation, claude_rbac, claude_bearer_auth, claude_audit_trail, claude_zero_trust_security, claude_command_policy [EXTRACTED 1.00]

## Communities

### Community 0 - "Security & Isolation"

Cohesion: 0.25
Nodes (14): Audit Trail (Event Logging), Command Safety Policy, Crispy Adventure (Worker Runtime), Cross-Department Same-Role Communication, Docker Containerization, Human Communication Rules, Idempotency Keys for State Changes, Messaging Hierarchy Rules (+6 more)

### Community 1 - "Engineering Workflow"

Cohesion: 0.32
Nodes (13): Graphify Integration, Local PR Workflow, Loop Control (Max Correction Cycles), Rationale: Graphify As Context Not Replacement, Rationale: Engineers Must Not Merge Main, Architect, Engineer, Git Manager (+5 more)

### Community 2 - "Backend Stack"

Cohesion: 0.18
Nodes (11): Bearer Token Authentication, Node.js + Express Backend, Rationale: Bearer Auth Over Container Networking, Rationale: Keep V1 Simple (No K8s), server.js (Scaffolding), SQLite with WAL Mode, Structured Backend (src/ target), File CRUD API Endpoints (+3 more)

### Community 3 - "Leadership & Strategy"

Cohesion: 0.67
Nodes (6): Typed Versioned Context Artifacts, Human Customer, Rationale: No Giant Mutable Context Blob, Department CEO, Department CTO, Product Manager

### Community 4 - "Dashboard & Audit"

Cohesion: 0.4
Nodes (5): React + Vite Frontend, Weekly Audit Agent, Scheduler (Daily Reports, Weekly Audits), V1 Dashboard UI, Weekly Audit Process

### Community 5 - "Departments"

Cohesion: 1.0
Nodes (4): Backend Department, Deployment Department, Frontend Department, Infra Department

### Community 6 - "Prompt Assembly"

Cohesion: 0.67
Nodes (3): Dopamine Ledger (Motivational Feedback), Prompt Assembly Pipeline, Rationale: Dopamine Is Prompt-Only (Not Auth/RBAC)

### Community 7 - "Server Core"

Cohesion: 1.0
Nodes (0):

### Community 8 - "Test Suite"

Cohesion: 1.0
Nodes (0):

### Community 9 - "Test Configuration"

Cohesion: 1.0
Nodes (0):

## Knowledge Gaps

- **10 isolated node(s):** `Structured Backend (src/ target)`, `Idempotency Keys for State Changes`, `Rationale: No Giant Mutable Context Blob`, `Rationale: Engineers Must Not Merge Main`, `Rationale: Bearer Auth Over Container Networking` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Server Core`** (2 nodes): `server.js`, `safePath()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Suite`** (2 nodes): `createApp()`, `server.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Configuration`** (1 nodes): `jest.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `Silver-Computing-Machine (Gatekeeper)` connect `Security & Isolation` to `Engineering Workflow`, `Backend Stack`, `Leadership & Strategy`, `Dashboard & Audit`, `Prompt Assembly`?**
  _High betweenness centrality (0.494) - this node is a cross-community bridge._
- **Why does `Node.js + Express Backend` connect `Backend Stack` to `Security & Isolation`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Local PR Workflow` (e.g. with `Task Lifecycle (backlog -> done)` and `V1 Dashboard UI`) actually correct?**
  _`Local PR Workflow` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Typed Versioned Context Artifacts` (e.g. with `SQLite with WAL Mode` and `V1 Dashboard UI`) actually correct?**
  _`Typed Versioned Context Artifacts` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `V1 Dashboard UI` (e.g. with `React + Vite Frontend` and `Task Lifecycle (backlog -> done)`) actually correct?**
  _`V1 Dashboard UI` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Structured Backend (src/ target)`, `Idempotency Keys for State Changes`, `Rationale: No Giant Mutable Context Blob` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
