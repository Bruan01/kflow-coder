# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- P0 engineering skeleton and boundaries: strict TypeScript project, pnpm
  toolchain, Vitest, ESLint, Prettier, `kfc --help`, `kfc --version`,
  `kfc doctor`, and the interactive `kfc --quickstart` wizard.
- P1 single-turn model calls: protocol-neutral `ModelProvider` contract,
  OpenAI-compatible Chat Completions and Responses adapters, streaming,
  timeout, `AbortController` cancellation, and `kfc ask`.
- P2 controlled Agent Loop: typed Zod Tool Registry, bounded workspace tools
  (`list_directory`, `read_file`, `grep`, `find_files`), Chat Completions Tool
  Calling, and the TTY-only KFLOW interactive workbench with timeline, live
  status, terminal Markdown projection, and Chinese command menu.
- P3 least-privilege write and execute: `apply_patch`, `write_file`, bounded
  `shell`, per-call confirmation (`Yes` / `No` / `Tell me why?`), read-only
  `git_diff`, and failure recovery reporting.

### Documentation

- Rewrote `README.md` with badges, a table of contents, current-status table,
  and complete usage, configuration, security, architecture, and roadmap
  sections.
- Added a Simplified Chinese guide (`README.zh-CN.md`) that mirrors the English
  README and documents the TTY workbench, command menu, and Agent behavior.
- Added `CONTRIBUTING.md` (ground rules, development setup, PR checklist, and
  the learning-evidence workflow) and `SECURITY.md` (vulnerability reporting and
  security guarantees).
- Added `CHANGELOG.md` (Keep a Changelog) and the MIT `LICENSE` referenced by
  the README.

### CI

- Added `.github/workflows/ci.yml` that runs build, test type-check, lint,
  formatting, unit tests, and LR Machine tests on push/PR to `main`.

### Security

- Read-only workspace tools enabled by default; Edit and Execute tools are
  disabled until explicitly enabled and require per-call confirmation.
- Workspace boundary rejects traversal and external symlinks, hides `.git`,
  and enforces file/search/output limits.
- API keys are never logged, serialized without redaction, or included in LR
  Machine snapshots; credentials live only in the environment or a mode-`0600`
  Base-URL-bound `credentials.json`.

## [0.1.0]

### Added

- Initial learning-first coding agent scaffold, learning assets, and the LR
  Machine learning dashboard with immutable HTML snapshots.
