# Repository Guidelines

## Project Structure & Module Organization

This repository contains the P0 TypeScript scaffold for KFlow Code (KFC). Use `TODO.md` as the phase-gated execution plan, `docs/vision.md` for scope, and `docs/learning-log.md` for experiment evidence. The local Word roadmap is intentionally excluded from Git.

The current layout is:

- `src/cli.ts`: executable process adapter; keep it thin and free of core decisions.
- `src/cli/`: pure argument parsing, help text, CLI runner, and package metadata access.
- `src/index.ts`: package module entry.
- `tests/`: Vitest tests mirroring `src/` behavior.
- `docs/`: vision, learning logs, specifications, experiments, reviews, and future ADRs.
- `lr-machine/`: read-only learning dashboard, allowlisted core-source collector, browser assets, tests, and HTML snapshots.
- `dist/`: generated build output; never edit or commit it.
- `TODO.md`: the current task and completion gates.

Keep provider-specific types out of core agent and CLI modules. Add advanced subsystems only when the roadmap’s preceding phase is accepted.

## Build, Test, and Development Commands

- `pnpm install`: install locked dependencies.
- `pnpm build`: compile TypeScript and reject emission on type errors.
- `pnpm typecheck:tests`: type-check production and Vitest TypeScript without emitting files.
- `pnpm kfc --help`: run the built local CLI (`pnpm build` first).
- `pnpm kfc doctor`: check local runtime and configuration without making a network request.
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

Use Vitest. Name tests `*.test.ts` and mirror the relevant `src/` path under `tests/`. Keep CLI parsing and output tests independent of `process`; verify the built entry separately. Mock provider responses so streaming, retries, cancellation, and tool loops remain deterministic. Every phase must pass build, lint, and tests plus at least one real-repository acceptance task.

## Commit & Pull Request Guidelines

No Git history is present yet. Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) with focused subjects. Pull requests should state the roadmap phase, summarize behavior and risks, list verification commands, link the relevant issue/ADR, and include CLI output or screenshots when user-visible behavior changes. Never commit secrets, API keys, generated logs, or local configuration.

## Learning Evidence Workflow

`lr-machine/` is the local, read-only progress and learning dashboard. Run `pnpm learning:serve` and open `http://127.0.0.1:4310` to inspect current state. After every completed development task, follow this order:

1. Run the relevant build, test, lint, and acceptance checks.
2. Append hypotheses, evidence, failures, and lessons to `docs/learning-log.md`.
3. Update task state in `TODO.md`.
4. Run `pnpm learning:snapshot -- "<task name>"`.

Commit generated files under `lr-machine/snapshots/`; they are immutable learning evidence containing the allowlisted core source captured at that time. Do not edit old snapshots or expose `.env`, secrets, absolute paths, arbitrary file reads, or write/command endpoints through LR Machine.

## Configuration Security

Resolve ordinary configuration as environment variables over the user config file over defaults. Resolve credentials as `KFC_API_KEY` over the private credentials file. API keys are forbidden in `config.json`; they may only come from the environment or the dedicated Base-URL-bound `credentials.json`, which must be created with mode `0600`. Never log credentials, serialize them without redaction, or include them in snapshots. Configuration tests must inject environment values, paths, and file readers; never read or modify the developer's real home configuration.

## Error Handling

Represent domain failures with `KfcError` subclasses and stable codes. Messages and public details must be safe for users. Never directly print third-party errors, raw causes, stacks, responses, or unknown messages. Use `formatErrorForCli` at CLI boundaries; keep retry decisions on structured error fields and use exit codes 1 (internal), 2 (config), 3 (provider), and 130 (interrupted).

## Doctor Boundary

`kfc doctor` is read-only and local-only. It may check runtime version, config-path accessibility, validated Base URL/model, and API-key presence. It must never print secret values or contact a Provider; authentication, reachability, model availability, streaming, and Tool Calling are P1 concerns. Treat a missing optional config file as a warning when environment configuration is valid.

## Quickstart Boundary

`kfc --quickstart` and `--qs` are interactive TTY-only helpers for protocol, custom OpenAI-compatible Base URL, model, timeout, and a persisted credential workflow. Do not add vendor presets. Preview non-secret configuration, disclose that the credential is plaintext, require confirmation before asking for it, refuse silent overwrite, and write both files with private temporary files plus atomic rename. Store API keys only in the Base-URL-bound credentials file with mode `0600`; never place them in `config.json`, modify shell startup files, echo them, or expose them through Doctor or LR Machine.
