# Silver-Computing-Machine — Project Truth File

## Purpose

This repository is the control plane for a managed AI engineering swarm.

It exists to coordinate autonomous coding agents, human collaboration, versioned documentation, approvals, task execution, context management, and project isolation.

This file defines the permanent intent of the system. It should remain stable across versions and should not be filled with changing implementation details.

Technical details such as folder structure, endpoints, database tables, runtime commands, and module paths belong in `README.md` and may evolve over time.

---

## Vision

Build a secure, human-aligned AI company that can plan, research, document, implement, review, test, audit, and ship software in a controlled and traceable way.

The system should behave like a real engineering organization, with roles, hierarchy, responsibilities, approvals, and careful handoffs.

---

## Mission

Create a platform where:

- a human can present a problem
- AI roles can brainstorm and ask clarifying questions
- research and documentation happen continuously
- requirements are versioned and approved
- execution happens only from aligned source-of-truth documents
- work is tracked through tasks, reviews, tests, and approvals
- every decision remains auditable
- no role has more power than it should

---

## End Product

The end product should feel like a real company operating around a human customer.

It should support:

- multiple departments
- multiple roles per department
- strict role hierarchy
- controlled cross-role communication
- versioned context and documents
- alignment sessions between human and AI
- task planning and execution
- code review and testing
- local PR-style tracking
- audit and daily reporting
- project isolation
- traceable approval flow

The human should always be able to understand:

- what the AI thinks
- what the AI knows
- what is still unclear
- what has been approved
- what is being worked on
- what is blocked
- what changed over time

---

## Core Principles

### 1. No guessing

AI agents must not invent requirements when something is unclear.

If the system does not know something, it must ask upward in the hierarchy or ask the human through the allowed path.

### 2. Version everything important

Any important decision, requirement, clarification, review note, or research result must be stored as a versioned artifact.

Never silently overwrite meaningful context.

### 3. Human alignment comes first

Work should not begin from assumptions.

The system must support repeated human-AI alignment cycles until both sides are on the same page.

### 4. Every role has a reason to exist

Each role should have a clear purpose, responsibility, and communication boundary.

No role should be overloaded with too many unrelated responsibilities.

### 5. Source of truth must be clear

The system should always know which document, artifact, or approval is authoritative for the current stage of work.

### 6. Traceability matters

Every important action should be attributable to a human, a role, an agent, a task, or an artifact.

### 7. Security by design

Project isolation, access boundaries, and permission checks must be respected.

No agent should access more than it needs.

### 8. Build incrementally

Support MVP first, then v1, then v2, without losing the history of earlier versions.

### 9. Context must be structured

Context is not random memory. It is saved, versioned, linked, approved, and assembled deliberately.

### 10. The system should feel like a company

The structure should resemble a real team: leadership, planning, architecture, implementation, review, testing, release, audit, and human communication.

---

## Human-AI Alignment Loop

The human and AI team must work together in a repeating loop until requirements are clear.

The intended pattern is:

1. Human gives the problem statement
2. AI leadership reviews it
3. AI asks questions where needed
4. Human answers
5. AI updates documentation and research notes
6. AI reviews its own understanding
7. AI asks more questions if needed
8. Human answers again
9. Repeat until alignment is complete
10. Versioned documents are approved
11. Only then does engineering execution begin

This loop is essential.

The system must support multiple rounds of clarification and documentation, not just one pass.

---

## Documentation Philosophy

Documentation is part of the product.

Important documentation should exist in a versioned, reviewable form, such as:

- problem statement
- alignment notes
- clarification questions and answers
- research notes
- product requirements
- acceptance criteria
- architecture/specification documents
- implementation plans
- review notes
- test reports
- audit reports
- daily reports
- decision records
- open questions
- risk registers
- milestone plans

The human may ask for:

- MVP only
- MVP + v1
- MVP + v1 + v2
- deeper implementation later

The system must preserve this versioning and not collapse different stages into one untracked document.

---

## Versioning Rules

- Every major document should support version history.
- New knowledge should create a new revision or a new artifact when appropriate.
- Earlier versions should remain accessible for audit and rollback of understanding.
- Approved artifacts should be distinguishable from draft artifacts.
- Superseded content should remain traceable.
- Archived content should remain in history but should not drive new work by default.

---

## Role and Hierarchy Rules

Roles should behave like a real organization.

At a high level:

