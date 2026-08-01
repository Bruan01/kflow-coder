<div align="center">

# KFlow Code (KFC)

**A learning-first, verifiable coding agent built from first principles.**

**English** · [简体中文](./README.zh-CN.md)

KFC re-implements the core mechanisms of a coding agent — configuration,
streaming, a controlled agent loop, a typed tool registry, and a bounded
workspace — one verified step at a time, so every abstraction is earned by a
real problem instead of borrowed from a black box.

![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10.11.0-F69220?logo=pnpm&logoColor=white)
![Validated by](https://img.shields.io/badge/validated%20by-Zod-3E67B1)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Current Status](#current-status)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [Interactive workbench](#interactive-workbench)
  - [Ask](#ask)
  - [Workspace Agent](#workspace-agent)
  - [Doctor](#doctor)
  - [Quickstart wizard](#quickstart-wizard)
- [Configuration](#configuration)
- [Security Model](#security-model)
- [Error Contract & Exit Codes](#error-contract--exit-codes)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## About

Mature coding agents can already automate a large fraction of software work,
but using them does not explain _why_ they are reliable, _how_ they fail, or
_how to change their boundaries_. KFlow Code answers those questions by
hand-building the machinery itself.

The project grows one verified mechanism at a time so that implementation,
experiments, architecture decisions, and learning notes stay connected. Every
phase must produce reproducible evidence — never just "the code looks done".

## Features

- **Controlled Agent Loop** — a protocol-neutral, interruptible state machine
  (`ask`/`agent`) that terminates by design and reports structured results.
- **Typed Tool Registry** — every tool is a typed, Zod-validated contract;
  parameters are validated at the registry boundary, not inside the model.
- **Canonical workspace boundary** — all workspace tools reject traversal and
  external symlinks, hide `.git`, and enforce file/search/output limits.
- **Security by default** — observation tools are enabled; Edit and Execute
  tools are registered but disabled, and each call requires explicit
  confirmation (`Yes` / `No` / `Tell me why?`).
- **Protocol-neutral provider layer** — OpenAI-compatible Chat Completions and
  Responses adapters share one internal `ModelProvider` contract.
- **Interactive KFLOW workbench** — a TTY-only alternate-screen session with a
  timeline, live status, terminal Markdown projection, and a Chinese command
  menu.
- **Read-only diagnosis** — `kfc doctor` verifies the runtime and configuration
  locally without ever contacting a Provider.
- **LR Machine** — a local learning dashboard with immutable HTML snapshots of
  the allowlisted core source.

## Current Status

| Phase     | Scope                                                                              | State          |
| --------- | ---------------------------------------------------------------------------------- | -------------- |
| **P0**    | Engineering skeleton, config & error boundaries, Doctor, Quickstart                | ✅ Accepted    |
| **P1**    | Single-turn model calls, streaming, cancellation, wire adapters                    | ✅ Accepted    |
| **P2**    | Agent Loop, Tool Registry, read-only workspace tools, workbench                    | ✅ Implemented |
| **P3**    | Write/Shell with least privilege, per-call confirmation, `git_diff`                | ✅ Implemented |
| **P4–P8** | Event-driven core, session persistence, context, verifiable completion, extensions | 🚧 Planned     |

> Note: `openai-responses` and Anthropic Messages **Tool Calling** are not
> implemented. Tool Calling requires `openai-chat-completions` today; other
> protocols are rejected explicitly rather than silently falling back.

## Requirements

- **Node.js 22 or newer**
- **pnpm 10.11.0** (project is pinned via `packageManager`)

## Installation

```bash
git clone <your-repository-url>
cd kflow-code
pnpm install          # Restore dependencies from pnpm-lock.yaml
pnpm build            # Compile src/ with strict TypeScript checks
pnpm kfc --help       # Smoke-test the local CLI
```

## Usage

### Interactive workbench

```bash
pnpm build
pnpm kfc
```

In a TTY, `kfc` plays a short full-width digital-rain animation that resolves
into a seven-row bright-white ASCII `KFLOW CODE` logo, then opens the KFLOW
alternate-screen workbench. Color-disabled terminals keep the animation without
ANSI colors; very narrow terminals fall back to safe centered text.

- The top area is a **scrollable session timeline**; the status bar and
  multi-line editor stay fixed at the bottom.
- Browse history with `↑` / `↓` or `PageUp` / `PageDown`.
- Mouse reporting is intentionally disabled so native text selection and copy
  remain available.
- `Esc` / `Ctrl+C` cancels only the current request.

**Live status** — while a model request is active the status bar shows a
spinner and `模型思考中`. During a tool call it switches to
`执行工具: <name> · <target>`, e.g. `执行工具: read_file · 文件: src/interactive/workbench.ts`,
without printing file contents or inline secrets. It returns to `Ready`,
`Cancelled`, or `Error` when the request finishes.

**Safe tool summaries** — after each call the timeline adds a safe result
summary such as `↳ read_file · 读取 12 行 · 9ms` or
`↳ git_diff · 2 个文件 · +3/-1 · 12ms`. Failed, timed-out, and truncated results
are marked without exposing raw output. `git_diff` never prints full patch
content; it reports tracked/untracked files, line-count summaries, and whether a
path was already dirty at session start.

**Terminal Markdown** — assistant replies receive a lightweight Markdown
projection (headings, lists, quotes, emphasis, inline code, fenced code blocks);
unsupported syntax falls back to safe text. A dim divider separates turns.

**Command menu** — typing `/` opens the Chinese command menu:

| Command   | Action                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/help`   | Show all commands and shortcuts in Chinese                                                                                                  |
| `/status` | Safe resolved Provider config, model, timeout, credentials presence, Agent step limit, enabled-tool count, message/turn counts, token usage |
| `/tool`   | Live tool manager: `↑`/`↓` to select, `Space` to enable/disable, `Enter`/`Esc` to return                                                    |
| `/themes` | Switch terminal themes live; persisted to user config                                                                                       |
| `/clear`  | Clear in-memory context and visible timeline (`y` to confirm)                                                                               |
| `/exit`   | Restore the cursor and prior terminal screen                                                                                                |

In non-TTY input/output contexts, no-argument `kfc` prints help instead of
starting an interactive process.

### Ask

```bash
pnpm build
pnpm kfc ask "Explain KFlow Code"
```

- Sends a single user message, **no hidden system prompt**, no persistence.
- Model text streams to stdout; a safe completion summary goes to stderr so
  stdout stays pipe-friendly:

```text
[kfc] finish=stop ttft=123ms total=456ms tokens=12/4/16
```

- `Ctrl+C` cancels the active Provider request and returns exit code `130`.

### Workspace Agent

```bash
pnpm build
pnpm kfc agent "查看当前工作目录下的主要文件，并总结项目用途"
```

`agent` is deliberately separate from `ask`:

- Creates the common workspace tool surface rooted at the **current working
  directory**.
- Enables observation tools (`list_directory`, `read_file`, `grep`,
  `find_files`) by default; Edit (`apply_patch`, `write_file`) and Execute
  (`shell`) stay disabled until enabled from the `/tool` menu.
- Runs in an **unbounded long-task mode** by default. It ends on a model stop
  response, Provider/context/tool failure, or user interruption with Esc/Ctrl+C;
  there is no arbitrary 8-turn cutoff.
- Streams model text to stdout.
- Requires `openai-chat-completions` (including a configured
  DeepSeek-compatible target) for Tool Calling.

### Doctor

```bash
pnpm build
pnpm kfc doctor
```

Checks Node.js 22+, the resolved config path, Base URL, model, and API-key
presence. It **never** calls the Provider and **never** reveals the key. A
missing config file is only a warning when environment variables provide the
required values. See [docs/doctor.md](docs/doctor.md).

### Quickstart wizard

```bash
kfc --quickstart   # or: kfc --qs
```

An interactive, TTY-only helper that walks through wire protocol, custom
OpenAI-compatible Base URL, model, timeout, and a hidden API key — only after
explicit plaintext-storage confirmation. It has no vendor presets, refuses
silent overwrite, keeps the key out of `config.json`, and runs Doctor after
atomic private writes. See [docs/quickstart.md](docs/quickstart.md).

## Configuration

KFC resolves configuration as:

```
environment variables  >  user config file  >  defaults
```

The supported wire protocols are `openai-chat-completions` (default) and
`openai-responses`; selection is explicit and never inferred.

| Variable               | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `KFC_API_KEY`          | API key (preferred source; see secret policy)                  |
| `KFC_PROTOCOL`         | Wire protocol: `openai-chat-completions` or `openai-responses` |
| `KFC_BASE_URL`         | Custom OpenAI-compatible Base URL                              |
| `KFC_MODEL`            | Model name                                                     |
| `KFC_TIMEOUT_MS`       | Request timeout in milliseconds                                |
| `KFC_CONFIG_PATH`      | Optional override for the user configuration file              |
| `KFC_CREDENTIALS_PATH` | Optional override for the plaintext credentials file           |

See [.env.example](.env.example), [docs/configuration.md](docs/configuration.md),
and ADR-0002.

### Secret policy

- API keys are **forbidden in `config.json`** and in source code.
- Keys come only from `KFC_API_KEY` or the Base-URL-bound
  `credentials.json`, created with mode `0600`.
- Credentials are never logged, serialized without redaction, or included in
  LR Machine snapshots.

## Security Model

- **Workspace boundary** — every workspace tool operates inside a canonical
  root; traversal and external symlinks are rejected, `.git` is hidden, and
  file/search/output limits are enforced.
- **Least privilege by default** — observation tools are on; Edit and Execute
  tools are off. Once enabled, every individual Edit/Execute call pauses at an
  arrow-key confirmation menu with `Yes`, `No`, and `Tell me why?`. A rejection
  returns a structured denial to the Agent instead of executing.
- **Tool hardening** — `apply_patch` accepts only one exact replacement,
  `write_file` refuses to overwrite existing files, and `shell` is disabled by
  default with bounded cwd, timeout, environment, and output. `git_diff` is
  read-only and runs fixed Git subprocess arguments without a shell.
- **No destructive rollback** — after a failed turn, the workbench reports
  completed/failed tools plus a recovery hint; KFC never runs destructive
  rollback automatically.

See [docs/specs/2026-08-01-common-tool-surface.md](docs/specs/2026-08-01-common-tool-surface.md)
for the necessity and permission rationale, and ADR-0009.

## Error Contract & Exit Codes

Domain failures extend `KfcError` with stable codes. Public output contains
only safe messages and details; optional structured debug fields are
recursively redacted, while raw causes and unknown stacks remain private.

| Exit code | Meaning             |
| --------- | ------------------- |
| `1`       | Internal failure    |
| `2`       | Configuration error |
| `3`       | Provider failure    |
| `130`     | User interruption   |

Unknown CLI options return exit code `1` with a short error and no stack trace.
See [docs/errors.md](docs/errors.md) and ADR-0003.

## Architecture

**Design principles** — protocol-neutral core, thin process adapter, explicit
adapters at boundaries, Zod validation at external boundaries, structured
errors instead of raw exceptions, and one architecture concept at a time.

```
src/
├── cli.ts               # Executable process adapter (thin, no core decisions)
├── index.ts             # Package module entry
├── cli/                 # Pure argument parsing, help, runner, package metadata
├── ask/                 # Protocol-neutral single-turn stream consumer
├── agent/               # Controlled Agent Loop, tool execution contract
├── tool/                # Typed tools, Registry, workspace boundary, safe results
├── provider/            # Protocol-neutral model contract + wire adapters
├── config/              # Zod-validated config, paths, redaction, themes
├── doctor/              # Local read-only readiness checks
├── quickstart/          # Interactive TTY-only setup wizard
├── interactive/         # ANSI workbench state, raw-mode input, animation
└── errors/              # KfcError hierarchy and safe formatting
```

**Supporting tooling**

```
tests/                   # Vitest tests mirroring src/ behavior
docs/                    # vision, specs, ADRs, experiments, reviews, learning log
lr-machine/              # Local learning dashboard + immutable HTML snapshots
```

LR Machine automatically archives allowlisted `src/**/*.ts` files with relative
paths, line numbers, responsibilities, and truncation metadata. Do not add MCP,
Skills, Hooks, subagents, or advanced UI before the single-Agent
read–modify–test–verify loop is reliable.

## Documentation

| Document                                       | Purpose                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| [docs/vision.md](docs/vision.md)               | Goals, non-goals, learning criteria                 |
| [docs/configuration.md](docs/configuration.md) | Provider fields, precedence, paths, secret policy   |
| [docs/provider.md](docs/provider.md)           | Wire protocols, stream invariants, adapter boundary |
| [docs/errors.md](docs/errors.md)               | Error categories, exit codes, retry rules           |
| [docs/doctor.md](docs/doctor.md)               | Local readiness checks and scope                    |
| [docs/quickstart.md](docs/quickstart.md)       | DIY Provider setup and secret boundary              |
| [docs/tool-registry.md](docs/tool-registry.md) | Tool contracts and registry semantics               |
| [docs/decisions/](docs/decisions/)             | ADR-0001 … ADR-0010 architecture decisions          |
| [docs/experiments/](docs/experiments/)         | Reproducible real-command acceptance records        |
| [docs/reviews/](docs/reviews/)                 | Phase acceptance reviews and entry decisions        |
| [docs/learning-log.md](docs/learning-log.md)   | Hypotheses, experiments, evidence, lessons          |
| [TODO.md](TODO.md)                             | Phase-gated implementation path                     |

## Roadmap

- **P0** Engineering skeleton and boundaries ✅
- **P1** Single-turn model calls ✅
- **P2** Agent Loop, Tool Registry, read-only tools, workbench ✅
- **P3** Write/Shell with least privilege ✅
- **P4** Event-driven Core and session persistence 🚧
- **P5** Context management and long sessions 🚧
- **P6** Verifiable completion and Completion Reports 🚧
- **P7–P8** Skills → Hooks → MCP, then subagents & worktrees (locked) 🔒

Extensions (MCP, Skills, Hooks, subagents) stay locked until the single-Agent
loop is reliable — an abstraction must be earned by a real problem, not
pre-funded by imagination.

## Contributing

This project is built from first principles with a strong learning contract:

1. One numbered task at a time — do not start the next task before the current
   one is verified.
2. Every task completes the loop: **question → hypothesis → minimal
   implementation → evidence → notes → review**.
3. "Code written" is not "done"; only reproducible evidence counts.
4. Please read [docs/vision.md](docs/vision.md) and [TODO.md](TODO.md) first.

If you find a bug or a missing verification, open an issue with the failing
command output and the phase you were verifying. Pull requests should state the
roadmap phase, summarize behavior and risks, list verification commands, and
link the relevant ADR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, including the
learning-evidence workflow and the pull request checklist.

## License

KFC is released under the [MIT License](LICENSE).
