# Mizuki Playground — Agent Guidelines

This repository is a public playground containing independent projects.

## Repository rules

- Treat each top-level project directory as self-contained.
- Do not introduce a repository-wide package workspace unless explicitly requested.
- Keep project-specific dependencies, configuration, tests, and documentation inside that project.
- Avoid changing unrelated projects while working on one project.
- Never commit secrets, credentials, private data, local environment files, or machine-specific state.
- Shared root configuration should remain minimal and broadly applicable.
- A project may define a more specific `AGENTS.md`; the nearest project-specific instructions take precedence for that project.

## Quality

For code projects, prefer reproducible builds, automated tests, and project-scoped CI. Keep generated artifacts out of Git unless the project explicitly requires them.
