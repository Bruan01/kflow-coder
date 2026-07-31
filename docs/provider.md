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

## Failure Boundary

Caller cancellation becomes `USER_INTERRUPTED`; the configured deadline becomes `PROVIDER_TIMEOUT`. Authentication, quota, rate limiting, context limit, temporary service errors, and invalid responses use stable KFC codes. Raw Provider messages, response bodies, authorization headers, API keys, and stacks are never public error output.

Automated tests use injected Providers/fetch functions, deterministic clocks, real `Response`/`ReadableStream` objects, and redacted fixtures. They never access external networks or developer credentials.
