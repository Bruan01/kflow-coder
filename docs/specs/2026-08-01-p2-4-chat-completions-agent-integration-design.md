# P2.4 Chat Completions Agent Integration Design

## 1. Goal

Connect the existing controlled Agent Loop, typed Tool Registry, and P2.3
read-only workspace tools to a real OpenAI-compatible Chat Completions provider.
The first supported real target is the configured DeepSeek-compatible endpoint.

The user-facing acceptance is:

```bash
kfc agent "查看当前工作目录下的有什么文件，并且总结"
```

The model may request `list_directory`, `read_file`, and `grep`; KFC executes
them within the current working directory boundary, returns tool results to the
model, and prints the final answer.

## 2. Scope and Non-goals

### Included

- A new explicit `kfc agent <prompt...>` command.
- OpenAI Chat Completions request encoding for messages and function tools.
- Streaming `delta.tool_calls` decoding and assembly into atomic internal tool
  calls.
- Translation between protocol-neutral KFC messages/tool definitions and the
  OpenAI-compatible wire format.
- Read-only workspace tools rooted at `process.cwd()`.
- Abort handling, stable CLI errors, and a bounded agent loop.

### Excluded

- Changing `kfc ask`; it remains a one-turn text-only command and does not get
  file access implicitly.
- Anthropic Messages Provider support.
- `openai-responses` tool calling. `kfc agent` rejects that protocol clearly
  until it has its own adapter.
- Write, shell, network, git, or arbitrary command tools.
- Automatic conversion of arbitrary Zod schemas to JSON Schema.

## 3. Alternatives Considered

1. **Make `kfc ask` agentic.** Smallest CLI surface, but it silently changes a
   formerly text-only command into one with local file access. Rejected.
2. **Expose `kfc agent` only, using a Chat Completions adapter.** Keeps the
   privilege boundary visible and implements the protocol already accepted in
   P1. Recommended and selected.
3. **Support both Chat Completions and Responses tool calling now.** Broader
   protocol coverage but duplicates a stateful wire adapter and undermines the
   current phase boundary. Deferred.

## 4. Protocol-neutral Tool Contract

`ToolDefinition` gains an optional `parameters` field: a JSON Schema object for
the tool's input. All production tools exposed by `kfc agent` provide it. The
existing Zod `inputSchema` remains the execution-time authority. Legacy custom
tools without it receive a conservative empty-object fallback; they are not
used by the workspace agent. This intentional duplication is preferable to an
unverified generic Zod-to-JSON-Schema conversion and gives each external
protocol an explicit, portable schema.

`ToolRegistry` exposes the safe model-facing definitions only:

```ts
interface ModelToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
}
```

`ModelRequest` optionally contains `tools`. Providers which do not support
tool calling must reject a non-empty tools list rather than ignore it.

## 5. Chat Completions Wire Adapter

For an agent request, the provider sends:

```json
{
  "model": "...",
  "messages": ["translated KFC messages"],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "list_directory",
        "description": "...",
        "parameters": { "type": "object", "properties": {} }
      }
    }
  ],
  "tool_choice": "auto",
  "stream": true,
  "stream_options": { "include_usage": true }
}
```

KFC assistant tool calls become `assistant.tool_calls`, and KFC tool results
become `{ role: "tool", tool_call_id, content }`. `isError` stays encoded in
the safe JSON result content; it is not an unsupported provider field.

Streaming chunks can split `id`, function `name`, and JSON `arguments` across
multiple `delta.tool_calls` fragments. The adapter collects them by OpenAI
index, validates every completed call, parses its arguments as JSON, then emits
one internal `tool-call` event per call only after the finish reason
`tool_calls`. The finish reason maps to KFC's `tool-call`.

Malformed, duplicate, incomplete, or non-JSON calls fail as a safe
`PROVIDER_INVALID_RESPONSE`; no partial tool executes.

## 6. CLI and Agent Execution

`runCli` parses `agent` with the same prompt rules as `ask`. The executable
adapter:

1. loads the resolved configuration;
2. requires `openai-chat-completions`;
3. creates the provider, P2.3 read-only tools rooted at `process.cwd()`, and a
   `ToolRegistry`;
4. calls `runAgent` with the user message, registry executor, registry model
   tool definitions, and `maxSteps: 8`;
5. writes assistant text deltas to stdout as they are received;
6. applies one SIGINT abort controller across provider and tool work.

CLI diagnostics retain the established safe error formatter and use stderr.
After a tool-call turn, no synthetic narration is printed; only model text is
sent to stdout. This prevents duplicate output while still allowing a final
natural-language summary.

## 7. Test Seams and Acceptance

Public seams under test:

- `OpenAiChatCompletionsProvider.stream`: exact request encoding, fragmented
  tool-call assembly, invalid-response rejection, and normal text behavior.
- `runCli`: `agent` parsing, protocol gate, streamed output, and safe errors.
- Executable wiring / real acceptance: a configured DeepSeek-compatible
  endpoint can list the current directory and summarize it through tool calls.

Existing P2.3 workspace-tool tests remain the security regression suite.
Completion requires build, production/test type checks, lint, formatting,
full tests, a learning snapshot, and a real `kfc agent` acceptance request
when credentials are available.

## 8. Security Invariants

- File access is opt-in through `kfc agent`, never `kfc ask`.
- The workspace root is exactly the command's current directory.
- P2.3 canonical path and output-size restrictions remain authoritative.
- Tool schemas, calls, and results never contain credentials.
- No tool result, provider cause, raw HTTP response, absolute path, or stack is
  exposed in public CLI errors.
