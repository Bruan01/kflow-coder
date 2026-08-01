# Security Policy

KFC is a learning-first coding agent. Its core contract is that models propose
actions, the program authorizes them, and tools execute them. This policy
describes how to report a vulnerability and what guarantees the project makes.

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities. Instead,
report privately by opening a GitHub Security Advisory, or by contacting the
maintainers directly if you have a private channel.

In your report, include:

- the affected version,
- the steps to reproduce,
- the impact you observed (for example, secret exposure, path traversal, or
  unbounded command execution),
- a suggested fix if you have one.

We aim to acknowledge reports within 5 business days and to keep you informed
as the fix is prepared.

## Security guarantees

### Secrets

- API keys are forbidden in `config.json` and in source code.
- Keys come only from `KFC_API_KEY` or the Base-URL-bound `credentials.json`,
  which must be created with mode `0600`.
- Credentials are never logged, serialized without redaction, or included in
  LR Machine snapshots. `kfc doctor` never reveals a key and never contacts a
  Provider.

### Workspace boundary

- All workspace tools operate inside a canonical root and reject path
  traversal and external symlinks.
- `.git` is hidden from the tool surface.
- File reads, search results, and command output are bounded to prevent
  unbounded resource use.

### Least privilege

- Observation tools are enabled by default; Edit and Execute tools are
  disabled by default.
- Once enabled, every individual Edit/Execute call requires explicit
  confirmation with `Yes`, `No`, or `Tell me why?`; a rejection returns a
  structured denial to the Agent instead of executing.
- `shell` is disabled by default and runs with bounded cwd, timeout,
  environment, and output.
- `git_diff` is read-only and uses fixed Git subprocess arguments without a
  shell.

### Error handling

- Domain failures extend `KfcError` with stable codes.
- Public output contains only safe messages and details; raw causes, unknown
  stacks, and third-party errors are never printed directly.

## Scope

LR Machine is a local read-only dashboard. It must never expose `.env`,
secrets, absolute paths, arbitrary file reads, or write/command endpoints. If
you find a way to make LR Machine read arbitrary files or expose secrets,
report it as a vulnerability regardless of local-only status.
