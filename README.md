# KFlow Code (KFC)

KFlow Code is a learning-first coding agent built from first principles. The project grows one verified mechanism at a time so that implementation, experiments, architecture decisions, and learning notes remain connected.

## Current Status

P0.2 is complete: the repository has a reproducible Node.js and TypeScript toolchain, but no Agent behavior yet. See `TODO.md` for the active task and `docs/vision.md` for scope.

## Requirements

- Node.js 22 or newer
- pnpm 10.11.0

## Commands

```bash
pnpm install       # Restore dependencies from pnpm-lock.yaml
pnpm build         # Compile src/ with strict TypeScript checks
pnpm test          # Run deterministic Vitest tests
pnpm lint          # Run ESLint static analysis
pnpm format:check  # Check Prettier formatting
pnpm format        # Rewrite supported files with Prettier
pnpm learning:serve # Start LR Machine at 127.0.0.1:4310
pnpm learning:test  # Run LR Machine focused tests
pnpm learning:snapshot -- "<task>" # Archive the current learning state
```

## Structure

- `src/`: production TypeScript modules
- `tests/`: Vitest tests
- `docs/vision.md`: goals, non-goals, and learning criteria
- `docs/learning-log.md`: hypotheses, experiments, evidence, and lessons
- `lr-machine/`: live progress dashboard and immutable HTML learning snapshots
- `TODO.md`: phase-gated implementation path

Do not add MCP, Skills, Hooks, subagents, or advanced UI before the single-Agent read–modify–test–verify loop is reliable.
