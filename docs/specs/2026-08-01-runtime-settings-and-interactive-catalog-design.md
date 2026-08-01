# Runtime Settings and Interactive Catalog Design

## Context

Recent Agent and Workbench changes introduced several duplicated tables and
constants: Agent step limits were split between the Agent and CLI layers,
interactive commands were listed separately by the renderer and help output,
and tool display labels lived in the executable adapter. This makes a small
behavior change easy to apply incompletely.

## Decision

Use two typed, source-owned catalogs instead of one global constants file:

1. `src/config/runtime-settings.ts` owns runtime settings that affect Agent
   execution, including the default and maximum Agent step count and the
   environment variable name used for overrides.
2. `src/interactive/catalog.ts` owns user-facing interactive commands and
   localized tool labels. The Workbench renderer and terminal runner consume
   the same command catalog for menus and help text.

Protocol enums, error codes, ANSI control sequences, and workspace safety
limits remain in their existing domain modules. They are implementation
contracts rather than user-facing runtime settings.

## Invariants

- The default Agent step limit remains `8`.
- `KFC_AGENT_MAX_STEPS` remains bounded to `1..64`.
- Adding a command updates slash completion and `/help` from one record.
- Tool labels are presentation-only; Provider-facing tool names and
  descriptions remain unchanged.
- No API key or private configuration value enters a catalog or snapshot.

## Alternatives Considered

- A single `constants.ts`: rejected because it mixes Agent policy, terminal
  presentation, and protocol implementation concerns.
- An external user configuration file for all labels and limits: rejected for
  now because it adds persistence and validation scope without a user need.

## Acceptance

- TypeScript and all existing tests pass.
- Agent settings tests verify default, valid override, and invalid override.
- Interactive tests verify the shared command list, `/tool` display, and live
  tool status behavior.
- `/help`, `/status`, and the slash menu expose the same command set.
