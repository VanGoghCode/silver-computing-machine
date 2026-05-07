# Graph Report - . (2026-05-06)

## Corpus Check

- Corpus is ~6,538 words - fits in a single context window. You may not need a graph.

## Summary

- 96 nodes · 62 edges · 41 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Platform Policy & Security|Platform Policy & Security]]
- [[_COMMUNITY_Database Connection|Database Connection]]
- [[_COMMUNITY_Test Infrastructure|Test Infrastructure]]
- [[_COMMUNITY_DB Helpers|DB Helpers]]
- [[_COMMUNITY_Agent Service|Agent Service]]
- [[_COMMUNITY_Path Safety|Path Safety]]
- [[_COMMUNITY_Old Graph Report|Old Graph Report]]
- [[_COMMUNITY_App Factory|App Factory]]
- [[_COMMUNITY_Config|Config]]
- [[_COMMUNITY_Migration Runner|Migration Runner]]
- [[_COMMUNITY_Seed Runner|Seed Runner]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Migration Projects|Migration: Projects]]
- [[_COMMUNITY_Migration Humans|Migration: Humans]]
- [[_COMMUNITY_Migration Departments|Migration: Departments]]
- [[_COMMUNITY_Migration Model Profiles|Migration: Model Profiles]]
- [[_COMMUNITY_Migration Permission Profiles|Migration: Permission Profiles]]
- [[_COMMUNITY_Migration Role Templates|Migration: Role Templates]]
- [[_COMMUNITY_Migration Role Prompt Files|Migration: Role Prompt Files]]
- [[_COMMUNITY_Migration Role Instances|Migration: Role Instances]]
- [[_COMMUNITY_Migration Role Edges|Migration: Role Edges]]
- [[_COMMUNITY_Migration Agents|Migration: Agents]]
- [[_COMMUNITY_Migration Heartbeats|Migration: Heartbeats]]
- [[_COMMUNITY_Route Agents|Route: Agents]]
- [[_COMMUNITY_Route Files|Route: Files]]
- [[_COMMUNITY_Route Health|Route: Health]]
- [[_COMMUNITY_Route Tasks|Route: Tasks]]
- [[_COMMUNITY_Seed Human Owner|Seed: Human Owner]]
- [[_COMMUNITY_Seed Model Profiles|Seed: Model Profiles]]
- [[_COMMUNITY_Seed Permission Profiles|Seed: Permission Profiles]]
- [[_COMMUNITY_Seed Role Templates|Seed: Role Templates]]
- [[_COMMUNITY_Server Test|Server Test]]
- [[_COMMUNITY_Jest Config|Jest Config]]
- [[_COMMUNITY_Server Entry|Server Entry]]
- [[_COMMUNITY_Test Agents|Test: Agents]]
- [[_COMMUNITY_Test Auth|Test: Auth]]
- [[_COMMUNITY_Test DB|Test: DB]]
- [[_COMMUNITY_Test Health|Test: Health]]
- [[_COMMUNITY_Test Migrations|Test: Migrations]]
- [[_COMMUNITY_Test Path Safety|Test: Path Safety]]
- [[_COMMUNITY_Test Seeds|Test: Seeds]]

## God Nodes (most connected - your core abstractions)

1. `Silver Gatekeeper` - 11 edges
2. `Bearer Token Auth` - 4 edges
3. `Role Graph (Data-Driven)` - 3 edges
4. `Database Schema (11 Tables)` - 3 edges
5. `closeDatabase()` - 2 edges
6. `resetForTesting()` - 2 edges
7. `createTestDb()` - 2 edges
8. `createSeededTestDb()` - 2 edges
9. `RBAC Enforcement` - 2 edges
10. `Path Safety & Project Isolation` - 2 edges

## Surprising Connections (you probably didn't know these)

