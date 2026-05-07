# Graph Report - . (2026-05-07)

## Corpus Check

- 187 files · ~53,203 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 613 nodes · 903 edges · 70 communities (68 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 68|Community 68]]

## God Nodes (most connected - your core abstractions)

1. `generateId()` - 71 edges
2. `createApp()` - 28 edges
3. `createTestApp()` - 21 edges
4. `insertTestAgent()` - 21 edges
5. `hashToken()` - 13 edges
6. `createTestDb()` - 13 edges
7. `createSeededTestDb()` - 13 edges
8. `MockRuntimeManager` - 12 edges
9. `generateToken()` - 9 edges
10. `withTransaction()` - 6 edges

## Surprising Connections (you probably didn't know these)

- `insertApprovedArtifact()` --calls--> `generateId()` [EXTRACTED]
  tests/tasks.test.js → src/db/helpers.js
- `insertTask()` --calls--> `generateId()` [EXTRACTED]
  tests/tasks.test.js → src/db/helpers.js
- `createTestApp()` --calls--> `loadConfig()` [EXTRACTED]
  tests/helpers.js → src/config.js
- `insertTestAgent()` --calls--> `generateId()` [EXTRACTED]
  tests/helpers.js → src/db/helpers.js
- `insertTestProject()` --calls--> `generateId()` [EXTRACTED]
  tests/intake-alignment.test.js → src/db/helpers.js

## Communities (70 total, 2 thin omitted)

### Community 0 - "Community 0"

Cohesion: 0.05
Nodes (45): createAgent(), rotateAgentToken(), createDefaultAgents(), DEFAULT_DEPARTMENTS, fs, { generateId, withTransaction }, { generateToken, hashToken }, path (+37 more)

### Community 1 - "Community 1"

Cohesion: 0.06
Nodes (32): bearerAuth(), { findAgentByTokenHash }, { hashToken }, { assemblePrompt }, {
createAgent,
rotateAgentToken,
revokeAgent,
listAgents,
getAgent,
}, createAgentsRouter(), express, { updateHeartbeat } (+24 more)

### Community 2 - "Community 2"

Cohesion: 0.05
Nodes (37): activeNodes, { assemblePrompt }, bundle, ceoTemplate, { createRoleGraphPolicy }, { createSeededTestDb, createTestApp, insertTestAgent }, crypto, ctoTemplate (+29 more)

### Community 3 - "Community 3"

Cohesion: 0.07
Nodes (29): closeDatabase(), createDatabase(), Database, fs, path, resetForTesting(), runMigrations(), app (+21 more)

### Community 4 - "Community 4"

Cohesion: 0.07
Nodes (30): createFilesRouter(), express, fs, path, { safePath }, isWithinProject(), path, safePath() (+22 more)

### Community 5 - "Community 5"

Cohesion: 0.08
Nodes (24): runSeeds(), createSeededTestDb(), agent, { createSeededTestDb, createTestApp, insertTestAgent }, eng, { generateId }, keys, newPerms (+16 more)

### Community 6 - "Community 6"

Cohesion: 0.08
Nodes (25): { bearerAuth }, { createAgentsRouter }, { createAlignmentReviewsRouter }, { createAlignmentSessionsRouter }, { createAuditsRouter }, { createClarificationRouter }, { createContextArtifactsRouter }, { createDocumentSetsRouter } (+17 more)

### Community 7 - "Community 7"

Cohesion: 0.1
Nodes (22): approvalId, artifactId, artifactTypes, { createSeededTestDb, createTestApp, insertTestAgent }, { generateId }, insertTestDepartment(), insertTestHuman(), insertTestProject() (+14 more)

### Community 8 - "Community 8"

Cohesion: 0.1
Nodes (19): agents, allArtifacts, allPrs, allTasks, auditArtifact, ceoTokenEntry, { createProject }, { createSeededTestDb, createTestApp } (+11 more)

### Community 9 - "Community 9"

Cohesion: 0.11
Nodes (18): acId, createArtifactViaApi(), { createSeededTestDb, createTestApp, insertTestAgent }, draftId, { generateId }, newId, oldArtifact, oldId (+10 more)

### Community 10 - "Community 10"

Cohesion: 0.12
Nodes (7): { createProject }, createProjectsRouter(), express, { MockRuntimeManager }, createProject(), MockRuntimeManager, { MockRuntimeManager }

### Community 11 - "Community 11"

Cohesion: 0.14
Nodes (12): ALLOWED_TRANSITIONS, claimTask(), completeTask(), createTask(), createTaskEvent(), failTask(), { generateId }, isPipelineIncrementingTransition() (+4 more)

### Community 12 - "Community 12"

Cohesion: 0.17
Nodes (10): createRoleTemplatesRouter(), express, { generateId }, { importRoleLibrary }, path, crypto, fs, { generateId } (+2 more)

### Community 13 - "Community 13"

Cohesion: 0.17
Nodes (11): loadConfig(), path, { createApp }, Database, { generateId }, { generateToken, hashToken }, { loadConfig }, migrations (+3 more)

### Community 14 - "Community 14"

Cohesion: 0.23
Nodes (11): generateId(), { generateId }, run(), insertTestAlignmentSession(), insertTestHuman(), insertTestProject(), setupFull(), addEdge() (+3 more)

### Community 15 - "Community 15"

Cohesion: 0.2
Nodes (7): crypto, { generateId }, PROFILES, run(), { generateId }, ROLES, run()

### Community 16 - "Community 16"

