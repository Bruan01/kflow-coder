# Tool Registry Boundary

`ToolRegistry` is the in-memory execution boundary between atomic model Tool Calls and tool implementations. It implements `AgentToolExecutor`, so the Agent Loop does not know about Zod, lookup maps, or exception formatting.

## Define a Tool

```ts
const echoTool = defineTool({
  name: "echo",
  description: "Echo text from an in-memory fixture",
  inputSchema: z.object({
    value: z.string().trim().min(1),
    uppercase: z.boolean().default(false),
  }),
  async execute(input) {
    return {
      content: input.uppercase ? input.value.toUpperCase() : input.value,
      isError: false,
    };
  },
});
```

`input` is inferred from the Zod output. Defaults, transforms, coercion and unknown-field stripping happen before execute.

## Execute Through the Registry

```ts
const registry = new ToolRegistry([echoTool]);
const result = await registry.execute({
  id: "call_1",
  name: "echo",
  input: { value: "KFC", uppercase: true },
});
```

The Registry always supplies the original Tool Call ID in the result. A successful result is passed directly into the Agent Loop as a tool message.

## Safe Failure Results

Unknown tools, invalid inputs and thrown execution failures become `isError: true` results with stable JSON content:

```json
{
  "error": {
    "code": "TOOL_INPUT_INVALID",
    "tool": "echo",
    "paths": ["value"]
  }
}
```

Supported result codes:

- `TOOL_NOT_FOUND`
- `TOOL_INPUT_INVALID`
- `TOOL_EXECUTION_FAILED`

Raw inputs, Zod messages, thrown values, causes and stacks are never included. `UserInterruptedError` remains an interruption rather than an error Tool Result.

## Current Limits

P2.2 contains only in-memory fake tools. The Registry does not yet read files, execute Shell commands, apply permissions, impose timeouts, truncate output, generate Provider JSON Schema, or run tools in parallel.
