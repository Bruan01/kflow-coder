# Contributing to KFlow Code (KFC)

Thanks for your interest in KFC! This project is built from first principles
with a deliberate learning contract. Before you open an issue or a pull
request, please read [docs/vision.md](docs/vision.md) and
[TODO.md](TODO.md) so we are working toward the same boundaries.

## Ground rules

1. **One numbered task at a time.** Do not start the next task before the
   current one is verified. Extensions (MCP, Skills, Hooks, subagents) stay
   locked until the single-Agent read–modify–test–verify loop is reliable.
2. **Evidence over claims.** "Code written" is not "done"; only reproducible
   evidence counts. Every completed task must pass build, lint, tests, and at
   least one real-repository acceptance task.
3. **No pre-funded abstraction.** An abstraction must be earned by a problem
   that has already occurred, not by imagination.
4. **Provider-specific types stay out of the core.** Keep the protocol-neutral
   Agent Loop and CLI modules free of vendor SDK types.

## Development setup

Requirements: Node.js 22+ and pnpm 10.11.0.

```bash
pnpm install          # Restore dependencies from pnpm-lock.yaml
pnpm build            # Compile src/ with strict TypeScript checks
pnpm typecheck:tests  # Type-check src/ and TypeScript tests without emit
pnpm test             # Run deterministic Vitest tests
pnpm lint             # Run ESLint static analysis
pnpm format:check     # Verify Prettier formatting
pnpm kfc --help       # Smoke-test the built local CLI
```

All commands must work from the repository root. Run `pnpm format` before
reviewing formatting changes.

## Making changes

1. Fork the repository and create a branch with a conventional name (for
   example `feat/agent-loop` or `fix/error-codes`).
2. Implement your change following the repository style: TypeScript, two-space
   indentation, semicolons, `camelCase` for variables/functions, `PascalCase`
   for classes and types, kebab-case filenames.
3. Add or update tests under `tests/` mirroring the relevant `src/` path.
   Keep provider responses mocked so streaming, retries, cancellation, and
   tool loops stay deterministic.
4. Verify everything locally:
   ```bash
   pnpm build && pnpm typecheck:tests && pnpm test && pnpm lint && pnpm format:check
   ```
5. Commit with Conventional Commit prefixes and focused subjects:
   `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.

## Pull request checklist

State in the description:

- the roadmap phase your change belongs to,
- the behavior change and the risks you considered,
- the verification commands you ran and their results,
- the ADR or design doc your change relates to,
- CLI output or screenshots when user-visible behavior changes.

## Learning evidence workflow

After every completed development task, follow this order:

1. Run the relevant build, test, lint, and acceptance checks.
2. Append hypotheses, evidence, failures, and lessons to
   `docs/learning-log.md`.
3. Update task state in `TODO.md`.
4. Run `pnpm learning:snapshot -- "<task name>"`.

Commit generated files under `lr-machine/snapshots/`; they are immutable
learning evidence. Do not edit old snapshots.

## Secrets and local configuration

Never commit secrets, API keys, generated logs, or local configuration. API
keys are forbidden in `config.json` and in source code; they may only come from
the environment or the Base-URL-bound `credentials.json` (mode `0600`).
Configuration tests must inject environment values, paths, and file readers —
never read or modify the developer's real home configuration.
