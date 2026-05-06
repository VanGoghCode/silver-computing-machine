## What This Is

This repo is the **sandbox orchestrator** for AI coding agents. It provides the outer security layer — agents live inside `Projects/` subdirectories and can only interact with files within this container. Nothing outside this workspace is accessible to them.

### The Vision

A fully managed, hierarchy-driven **AI Swarm** where autonomous agents collaborate, write code, and manage tasks like a human engineering team.

### The Mission

A secure, strictly controlled sandbox that grants agents maximum coding autonomy within bounded project folders, while physically preventing access to the host machine or unauthorized data.

### The Goal

This repo is the outer layer. Projects inside `Projects/` are the inner layer. Everything built here orchestrates and secures the inner layer — agents get only the access we explicitly allow, nothing more.

### Agents

Agents are headless AI coding workers (built on the Crispy-Adventure framework, a fork of `pi`). Each agent:
- Runs as a worker node polling for tasks from a Gatekeeper API
- Operates autonomously — no human-in-the-loop during execution
- Has a **specific role** (e.g. lead, reviewer, tester) with **role-based permissions**
- Cannot perform actions outside its assigned role's permission set
- Communicates with other agents via the Gatekeeper (inter-agent messaging, subtasks, Kanban updates)

### Planned Capabilities (beyond current file CRUD)

- **Task management** — agents pick up, create subtasks, and complete work items
- **Inter-agent messaging** — agents communicate across roles via the Gatekeeper
- **Git operations** — agents commit, branch, and create PRs within their project
- **RBAC** — every capability is gated by role-specific permissions; agents cannot exceed their assigned scope

## Commands

```bash
npm start              # Run the server (port 4000)
npm test               # Run Jest tests
npm run lint            # ESLint check
npm run lint:fix        # ESLint auto-fix
npm run format          # Prettier write
npm run format:check    # Prettier check
```

```bash
# Docker (primary usage)
docker build -t silver-computing-machine -f .devcontainer/Dockerfile .
docker run -it --rm -p 4000:4000 -v $(pwd):/workspace silver-computing-machine
```

**Pre-push hook** (Husky): runs `lint` + `format:check` + `test` automatically on `git push`.

## Architecture

**Single-file server** (`server.js`) — all routes and logic in one file.

**Sandbox model**: `safePath()` resolves and validates every path against `WORKSPACE_DIR`. Requests escaping the workspace root get a 403. This is the security boundary — changes here affect container isolation.

**Env config** (`.env` / `.env.example`):

- `PORT` — server port (default: 4000)
- `WORKSPACE_DIR` — sandbox root (default: `/workspace` inside container)

**Container**: ARM64 `node:22-bookworm-slim`, runs as non-root `node` user. App baked into `/app`, workspace mounted at `/workspace`. Projects live in `Projects/`.

**API routes**:

- `GET /api/health` — status
- `GET /api/files?dir=` — directory listing
- `GET /api/files/:path` — read file
- `PUT /api/files/:path` — write file (body: `{ content: string }`)

## Key Constraints

- Default port is `4000` — ensure Dockerfile, docker run, and `PORT` env all align.
- `Projects/` is gitignored (sandbox content, tracked per-project).
- No authentication on the API — relies on container network isolation.
