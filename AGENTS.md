# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains the KFlow Code (KFC) implementation roadmap in `KFlow_Code_KFC_最小实现与智能体架构学习路线.docx`. Treat it as the source of truth for scope and phase acceptance criteria until equivalent Markdown documentation is added.

The planned P0 TypeScript layout is:

- `src/cli.ts`: command parsing and terminal-facing behavior.
- `src/config.ts`: environment and user configuration loading.
- `src/errors.ts`: shared typed errors such as `KfcError`.
- `src/providers/`: provider interfaces and OpenAI-compatible adapters.
- `tests/`: Vitest unit and integration tests.
- `docs/decisions/`: numbered ADRs, for example `ADR-0001-typescript.md`.
- `docs/learning-log.md`: phase findings, failures, and refactoring notes.

Keep provider-specific types out of core agent and CLI modules. Add advanced subsystems only when the roadmap’s preceding phase is accepted.

## Build, Test, and Development Commands

The code workspace has not been scaffolded yet. After P0 adds `package.json`, use the roadmap-standard commands:

- `pnpm install`: install locked dependencies.
- `pnpm build`: compile TypeScript and catch type errors.
- `pnpm test`: run the Vitest suite.
- `pnpm lint`: run ESLint checks; apply Prettier before review.
- `pnpm exec kfc doctor`: verify Node.js 22+, configuration, and API-key presence.

Update this section whenever scripts change; commands documented here must work from the repository root.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, and Prettier defaults. Use `camelCase` for variables/functions, `PascalCase` for classes and types, and kebab-case filenames such as `openai-compatible.ts`. Prefer small modules with explicit interfaces, Zod validation at external boundaries, and structured errors instead of raw exceptions.

## Testing Guidelines

Use Vitest. Name tests `*.test.ts` and mirror the relevant `src/` path under `tests/`. Mock provider responses so streaming, retries, cancellation, and tool loops remain deterministic. Every phase must pass build, lint, and tests plus at least one real-repository acceptance task.

## Commit & Pull Request Guidelines

No Git history is present yet. Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) with focused subjects. Pull requests should state the roadmap phase, summarize behavior and risks, list verification commands, link the relevant issue/ADR, and include CLI output or screenshots when user-visible behavior changes. Never commit secrets, API keys, generated logs, or local configuration.
