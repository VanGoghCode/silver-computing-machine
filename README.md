# Silver-Computing-Machine

Sandboxed container for AI coding agents.

## Usage

```bash
# Build
cd D:\Code\Silver-Computing-Machine
docker build -t silver-computing-machine -f .devcontainer/Dockerfile .

# Run
docker run -it --rm -p 4000:4000 -v D:\Code\Silver-Computing-Machine:/workspace silver-computing-machine

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
Silver-Computing-Machine/
├── .devcontainer/Dockerfile
├── Projects/          ← agents work here
├── server.js
├── package.json
├── .env.example
└── .gitignore
```