- Human owns the final product intent
- CEO coordinates customer alignment and top-level business understanding
- CTO coordinates technical strategy and feasibility
- Product Manager owns product meaning and requirements
- Project Manager owns work organization and progression
- Architect owns structural design
- Tech Lead owns breakdown into implementation work
- Engineer implements assigned work
- Reviewer checks quality and correctness
- Tester validates behavior and edge cases
- Git Manager keeps git flow safe and orderly
- Weekly Audit Agent checks for drift, security, and quality issues

Rules:

- Lower roles do not bypass higher roles.
- Questions should move upward through the proper hierarchy.
- Roles may communicate across departments only when allowed and useful.
- Same-level communication should be explicit and traceable.
- The human should not be overwhelmed with low-level questions.
- Only the approved escalation path should reach the human.

---

## Context Rules

Context should be organized and selective.

The system should support:

- static role context
- dynamic project context
- human-approved documents
- task-specific context
- message history
- review history
- test history
- audit history
- codebase understanding
- decision history

The system must ensure that different roles receive the context they need, not everything at once.

Important rules:

- static context should remain stable unless intentionally revised
- dynamic context should evolve as work evolves
- approved context should drive execution
- draft context should not silently become authoritative
- archived context should not be used as current truth unless explicitly requested

---

## Approval Rules

Approvals are not optional.

Important artifacts should be approved before downstream execution depends on them.

Examples:

- a problem statement can be submitted and then aligned
- a requirement document can be drafted and then approved
- a document set can be approved before engineering starts
- a review note can be accepted or rejected
- a task can be blocked until source-of-truth documents are approved

No engineer should have to guess what to build.

---

## Task and Execution Philosophy

Tasks should always connect back to approved source material.

A good task is:

- clearly scoped
- traceable to approved context
- tied to a branch or work unit when relevant
- testable
- reviewable
- reversible when needed

Execution should progress through a healthy workflow:

- backlog
- ready
- assigned
- in progress
- review
- testing
- done

The system should prevent chaotic movement between stages.

---

## Research and Documentation Philosophy

Research is not separate from execution.

AI should be able to:

- document what it found
- document what it still does not know
- link research to decisions
- revise understanding after new answers arrive

This should be normal and continuous, not a one-time step.

---

## Quality Standards

Work should follow these standards:

- be explicit
- be traceable
- be auditable
- be consistent
- be testable
- be reviewable
- be aligned with approved documents
- avoid unnecessary scope expansion
- avoid silent assumptions
- avoid hidden state
- avoid one-off behavior that cannot be explained later

---

## Safety and Isolation

The system should respect isolation boundaries.

- project data should remain project-scoped
- agents should only access what their role and project allow
- human-level access should be mediated through the proper roles
- security boundaries should be respected even when the workflow is convenient to bypass

Convenience must never override isolation.

---

## What This Repository Is Not

This repository is not:

- a place for random hardcoded business logic
- a place for hidden assumptions
- a place for undocumented shortcuts
- a place to bypass human alignment
- a place to store implementation details that belong in README
- a place to collapse all project versions into one undocumented state

---

## What Must Stay Constant

The following should stay constant throughout the project:

- human-first alignment
- versioned requirements
- traceable decisions
- role hierarchy
- approval gates
- context management discipline
- secure isolation
- incremental delivery
- MVP/v1/v2 stage awareness
- no guessing
- no silent overwrite
- no bypassing the hierarchy

---

## When Working in This Repo

Always ask:

- Is this aligned with the human?
- Is the context approved?
- Is the requirement versioned?
- Is the role hierarchy respected?
- Is the work traceable?
- Is the change safe?
- Is this detail stable enough for CLAUDE.md, or should it live in README?

If it is technical, operational, structural, or changing frequently, put it in README.

If it is philosophical, behavioral, or permanent, keep it here.

---

## Final Rule

Do not let implementation details pollute this file.

This file defines the purpose, behavior, and permanent operating philosophy of Silver-Computing-Machine.

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

| Variable                   | Default                   | Description                    |
| -------------------------- | ------------------------- | ------------------------------ |
| `PORT`                     | `4000`                    | Server port                    |
| `WORKSPACE_DIR`            | `/workspace`              | Workspace root                 |
| `PROJECTS_DIR`             | `$WORKSPACE_DIR/Projects` | Project directories            |
| `SQLITE_DB_PATH`           | `./data/silver.db`        | SQLite database path           |
| `AGENT_HEARTBEAT_STALE_MS` | `60000`                   | Stale heartbeat threshold (ms) |

## Graphify

This project has a graphify knowledge graph at `graphify-out/`.

- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md`.
- After modifying code, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current.
