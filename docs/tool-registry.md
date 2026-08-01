# Tool Registry Boundary

`ToolRegistry` is the in-memory execution boundary between atomic model Tool Calls and tool implementations. It implements `AgentToolExecutor`, so the Agent Loop does not know about Zod, lookup maps, or exception formatting.

## Define a Tool

```ts
const echoTool = defineTool({
  name: "echo",
  description: "Echo text from an in-memory fixture",
  parameters: {
    type: "object",
    properties: {
      value: { type: "string" },
      uppercase: { type: "boolean" },
    },
    required: ["value"],
    additionalProperties: false,
  },
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

`parameters` is optional JSON Schema exposed to a model provider. Production
workspace tools provide it explicitly; the Zod `inputSchema` remains the
execution-time authority. `registry.listModelDefinitions()` returns only the
name, description, and parameters safe to send to a provider. A legacy custom
tool without parameters receives a conservative empty-object schema.

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

## Current Workspace Tool Surface

`createWorkspaceTools()` registers the common local coding surface:

- `read`: `list_directory`, `find_files`, `read_file`, `grep`; enabled by default.
- `edit`: `apply_patch`, `write_file`; disabled by default. `apply_patch` requires
  one exact match and `write_file` refuses to overwrite an existing file.
- `execute`: `shell`; disabled by default. It fixes the working directory inside
  the workspace, strips Provider credentials from the child environment, and
  bounds timeout and combined output.

`registry.listModelDefinitions()` exposes only enabled tools, so `/tool` changes
take effect on the next Agent turn without changing the Provider contract.
All workspace paths still pass through the canonical boundary and all failures
return structured Tool Results. Shell is bounded but is not an operating-system
sandbox; explicit enablement is therefore required and remains an audit point.
