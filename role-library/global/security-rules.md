# Security Rules

## Authentication

- All worker APIs require Bearer token authentication.
- Tokens map to a single agent identity (project, department, role).
- Only SHA-256 hashes of tokens are stored. Raw tokens are never logged.

## Authorization

- RBAC is enforced in the backend, not only in the UI.
- Role permissions are defined by permission profiles, not hardcoded.
- Workers never access the database directly.

## Isolation

- Project isolation is strictly enforced.
- No agent can access another project's files or state.
- Path traversal attacks are blocked at the service layer.

## Principles

- Do not bypass communication permissions.
- Do not silently overwrite context.
- Save important decisions as context artifacts.
