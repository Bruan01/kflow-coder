import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ToolRegistry,
  defineTool,
  runAgent,
  type ModelProvider,
  type ModelRequest,
  type ModelStreamEvent,
  type ModelToolCall,
} from "../../src/index.js";

class ScriptedProvider implements ModelProvider {
  readonly requests: ModelRequest[] = [];
  private turn = 0;

  constructor(
    private readonly turns: readonly (readonly ModelStreamEvent[])[],
  ) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    this.requests.push({ messages: [...request.messages] });
    const events = this.turns[this.turn++];
    if (events === undefined) throw new Error("Unexpected model turn");
    for (const event of events) yield event;
  }
}

function toolTurn(toolCall: ModelToolCall): readonly ModelStreamEvent[] {
  return [
    { type: "start" },
    { type: "tool-call", toolCall },
    { type: "finish", reason: "tool-call" },
  ];
}

const finalTurn: readonly ModelStreamEvent[] = [
  { type: "start" },
  { type: "text-delta", delta: "handled" },
  { type: "finish", reason: "stop" },
];

describe("ToolRegistry Agent Loop integration", () => {
  it("feeds a validated successful result into the next ModelRequest", async () => {
    const toolCall = {
      id: "call_echo",
      name: "echo",
      input: { value: "hello" },
    };
    const provider = new ScriptedProvider([toolTurn(toolCall), finalTurn]);
    const registry = new ToolRegistry([
      defineTool({
        name: "echo",
        description: "Uppercase text",
        inputSchema: z.object({ value: z.string() }),
        async execute(input) {
          return { content: input.value.toUpperCase(), isError: false };
        },
      }),
    ]);

    const result = await runAgent(
      { messages: [{ role: "user", content: "echo hello" }], maxSteps: 2 },
      { provider, toolExecutor: registry },
    );

    expect(provider.requests[1]?.messages).toContainEqual({
      role: "tool",
      toolCallId: "call_echo",
      content: "HELLO",
      isError: false,
    });
    expect(result).toMatchObject({ steps: 2, finalText: "handled" });
  });

  it.each([
    [
      "unknown tool",
      new ToolRegistry(),
      { id: "call_missing", name: "missing", input: {} },
      { code: "TOOL_NOT_FOUND", tool: "missing" },
    ],
    [
      "invalid input",
      new ToolRegistry([
        defineTool({
          name: "search",
          description: "Search fixtures",
          inputSchema: z.object({ query: z.string().min(1) }),
          async execute(input) {
            return { content: input.query, isError: false };
          },
        }),
      ]),
      { id: "call_invalid", name: "search", input: { query: "" } },
      { code: "TOOL_INPUT_INVALID", tool: "search", paths: ["query"] },
    ],
  ] as const)(
    "feeds a structured %s result back and allows the model to finish",
    async (_label, registry, toolCall, expectedError) => {
      const provider = new ScriptedProvider([toolTurn(toolCall), finalTurn]);

      const result = await runAgent(
        { messages: [{ role: "user", content: "use tool" }], maxSteps: 2 },
        { provider, toolExecutor: registry },
      );

      const toolMessage = provider.requests[1]?.messages.find(
        (message) => message.role === "tool",
      );
      expect(toolMessage).toMatchObject({
        role: "tool",
        toolCallId: toolCall.id,
        isError: true,
      });
      if (toolMessage?.role !== "tool") throw new Error("Missing tool message");
      expect(JSON.parse(toolMessage.content)).toEqual({ error: expectedError });
      expect(result).toMatchObject({ steps: 2, finalText: "handled" });
    },
  );
});
