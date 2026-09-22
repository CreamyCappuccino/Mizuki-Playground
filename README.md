# Mizuki Playground

A public playground for small experiments, interactive visualizations, web toys, and self-contained projects.

## Structure

Each top-level project directory is intentionally independent. A project may use its own stack, dependencies, tests, CI workflow, and deployment configuration.

```text
Mizuki-Playground/
├── project-a/
├── project-b/
└── ...
```

There is no repository-wide package workspace requirement. Shared root files should stay minimal so new projects can be added freely without coupling unrelated experiments.

## Project guidelines

- Keep each project self-contained.
- Put project-specific dependencies and configuration inside that project's directory.
- Project-specific `.gitignore` rules may be added locally when needed.
- GitHub Actions workflows may target individual project paths.
- Do not commit secrets, credentials, local environment files, build artifacts, or dependency directories.
- A project can later be split into its own repository if it grows beyond playground scope.

## First project

The first planned project is an interactive 3D Earth axial-tilt and climate visualization.