Cohesion: 0.27
Nodes (9): { createTestDb, createTestApp, insertTestAgent }, heartbeats, request, result, setupAuthApp(), createTestApp(), insertTestAgent(), setupAuthApp() (+1 more)

### Community 17 - "Community 17"

Cohesion: 0.2
Nodes (9): agent, artifact, { createTestDb, createTestApp, insertTestAgent }, deptId, { generateId }, messages, request, roleInstanceId (+1 more)

### Community 18 - "Community 18"

Cohesion: 0.22
Nodes (7): createHealthRouter(), express, createProblemStatementsRouter(), express, { generateId }, createApp(), express

### Community 19 - "Community 19"

Cohesion: 0.28
Nodes (6): canCommunicateWithHuman(), canMessage(), { generateId }, HUMAN_FACING_ROLES, sendMessage(), VALID_MESSAGE_TYPES

### Community 20 - "Community 20"

Cohesion: 0.25
Nodes (5): createGraphifyRun(), { execFileSync }, fs, { generateId }, path

### Community 21 - "Community 21"

Cohesion: 0.25
Nodes (6): { createTestDb, createTestApp, insertTestAgent }, request, { token }, { createTestDb, createTestApp }, request, createTestDb()

### Community 22 - "Community 22"

Cohesion: 0.43
Nodes (5): withTransaction(), createAuditRun(), generateAuditReportContent(), { generateId, withTransaction }, notifyTechLead()

### Community 23 - "Community 23"

Cohesion: 0.29
Nodes (6): { createSeededTestDb, createTestApp, insertTestAgent }, keys, profile, profiles, request, result

### Community 24 - "Community 24"

Cohesion: 0.29
Nodes (6): applied, columns, { createTestDb }, EXPECTED_TABLES, info, tables

### Community 25 - "Community 25"

Cohesion: 0.29
Nodes (6): agent, { createTestDb, createTestApp, insertTestAgent }, deptId, { generateId }, request, taskId

### Community 26 - "Community 26"

Cohesion: 0.33
Nodes (5): createContextArtifactsRouter(), express, { generateId }, VALID_ARTIFACT_TYPES, VALID_LIFECYCLE_STAGES

### Community 28 - "Community 28"

Cohesion: 0.4
Nodes (4): createAlignmentSessionsRouter(), express, { generateId }, LEADERSHIP_ROLES

### Community 29 - "Community 29"

Cohesion: 0.5
Nodes (3): createDailyReport(), generateDailyReportContent(), { generateId }

### Community 30 - "Community 30"

Cohesion: 0.4
Nodes (4): agent, appMissing, { createTestDb, createTestApp, insertTestAgent }, request

### Community 31 - "Community 31"

Cohesion: 0.5
Nodes (3): createClarificationRouter(), express, { generateId }

### Community 32 - "Community 32"

Cohesion: 0.5
Nodes (3): createTasksRouter(), express, taskService

### Community 33 - "Community 33"

Cohesion: 0.5
Nodes (3): createMessagesRouter(), express, messageService

### Community 34 - "Community 34"

Cohesion: 0.5
Nodes (3): createPermissionProfilesRouter(), express, { generateId }

### Community 35 - "Community 35"

Cohesion: 0.5
Nodes (3): createGraphifyRouter(), express, graphifyService

### Community 36 - "Community 36"

Cohesion: 0.5
Nodes (3): createDocumentSetsRouter(), express, { generateId }

### Community 37 - "Community 37"

Cohesion: 0.5
Nodes (3): createLocalPrsRouter(), express, prService

### Community 38 - "Community 38"

Cohesion: 0.5
Nodes (3): createReportsRouter(), express, reportService

### Community 39 - "Community 39"

Cohesion: 0.5
Nodes (3): createHumanApprovalsRouter(), express, { generateId }

### Community 40 - "Community 40"

Cohesion: 0.5
Nodes (3): createRoleEdgesRouter(), express, { generateId }

### Community 41 - "Community 41"

Cohesion: 0.5
Nodes (3): createAlignmentReviewsRouter(), express, { generateId }

### Community 42 - "Community 42"

Cohesion: 0.5
Nodes (3): createResearchNotesRouter(), express, { generateId }

### Community 43 - "Community 43"

Cohesion: 0.5
Nodes (3): createModelProfilesRouter(), express, { generateId }

### Community 44 - "Community 44"

Cohesion: 0.5
Nodes (3): auditService, createAuditsRouter(), express

### Community 45 - "Community 45"

Cohesion: 0.5
Nodes (3): createRoleNodesRouter(), express, { generateId }

### Community 46 - "Community 46"

Cohesion: 0.5
Nodes (3): { generateId }, PROFILES, run()

### Community 47 - "Community 47"

Cohesion: 0.67
Nodes (3): createApp(), express, request

## Knowledge Gaps

- **371 isolated node(s):** `path`, `{ createHealthRouter }`, `{ createFilesRouter }`, `{ createAgentsRouter }`, `{ createTasksRouter }` (+366 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `generateId()` connect `Community 14` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 22`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 31`, `Community 34`, `Community 36`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 45`, `Community 46`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Why does `insertTestAgent()` connect `Community 16` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 13`, `Community 14`, `Community 17`, `Community 21`, `Community 23`, `Community 25`, `Community 30`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `createTestApp()` connect `Community 16` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 13`, `Community 17`, `Community 21`, `Community 23`, `Community 25`, `Community 30`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `path`, `{ createHealthRouter }`, `{ createFilesRouter }` to the rest of the system?**
  _371 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