- `Silver Platform Overview` --semantically_similar_to--> `Silver Gatekeeper` [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `God Nodes (Core Abstractions)` --references--> `Silver Gatekeeper` [INFERRED]
  graphify-out/GRAPH_REPORT.md → CLAUDE.md
- `Human Local-Owner Auth` --conceptually_related_to--> `Bearer Token Auth` [INFERRED]
  README.md → CLAUDE.md
- `API Endpoints` --references--> `Bearer Token Auth` [EXTRACTED]
  README.md → CLAUDE.md
- `Database Schema (11 Tables)` --references--> `Role Graph (Data-Driven)` [EXTRACTED]
  README.md → CLAUDE.md

## Hyperedges (group relationships)

- **Security Stack (Auth + RBAC + Path Safety)** — claude_bearer_auth, claude_rbac, claude_path_safety [EXTRACTED 1.00]

## Communities

### Community 0 - "Platform Policy & Security"

Cohesion: 0.17
Nodes (15): Bearer Token Auth, Coding Conventions, Crispy Adventure Worker Runtime, Graphify Integration, No Guessing Rule, Path Safety & Project Isolation, RBAC Enforcement, Role Graph (Data-Driven) (+7 more)

### Community 1 - "Database Connection"

Cohesion: 0.5
Nodes (2): closeDatabase(), resetForTesting()

### Community 2 - "Test Infrastructure"

Cohesion: 0.5
Nodes (2): createSeededTestDb(), createTestDb()

### Community 3 - "DB Helpers"

Cohesion: 0.67
Nodes (0):

### Community 4 - "Agent Service"

Cohesion: 0.67
Nodes (0):

### Community 5 - "Path Safety"

Cohesion: 0.67
Nodes (0):

### Community 6 - "Old Graph Report"

Cohesion: 0.67
Nodes (3): God Nodes (Core Abstractions), Hyperedges (Group Relationships), Old Graph Summary (61 nodes)

### Community 7 - "App Factory"

Cohesion: 1.0
Nodes (0):

### Community 8 - "Config"

Cohesion: 1.0
Nodes (0):

### Community 9 - "Migration Runner"

Cohesion: 1.0
Nodes (0):

### Community 10 - "Seed Runner"

Cohesion: 1.0
Nodes (0):

### Community 11 - "Auth Middleware"

Cohesion: 1.0
Nodes (0):

### Community 12 - "Migration: Projects"

Cohesion: 1.0
Nodes (0):

### Community 13 - "Migration: Humans"

Cohesion: 1.0
Nodes (0):

### Community 14 - "Migration: Departments"

Cohesion: 1.0
Nodes (0):

### Community 15 - "Migration: Model Profiles"

Cohesion: 1.0
Nodes (0):

### Community 16 - "Migration: Permission Profiles"

Cohesion: 1.0
Nodes (0):

### Community 17 - "Migration: Role Templates"

Cohesion: 1.0
Nodes (0):

### Community 18 - "Migration: Role Prompt Files"

Cohesion: 1.0
Nodes (0):

### Community 19 - "Migration: Role Instances"

Cohesion: 1.0
Nodes (0):

### Community 20 - "Migration: Role Edges"

Cohesion: 1.0
Nodes (0):

### Community 21 - "Migration: Agents"

Cohesion: 1.0
Nodes (0):

### Community 22 - "Migration: Heartbeats"

Cohesion: 1.0
Nodes (0):

### Community 23 - "Route: Agents"

Cohesion: 1.0
Nodes (0):

### Community 24 - "Route: Files"

Cohesion: 1.0
Nodes (0):

### Community 25 - "Route: Health"

Cohesion: 1.0
Nodes (0):

### Community 26 - "Route: Tasks"

Cohesion: 1.0
Nodes (0):

### Community 27 - "Seed: Human Owner"

Cohesion: 1.0
Nodes (0):

### Community 28 - "Seed: Model Profiles"

Cohesion: 1.0
Nodes (0):

### Community 29 - "Seed: Permission Profiles"

Cohesion: 1.0
Nodes (0):

### Community 30 - "Seed: Role Templates"

Cohesion: 1.0
Nodes (0):

### Community 31 - "Server Test"

Cohesion: 1.0
Nodes (0):

### Community 32 - "Jest Config"

Cohesion: 1.0
Nodes (0):

### Community 33 - "Server Entry"

Cohesion: 1.0
Nodes (0):

### Community 34 - "Test: Agents"

Cohesion: 1.0
Nodes (0):

### Community 35 - "Test: Auth"

Cohesion: 1.0
Nodes (0):

### Community 36 - "Test: DB"

Cohesion: 1.0
Nodes (0):

### Community 37 - "Test: Health"

Cohesion: 1.0
Nodes (0):

### Community 38 - "Test: Migrations"

Cohesion: 1.0
Nodes (0):

### Community 39 - "Test: Path Safety"

Cohesion: 1.0
Nodes (0):

### Community 40 - "Test: Seeds"

Cohesion: 1.0
Nodes (0):

## Knowledge Gaps

- **7 isolated node(s):** `Crispy Adventure Worker Runtime`, `No Guessing Rule`, `Coding Conventions`, `Graphify Integration`, `Silver Platform Overview` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Factory`** (2 nodes): `createApp()`, `app.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Config`** (2 nodes): `loadConfig()`, `config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration Runner`** (2 nodes): `runMigrations()`, `migrate.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed Runner`** (2 nodes): `runSeeds()`, `seed.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Middleware`** (2 nodes): `bearerAuth()`, `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Projects`** (2 nodes): `up()`, `001_projects.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Humans`** (2 nodes): `up()`, `002_humans.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Departments`** (2 nodes): `up()`, `003_departments.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Model Profiles`** (2 nodes): `up()`, `004_model_profiles.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Permission Profiles`** (2 nodes): `up()`, `005_permission_profiles.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Role Templates`** (2 nodes): `up()`, `006_role_templates.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Role Prompt Files`** (2 nodes): `up()`, `007_role_prompt_files.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Role Instances`** (2 nodes): `up()`, `008_project_role_instances.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Role Edges`** (2 nodes): `up()`, `009_role_edges.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Agents`** (2 nodes): `up()`, `010_agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Migration: Heartbeats`** (2 nodes): `up()`, `011_agent_heartbeats.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route: Agents`** (2 nodes): `createAgentsRouter()`, `agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route: Files`** (2 nodes): `createFilesRouter()`, `files.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route: Health`** (2 nodes): `createHealthRouter()`, `health.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route: Tasks`** (2 nodes): `tasks.js`, `createTasksRouter()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed: Human Owner`** (2 nodes): `run()`, `human_local_owner.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed: Model Profiles`** (2 nodes): `run()`, `model_profiles.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed: Permission Profiles`** (2 nodes): `run()`, `permission_profiles.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed: Role Templates`** (2 nodes): `run()`, `role_templates.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Server Test`** (2 nodes): `createApp()`, `server.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Jest Config`** (1 nodes): `jest.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Server Entry`** (1 nodes): `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: Agents`** (1 nodes): `agents.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: Auth`** (1 nodes): `auth.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: DB`** (1 nodes): `db.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: Health`** (1 nodes): `health.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: Migrations`** (1 nodes): `migrations.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: Path Safety`** (1 nodes): `path_safety.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test: Seeds`** (1 nodes): `seeds.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `Silver Gatekeeper` connect `Platform Policy & Security` to `Old Graph Report`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `God Nodes (Core Abstractions)` connect `Old Graph Report` to `Platform Policy & Security`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Silver Gatekeeper` (e.g. with `Silver Platform Overview` and `God Nodes (Core Abstractions)`) actually correct?**
  _`Silver Gatekeeper` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Bearer Token Auth` (e.g. with `Path Safety & Project Isolation` and `Human Local-Owner Auth`) actually correct?**
  _`Bearer Token Auth` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Crispy Adventure Worker Runtime`, `No Guessing Rule`, `Coding Conventions` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
