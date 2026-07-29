# Repository Guidelines

## Project Structure & Module Organization

This repository contains the P0 TypeScript scaffold for KFlow Code (KFC). Use `TODO.md` as the phase-gated execution plan, `docs/vision.md` for scope, and `docs/learning-log.md` for experiment evidence. The local Word roadmap is intentionally excluded from Git.

The current layout is:

- `src/`: production TypeScript; `src/index.ts` is currently the minimal module entry.
- `tests/`: Vitest tests mirroring `src/` behavior.
- `docs/`: vision, learning logs, specifications, experiments, reviews, and future ADRs.
- `lr-machine/`: read-only learning dashboard, data collectors, browser assets, tests, and HTML snapshots.
- `dist/`: generated build output; never edit or commit it.
- `TODO.md`: the current task and completion gates.

Keep provider-specific types out of core agent and CLI modules. Add advanced subsystems only when the roadmap’s preceding phase is accepted.

## Build, Test, and Development Commands

- `pnpm install`: install locked dependencies.
- `pnpm build`: compile TypeScript and catch type errors.
- `pnpm test`: run the Vitest suite.
- `pnpm lint`: run ESLint checks; apply Prettier before review.
- `pnpm format:check`: verify Prettier formatting without changing files.
- `pnpm learning:serve`: start the local progress and learning dashboard.
- `pnpm learning:test`: run LR Machine focused tests.

`kfc doctor` is planned for P0.6 and is not available yet.

Update this section whenever scripts change; commands documented here must work from the repository root.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, and Prettier defaults. Use `camelCase` for variables/functions, `PascalCase` for classes and types, and kebab-case filenames such as `openai-compatible.ts`. Prefer small modules with explicit interfaces, Zod validation at external boundaries, and structured errors instead of raw exceptions.

## Testing Guidelines

Use Vitest. Name tests `*.test.ts` and mirror the relevant `src/` path under `tests/`. Mock provider responses so streaming, retries, cancellation, and tool loops remain deterministic. Every phase must pass build, lint, and tests plus at least one real-repository acceptance task.

## Commit & Pull Request Guidelines

No Git history is present yet. Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) with focused subjects. Pull requests should state the roadmap phase, summarize behavior and risks, list verification commands, link the relevant issue/ADR, and include CLI output or screenshots when user-visible behavior changes. Never commit secrets, API keys, generated logs, or local configuration.

## Learning Evidence Workflow

`lr-machine/` is the local, read-only progress and learning dashboard. Run `pnpm learning:serve` and open `http://127.0.0.1:4310` to inspect current state. After every completed development task, follow this order:

1. Run the relevant build, test, lint, and acceptance checks.
2. Append hypotheses, evidence, failures, and lessons to `docs/learning-log.md`.
3. Update task state in `TODO.md`.
4. Run `pnpm learning:snapshot -- "<task name>"`.

Commit generated files under `lr-machine/snapshots/`; they are immutable learning evidence. Do not edit old snapshots or expose `.env`, secrets, absolute paths, arbitrary file reads, or write/command endpoints through LR Machine.
