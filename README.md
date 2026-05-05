# Humai-Workspace

Sandboxed container for AI coding agents.

## Usage

```bash
# Build
cd D:\Code\Humai-Workspace
docker build -t humai-workspace -f .devcontainer/Dockerfile .

# Run
docker run -it --rm -p 3000:3000 -v D:\Code\Humai-Workspace:/workspace humai-workspace

# Add a project
mkdir Projects\Project-X
```

## API

- `GET /api/health` — status check
- `GET /api/files?dir=path` — list files
- `GET /api/files/:path` — read file
- `PUT /api/files/:path` — write file

## Structure

```
Humai-Workspace/
├── .devcontainer/Dockerfile
├── Projects/          ← agents work here
├── server.js
├── package.json
├── .env.example
└── .gitignore
```
