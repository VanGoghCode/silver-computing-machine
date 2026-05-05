# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Sandboxed Express API for AI coding agents. Single `server.js` serves a file CRUD API over a containerized workspace. Agents read/write project files via REST — never direct filesystem access in production.

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
docker build -t humai-workspace -f .devcontainer/Dockerfile .
docker run -it --rm -p 4000:4000 -v $(pwd):/workspace humai-workspace
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

- The `Dockerfile` still exposes port `3000` — update it when changing the default port.
- `Projects/` is gitignored (sandbox content, tracked per-project).
- No authentication on the API — relies on container network isolation.
