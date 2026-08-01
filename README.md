# KFlow Code (KFC)

KFlow Code is a learning-first coding agent built from first principles. The project grows one verified mechanism at a time so that implementation, experiments, architecture decisions, and learning notes remain connected.

## Current Status

P0 and P1 are accepted. P2 now includes a controlled Agent Loop, typed Tool Registry, and bounded `list_directory`, `read_file`, and fixed-string `grep` tools behind a canonical workspace boundary. `kfc agent` connects those read-only tools to OpenAI-compatible Chat Completions Tool Calling. A TTY-only `kfc` opens the KFLOW interactive workbench with a session timeline, read-only Agent, command menu, safe status panel, and in-memory context. Write operations and Shell remain disabled; Responses and Anthropic Tool Calling are not implemented.

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

### Interactive workbench

```bash
pnpm build
pnpm kfc
```

In a TTY, `kfc` enters a KFLOW alternate-screen workbench with a short text
startup animation. The top area is a scrollable session timeline; the status
bar and multi-line editor stay fixed at the bottom. Use `↑`/`↓` or
PageUp/PageDown to browse history. Mouse reporting is intentionally disabled,
so the terminal's native text selection and copy behavior remains available.
`Esc` or Ctrl+C cancels only the current request.

Typing `/` opens a Chinese command menu. Supported commands are:

- `/help`: show all commands and shortcuts in Chinese.
- `/status`: show the safe resolved Provider configuration, model, timeout,
  credential presence, Agent step limit, enabled-tool count, session message
  count, turn count, and accumulated Provider token usage. Context-window size
  is shown as unknown unless a Provider actually supplies it.
- `/tool`: open the live tool manager. Use `↑`/`↓` to select a tool, Space to
  enable or disable it, and Enter/Esc to return. Changes apply to the next
  Agent turn without restarting the session.
- `/clear`: request clearing both in-memory context and visible timeline; type
  `y` to confirm.
- `/exit`: restore the cursor and prior terminal screen.

In non-TTY input/output contexts, no-argument `kfc` still prints help instead
of starting an interactive process.

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

### Read-only Agent

```bash
pnpm build
pnpm kfc agent "查看当前工作目录下的主要文件，并总结项目用途"
```

`agent` is deliberately separate from `ask`: it creates `list_directory`,
`read_file`, and fixed-string `grep` tools rooted at the command's current
directory, runs at most eight model turns by default, and streams model text
to stdout. Set `KFC_AGENT_MAX_STEPS` to an integer from `1` to `64` to adjust
the bounded loop for a command or session.
Tool Calling currently requires `openai-chat-completions` (including the
configured DeepSeek-compatible target). `openai-responses` and Anthropic
Messages Tool Calling are rejected/not implemented rather than silently
falling back. The tools are read-only: they reject traversal and external
Symlinks, hide `.git`, restrict file/search sizes, and do not expose Shell,
write, network, or Git operations.

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
- `src/agent/`: controlled Agent Loop, Tool execution contract, and Agent errors
- `src/interactive/`: ANSI workbench state, secure raw-mode input, startup animation, and terminal lifecycle
- `src/tool/`: typed Tool definitions, Registry, read-only workspace boundary, validation, and safe execution results
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
