# LR Machine Design

## Purpose

LR Machine is KFlow Code's local learning and progress display service. It answers what the project is doing now, what has been verified, what was learned, and which KFC APIs actually exist. It also creates immutable, self-contained HTML snapshots after each development task.

## Approved Scope

- Bind a read-only HTTP service to `127.0.0.1:4310` by default.
- Read `TODO.md`, `docs/vision.md`, `docs/learning-log.md`, `package.json`, exported declarations under `src/`, Git state, and existing snapshots.
- Present a “research notebook × engineering console” dashboard.
- Generate offline HTML snapshots under `lr-machine/snapshots/`.
- Show only implemented KFC commands and source exports; do not invent roadmap APIs.
- Archive allowlisted `src/**/*.ts` core files with relative paths, responsibilities, line numbers, and explicit size truncation.
- Never read `.env`, expose secrets or absolute paths, accept arbitrary filesystem paths, execute browser-provided commands, or mutate project files through HTTP.

## Data Flow

Allowlisted repository files and fixed Git commands feed pure parsing and collection modules. The resulting serializable project model, including allowlisted core source content, feeds both the live dashboard and the snapshot renderer. Live and archived pages therefore share one data model and one UI implementation.

## Completion Workflow

Every development task closes in this order:

1. Implement and test.
2. Update `docs/learning-log.md`.
3. Update `TODO.md`.
4. Run `pnpm learning:snapshot -- "<task name>"`.

## Acceptance

The service must render current progress, notes, API exports, commands, Git status, and snapshot history; reject traversal attempts; create an offline snapshot; work on desktop and narrow screens; and pass build, tests, lint, and formatting checks.
