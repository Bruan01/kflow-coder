# Provider Protocol Boundary

KFC exposes one protocol-neutral `ModelProvider` to Core. Wire-protocol adapters translate HTTP, streaming events, usage, finish reasons, cancellation, and errors into that contract.

## Protocol Status

| Protocol                  | Status      | Scope                                                                                 |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `openai-chat-completions` | implemented | text messages, SSE text deltas, usage, finish, timeout, cancellation, safe errors     |
| `openai-responses`        | implemented | typed SSE, text/refusal projection, usage, terminal events, cancellation, safe errors |
| `anthropic-messages`      | deferred    | explicitly skipped for now; not a current P1 completion gate                          |

Configuration selects the protocol explicitly. KFC does not infer it from Base URL, model name, response shape, or a failed first request.

## Chat Completions Request

`OpenAiChatCompletionsProvider` uses Node.js 22 native `fetch` and sends:

```text
POST <baseUrl>/chat/completions
Accept: text/event-stream
Content-Type: application/json
Authorization: Bearer <API Key>
```

The JSON body contains the configured model, normalized Core messages, `stream: true`, and `stream_options.include_usage: true`. It does not send sampling, reasoning, tools, or vendor-specific fields.

## Responses Request

`OpenAiResponsesProvider` sends:

```text
POST <baseUrl>/responses
Accept: text/event-stream
Content-Type: application/json
Authorization: Bearer <API Key>
```

The JSON body contains the configured model, Core messages as `input`, `stream: true`, and `store: false`. It does not send previous response IDs, reasoning parameters, tools, or multimodal options.

Responses typed SSE is projected conservatively:

- `response.output_text.delta` and `response.refusal.delta` become `text-delta`.
- Known lifecycle and reasoning events are validated and ignored.
- Unexpected tool, function, multimodal, unknown, or multiple visible-text outputs fail with `PROVIDER_INVALID_RESPONSE`.
- Terminal response usage is preserved when present.
- `response.completed` maps to `stop`; incomplete output maps to `length`, `content-filter`, or `unknown`.
- `response.failed` and `error` become safe structured Provider errors.
- Success requires a typed terminal event. Responses does not use Chat Completions `[DONE]` as its terminal condition.

## Stream Invariants

- A validated successful response starts with one `start` event.
- Non-empty protocol content becomes `text-delta`; empty deltas are ignored.
- Complete non-negative Token statistics become at most one `usage` event.
- The adapter defers the normalized `finish` event until protocol `[DONE]`, so it remains last even when usage arrives after the wire finish reason.
- Invalid JSON, invalid usage, missing `[DONE]`, content after finish, duplicate usage, or an invalid response shape throws `PROVIDER_INVALID_RESPONSE`.

Responses additionally requires strictly increasing event sequence numbers and at most one visible text location. EOF without a completed/incomplete terminal event is invalid.

Both adapters share the incremental SSE decoder and request lifecycle. The decoder supports arbitrary network chunk boundaries, split UTF-8, LF/CRLF, comments, unknown fields, and multiline `data:` events.

## Ask Consumption Boundary

`kfc ask <prompt...>` loads validated configuration, selects one of the implemented adapters through the explicit protocol factory, and sends exactly one user message. The protocol-neutral Ask Runner:

- streams non-empty `text-delta` content to stdout without buffering the full answer;
- keeps metrics and errors on stderr so stdout remains pipe-friendly;
- derives TTFT, total duration, usage, finish reason, and trailing-newline state from the real event flow;
- requires one start and one terminal finish, and rejects duplicate lifecycle events or invalid usage;
- passes AbortSignal through to the Provider and preserves structured errors.

Metrics remain local to the Ask report. KFC does not yet persist or upload telemetry, and it does not introduce a general observability decorator before another real consumer needs one.

## Agent Tool Boundary

The protocol-neutral contract supports an atomic `tool-call` event, assistant messages containing Tool Calls, tool-result messages, a normalized `tool-call` finish reason, and optional model-safe JSON Schema tool definitions. These are Core concepts: IDs, tool names, complete JSON inputs, string results, error flags, and JSON Schema parameters. No OpenAI argument delta, Responses item index, or vendor field enters the Agent Loop.

The Chat Completions adapter encodes model tool definitions as `tools[].function`, assistant calls as `tool_calls`, and Tool Results as `role: tool` with `tool_call_id`. It buffers stream fragments by tool-call index and emits an atomic Core Tool Call only once `tool_calls` finishes and its arguments form a JSON object. Malformed, incomplete, duplicate, or non-JSON calls are rejected as `PROVIDER_INVALID_RESPONSE` before a tool runs.

`kfc agent <prompt...>` is the explicit real Tool Calling entry point. It is limited to `openai-chat-completions`, uses the current directory as the P2 read-only workspace root, passes the same definitions on each bounded Agent turn, and shares Ctrl+C cancellation across Provider and tools. `kfc ask` remains a one-turn text-only command. The `openai-responses` adapter rejects a non-empty Tool definition list until its independent Tool Calling wire adapter exists.

The TTY-only `kfc` workbench reuses this same Agent path and keeps messages only
for the current process. It aggregates validated `usage` events across every
model step in a completed Agent turn, then across successful interactive turns
for `/status`. If a Provider omits usage or context-window metadata, the UI
shows that value as unavailable/unknown instead of estimating it. A transient
`PROVIDER_SERVICE_UNAVAILABLE` means the request lifecycle saw a non-KFC
network failure or a mapped upstream 5xx; the workbench keeps the session open
and the user may retry the prompt.

## Failure Boundary

Caller cancellation becomes `USER_INTERRUPTED`; the configured deadline becomes `PROVIDER_TIMEOUT`. Authentication, quota, rate limiting, context limit, temporary service errors, and invalid responses use stable KFC codes. Raw Provider messages, response bodies, authorization headers, API keys, and stacks are never public error output.

Automated tests use injected Providers/fetch functions, deterministic clocks, real `Response`/`ReadableStream` objects, and redacted fixtures. They never access external networks or developer credentials.
