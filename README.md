# KFlow Code (KFC)

KFlow Code is a learning-first coding agent built from first principles. The project grows one verified mechanism at a time so that implementation, experiments, architecture decisions, and learning notes remain connected.

## Current Status

P0 and P1 are accepted. KFC now includes fixture-verified `openai-chat-completions` and `openai-responses` Providers plus a minimal `kfc ask` vertical slice with explicit protocol selection, streaming stdout, safe stderr summaries, cancellation, usage, TTFT, and total duration. A real DeepSeek V4 Flash call has passed; Anthropic Messages is explicitly deferred. The active task is now the P2 Agent Loop contract. See `TODO.md`, `docs/reviews/P1-review.md`, and `docs/experiments/EXP-003-real-kfc-ask-deepseek.md`.

## Requirements

- Node.js 22 or newer
- pnpm 10.11.0

## Commands

```bash
pnpm install       # Restore dependencies from pnpm-lock.yaml
pnpm build         # Compile src/ with strict TypeScript checks
pnpm typecheck:tests # Type-check src/ and TypeScript tests without emit
pnpm test          # Run deterministic Vitest tests
pnpm lint          # Run ESLint static analysis
pnpm format:check  # Check Prettier formatting
pnpm format        # Rewrite supported files with Prettier
pnpm learning:serve # Start LR Machine at 127.0.0.1:4310
pnpm learning:test  # Run LR Machine focused tests
pnpm learning:snapshot -- "<task>" # Archive the current learning state
```

## CLI

Build before running the local CLI:

```bash
pnpm build
pnpm kfc --help
pnpm kfc --version
```

Unknown options return exit code `1` with a short error and no stack trace.

### Ask

```bash
pnpm build
pnpm kfc ask "Explain KFlow Code"
```

Model text streams to stdout. A safe completion summary is written to stderr so stdout remains pipe-friendly:

```text
[kfc] finish=stop ttft=123ms total=456ms tokens=12/4/16
```

Ask sends one user message, does not inject a hidden system prompt, and does not persist a conversation. Ctrl+C cancels the active Provider request and returns exit code `130`.

## Quickstart

```bash
kfc --quickstart
# or
kfc --qs
```

The interactive wizard asks for a supported wire protocol, custom OpenAI-compatible Base URL, model, timeout, and a hidden API Key after explicit plaintext-storage confirmation. It has no vendor presets, refuses silent overwrite, keeps the key out of `config.json`, and runs Doctor after atomic private writes. See `docs/quickstart.md`.

## Doctor

```bash
pnpm build
pnpm kfc doctor
```

Doctor checks Node.js 22+, the resolved config path, Base URL, model, and API-key presence. It does not call DeepSeek or reveal the key. A missing config file is only a warning when environment variables provide the required values. See `docs/doctor.md`.

## Configuration

KFC resolves configuration as `environment > user config file > defaults`. The supported wire protocols are `openai-chat-completions` and `openai-responses`; selection is explicit and defaults to Chat Completions. The first live P1 target remains `deepseek-v4-flash`; see `docs/configuration.md`, `.env.example`, and ADR-0002.

## Error Contract

Domain failures extend `KfcError`. Public output contains only safe messages/details; optional structured debug fields are recursively redacted, while raw causes and unknown stacks remain private. Exit codes are 1 for internal failures, 2 for configuration, 3 for Provider failures, and 130 for user interruption. See `docs/errors.md` and ADR-0003.

## Structure

- `src/cli.ts`: executable process adapter
- `src/cli/`: pure argument parsing, help, runner, and package metadata modules
- `src/ask/`: protocol-neutral single-turn stream consumer and call report
- `src/index.ts`: package module entry
- `src/provider/`: protocol-neutral model contract and wire-protocol adapters
- `tests/`: Vitest tests
- `docs/vision.md`: goals, non-goals, and learning criteria
- `docs/configuration.md`: provider fields, precedence, paths, and secret policy
- `docs/decisions/`: accepted architecture decisions and re-evaluation signals
- `docs/doctor.md`: local readiness checks, output semantics, and scope
- `docs/errors.md`: error categories, exit codes, retry rules, and presentation policy
- `docs/experiments/`: reproducible real-command acceptance records
- `docs/learning-log.md`: hypotheses, experiments, evidence, and lessons
- `docs/provider.md`: supported wire protocols, stream invariants, and adapter boundary
- `docs/quickstart.md`: interactive DIY Provider setup and secret boundary
- `docs/reviews/`: phase acceptance reviews, risks, and entry decisions
- `lr-machine/`: live progress dashboard, core-source review, and immutable HTML learning snapshots
- `TODO.md`: phase-gated implementation path

LR Machine automatically archives allowlisted `src/**/*.ts` files with relative paths, line numbers, responsibilities, and truncation metadata. Do not add MCP, Skills, Hooks, subagents, or advanced UI before the single-Agent read–modify–test–verify loop is reliable.
