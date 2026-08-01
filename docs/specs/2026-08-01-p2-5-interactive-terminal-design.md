# P2.5 Interactive KFlow Terminal Design

## Goal

Make a plain `kfc` invocation in an interactive terminal open a persistent,
read-only KFlow session rather than requiring one `kfc agent <prompt>` process
per question. The interaction should feel like a small, transparent coding
agent console: users can keep asking follow-up questions, observe actual tool
use, interrupt a turn, and exit cleanly.

## Scope

- `kfc` with no arguments starts the session only when stdin and stdout are
  TTYs; otherwise it keeps the existing help behavior.
- Enter the terminal alternate screen and show a short KFlow startup animation.
- Keep conversation messages in memory for the lifetime of the process, with a
  confirmation-gated reset command.
- Reuse the existing Chat Completions-only read-only Agent foundation:
  `list_directory`, `read_file`, and `grep`, rooted at `process.cwd()`.
- Stream model text and show tool names after atomic Tool Calls are received.
- Provide `/help`, `/clear`, `/status`, `/tool`, and `/exit`; Ctrl+C aborts an active
  turn while keeping the session usable.
- Restore the original terminal screen/cursor on every normal exit, error, or
  interruption path.

## Non-goals

- Disk session persistence, resumable threads, token compaction, or telemetry.
- File writes, Shell, Git, network tools, confirmations, or permissions beyond
  the established read-only workspace boundary.
- A byte-for-byte clone of Codex CLI or a React/Ink terminal framework.
- Responses and Anthropic Tool Calling.

## Interaction Design

At startup KFC switches to the alternate screen, clears it, hides the cursor,
and plays four to six small ANSI text frames for at most 600 ms. The word
`KFLOW` appears using a scan-line/dot projection, then settles into the header.
The animation does not access the network or model. On narrow terminals or
when `NO_COLOR` is set it degrades to one static `KFLOW` line. Terminal control
sequences never derive from model, user, or tool output.

After startup the scrollable session displays:

```text
KFLOW  ·  Read-only Agent  ·  /help for commands

you › summarize this repository
KFC › I will inspect the relevant files.
  ↳ tool list_directory
  ↳ tool read_file
KFC › ...final streamed answer...

kfc ›
```

Assistant Markdown is projected into terminal-safe structure rather than
printed as raw Markdown. Headings, lists, quotes, inline emphasis/code and
fenced code blocks are supported; a dim horizontal divider separates completed
question-and-answer turns.

The UI uses Node raw-mode keypress events and a small custom editor so the
timeline can scroll while a multi-line editor remains fixed at the bottom. It
supports basic text editing, left/right/home/end, backspace/delete, Ctrl+J
newline, timeline scrolling, and defensive handling of stray mouse-report
sequences. Mouse reporting is not enabled by KFC, so native terminal text
selection and copying remain available. Every input is treated as unknown at
the adapter boundary; unsupported control sequences never reach the editor.

## Architecture

### CLI gate

`runCli` gains injected terminal capability and `runInteractive` dependencies.
No-argument `kfc` runs the interactive entry only when both streams are TTYs;
the same command remains help for pipes and deterministic tests.

### Interactive session core

The workbench runner owns the process-local `ModelMessage[]`. For a normal
input it calls `runAgent` with the previous messages, the fixed read-only tool
definitions, and `maxSteps: 8`. On success it replaces the history with the
returned agent messages. On cancellation/failure it retains the previous
history, so incomplete tool turns never contaminate the next request.

The Agent Loop adds a narrow `onToolCall` observer invoked only after the
Provider has emitted a complete atomic Core Tool Call. UI code receives the
tool name only; arguments and tool result content stay out of the status line.

### Terminal adapter

The terminal runner owns Node streams, raw-mode, alternate-screen control,
animation timing, and process SIGINT subscription. The
WorkbenchState and renderer are pure seams; the runner's `runTurn`, status, and
terminal stream adapters remain injectable for deterministic tests without a
real TTY.

### Commands and cancellation

- `/help`: list commands and current read-only limitation in Chinese.
- `/status`: show safe resolved configuration, model, timeout, credential
  presence, Agent step limit, enabled-tool count, message/turn count, and real
  accumulated token usage. Unknown Provider context-window metadata remains
  unknown.
- `/tool`: show available tools and toggle their enabled state with Space;
  changes apply to the next Agent turn without restarting the session.
  Enabled edit and execute tools pause at a per-call arrow-key confirmation menu with `Yes`, `No`, and `Tell me why?`;
  denial is returned to the Agent as a structured Tool Result.
- `/clear`: request clearing both the visible timeline and conversation
  context; only `y` confirms.
- `/exit`: leave the loop and restore the original terminal.
- Ctrl+C while a turn is active aborts the shared signal and prints a safe
  cancellation notice. Ctrl+C at the prompt does not terminate the process;
  `/exit` remains explicit.

## Security and Reliability Invariants

- A user must opt into local read access by entering interactive `kfc` or
  invoking explicit `kfc agent`; `kfc ask` remains text-only.
- No terminal escape/control sequence from model, user, or tool text is
  replayed. Display content is sanitized before writing.
- The only generated ANSI sequences are constant UI controls and styling.
- Every session exit path restores cursor visibility and leaves the alternate
  screen.
- Provider protocol gating, tool limits, canonical workspace containment,
  Tool Registry validation, max steps, and SIGINT cancellation remain those of
  P2.4.

## Test Seams

- no-argument CLI routing: TTY enters the session; non-TTY retains help;
  command errors use the existing safe formatter.
- startup animation: bounded frames, narrow/no-color fallback, no dynamic
  control data.
- session loop: history is carried between successful turns; slash commands
  have the documented effects; cancellation preserves prior history; tool
  observer contains only names.
- terminal cleanup: input pause, raw-mode/cursor and alternate-screen
  restoration run after exit.
- existing P2.4 provider, registry, and Agent Loop tests remain regressions.

## Acceptance

Run `pnpm build`, `pnpm typecheck:tests`, `pnpm lint`, `pnpm format:check`, and
`pnpm test`. In an actual TTY, run `pnpm kfc`, observe KFLOW startup, issue a
read-only workspace question and a follow-up, use `/status`, then `/exit` and
verify the prior shell screen is restored. A real Provider call is optional if
the Provider is temporarily unavailable; terminal and session behavior retain
fully deterministic local coverage.
