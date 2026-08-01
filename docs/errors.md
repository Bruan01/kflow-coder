# KFC Error Contract

KFC errors separate machine decisions from user-safe presentation. Raw provider responses, unknown error messages, causes, stacks, credentials, and authorization headers are not user output.

## Categories and Exit Codes

| Category           | Examples                                                                       | Exit code | Retryable       |
| ------------------ | ------------------------------------------------------------------------------ | --------: | --------------- |
| `internal`         | unknown/unclassified failure                                                   |         1 | no              |
| `config`           | missing or invalid configuration                                               |         2 | no              |
| `provider`         | authentication, quota, rate limit, timeout, context, service, invalid response |         3 | depends on code |
| `agent`            | invalid options, maximum steps, invalid Tool Result                            |         1 | no              |
| `user_interrupted` | Ctrl+C or explicit cancellation                                                |       130 | no              |

Provider failures considered retryable are rate limiting, timeout, and temporary service unavailability. Authentication, exhausted quota, context limit, and invalid response errors require a configuration, account, input, or adapter change.

Agent control failures are non-retryable without changing the run: invalid explicit numeric `maxSteps`, an exhausted explicitly bounded model-step budget, or a Tool Result that does not match its Tool Call. Production CLI and TUI runs use `maxSteps: "unlimited"`; normal termination comes from a non-tool model response, Provider/context failure, or user interruption. Model stream violations remain Provider errors, while Tool Executor failures retain their original identity until the Tool Registry defines structured failure results.

Tool Registry definition failures use the agent category with `TOOL_DEFINITION_INVALID` or `TOOL_NAME_DUPLICATE`. Runtime tool lookup, input and execution failures do not become KfcError: they are safe `isError: true` Tool Results so the model can observe and recover. Cancellation remains `USER_INTERRUPTED`.

## Public and Debug Information

`KfcError` contains:

- `category`, `code`, `exitCode`, and `retryable` for program decisions.
- `message` and optional `details` for user-safe output.
- optional `debugDetails` for explicit debug presentation only.
- optional `cause`, which is never serialized or printed by the standard presenter.

Debug objects recursively redact keys matching API keys, tokens, authorization, secrets, credentials, and passwords. Unknown errors normalize to `INTERNAL_ERROR`; their original message and stack are not shown because their safety is unknown.

## CLI Presentation

```text
Error [CONFIG_INVALID]: Configuration is incomplete or invalid
  - provider.apiKey: Provider API Key is required
```

The CLI should set `process.exitCode` from the formatted error instead of calling `process.exit()` inside Core modules.
