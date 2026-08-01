import { describe, expect, it, vi } from "vitest";

import {
  runAgent,
  UserInterruptedError,
  type AgentToolExecutor,
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
    this.requests.push(request);
    const events = this.turns[this.turn++];
    if (events === undefined) throw new Error("Unexpected model turn");
    for (const event of events) yield event;
  }
}

function fakeExecutor(): AgentToolExecutor & {
  execute: ReturnType<typeof vi.fn>;
} {
  return {
    execute: vi.fn(async (toolCall) => ({
      toolCallId: toolCall.id,
      content: "unused",
      isError: false,
    })),
  };
}

describe("runAgent", () => {
  it("passes model tool definitions into every model step and streams text", async () => {
    const toolCall = {
      id: "call_lookup",
      name: "lookup",
      input: { query: "KFC" },
    };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
      [
        { type: "start" },
        { type: "text-delta", delta: "Found " },
        { type: "text-delta", delta: "it" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const toolExecutor: AgentToolExecutor = {
      async execute(call) {
        return { toolCallId: call.id, content: "result", isError: false };
      },
    };
    const definitions = [
      {
        name: "lookup",
        description: "Look up a term",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
        },
      },
    ];
    const text: string[] = [];
    const observedTools: string[] = [];
    const observedResults: {
      readonly toolCallId: string;
      readonly content: string;
      readonly isError: boolean;
      readonly durationMs: number;
    }[] = [];

    await expect(
      runAgent(
        {
          messages: [{ role: "user", content: "find KFC" }],
          maxSteps: 2,
          tools: definitions,
        },
        {
          provider,
          toolExecutor,
          onText: (delta) => text.push(delta),
          onToolCall: (call) => observedTools.push(call.name),
          onToolResult: ({ result, durationMs }) =>
            observedResults.push({ ...result, durationMs }),
        },
      ),
    ).resolves.toMatchObject({ finalText: "Found it", steps: 2 });

    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[0]?.tools).toEqual(definitions);
    expect(provider.requests[1]?.tools).toEqual(definitions);
    expect(text).toEqual(["Found ", "it"]);
    expect(observedTools).toEqual(["lookup"]);
    expect(observedResults).toHaveLength(1);
    expect(observedResults[0]).toMatchObject({
      toolCallId: "call_lookup",
      content: "result",
      isError: false,
    });
    expect(observedResults[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("completes a direct model answer without executing a tool", async () => {
    const initialMessages = [
      { role: "system" as const, content: "Be concise." },
      { role: "user" as const, content: "What is KFC?" },
    ];
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "text-delta", delta: "KFlow " },
        { type: "text-delta", delta: "Code" },
        {
          type: "usage",
          usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const toolExecutor = fakeExecutor();

    await expect(
      runAgent(
        { messages: initialMessages, maxSteps: 3 },
        { provider, toolExecutor },
      ),
    ).resolves.toEqual({
      messages: [
        ...initialMessages,
        { role: "assistant", content: "KFlow Code" },
      ],
      steps: 1,
      finalText: "KFlow Code",
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
    });
    expect(provider.requests).toEqual([{ messages: initialMessages }]);
    expect(toolExecutor.execute).not.toHaveBeenCalled();
    expect(initialMessages).toHaveLength(2);
  });

  it("feeds a tool result into the next model step and completes", async () => {
    const initialMessages = [{ role: "user" as const, content: "Look up KFC" }];
    const toolCall = {
      id: "call_1",
      name: "lookup",
      input: { query: "KFC" },
    };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "text-delta", delta: "I will check." },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
      [
        { type: "start" },
        { type: "text-delta", delta: "KFlow Code" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const toolExecutor: AgentToolExecutor = {
      execute: vi.fn(async (receivedCall) => ({
        toolCallId: receivedCall.id,
        content: "KFC means KFlow Code",
        isError: false,
      })),
    };

    await expect(
      runAgent(
        { messages: initialMessages, maxSteps: 3 },
        { provider, toolExecutor },
      ),
    ).resolves.toEqual({
      messages: [
        ...initialMessages,
        {
          role: "assistant",
          content: "I will check.",
          toolCalls: [toolCall],
        },
        {
          role: "tool",
          toolCallId: "call_1",
          content: "KFC means KFlow Code",
          isError: false,
        },
        { role: "assistant", content: "KFlow Code" },
      ],
      steps: 2,
      finalText: "KFlow Code",
      finishReason: "stop",
    });
    expect(provider.requests).toEqual([
      { messages: initialMessages },
      {
        messages: [
          ...initialMessages,
          {
            role: "assistant",
            content: "I will check.",
            toolCalls: [toolCall],
          },
          {
            role: "tool",
            toolCallId: "call_1",
            content: "KFC means KFlow Code",
            isError: false,
          },
        ],
      },
    ]);
    expect(toolExecutor.execute).toHaveBeenCalledOnce();
    expect(toolExecutor.execute).toHaveBeenCalledWith(toolCall, {});
  });

  it("stops before the next model step when cancellation occurs in a tool", async () => {
    const controller = new AbortController();
    const toolCall = {
      id: "call_cancel",
      name: "cancel",
      input: {},
    };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
      [
        { type: "start" },
        { type: "text-delta", delta: "must not run" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const toolExecutor: AgentToolExecutor = {
      execute: vi.fn(async () => {
        controller.abort();
        return {
          toolCallId: "call_cancel",
          content: "cancelled",
          isError: false,
        };
      }),
    };

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "cancel" }], maxSteps: 3 },
        { provider, toolExecutor },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(UserInterruptedError);
    expect(provider.requests).toHaveLength(1);
  });

  it("rejects a Tool Call ID already present in the initial conversation", async () => {
    const repeatedCall = {
      id: "call_existing",
      name: "lookup",
      input: { query: "again" },
    };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall: repeatedCall },
        { type: "finish", reason: "tool-call" },
      ],
    ]);
    const toolExecutor = fakeExecutor();

    await expect(
      runAgent(
        {
          messages: [
            { role: "user", content: "lookup twice" },
            {
              role: "assistant",
              content: "",
              toolCalls: [
                {
                  id: "call_existing",
                  name: "lookup",
                  input: { query: "first" },
                },
              ],
            },
            {
              role: "tool",
              toolCallId: "call_existing",
              content: "first result",
              isError: false,
            },
          ],
          maxSteps: 2,
        },
        { provider, toolExecutor },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
    expect(toolExecutor.execute).not.toHaveBeenCalled();
  });

  it("does not complete when cancellation occurs during a model turn", async () => {
    const controller = new AbortController();
    const provider: ModelProvider = {
      async *stream(): AsyncIterable<ModelStreamEvent> {
        yield { type: "start" };
        controller.abort();
        yield { type: "text-delta", delta: "must not complete" };
        yield { type: "finish", reason: "stop" };
      },
    };

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "cancel" }], maxSteps: 1 },
        { provider, toolExecutor: fakeExecutor() },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(UserInterruptedError);
  });

  it("executes multiple Tool Calls serially and feeds results back in order", async () => {
    const firstCall = { id: "call_a", name: "first", input: { value: 1 } };
    const secondCall = { id: "call_b", name: "second", input: { value: 2 } };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall: firstCall },
        { type: "tool-call", toolCall: secondCall },
        { type: "finish", reason: "tool-call" },
      ],
      [
        { type: "start" },
        { type: "text-delta", delta: "done" },
        { type: "finish", reason: "stop" },
      ],
    ]);
    const executionOrder: string[] = [];
    const toolExecutor: AgentToolExecutor = {
      execute: vi.fn(async (toolCall) => {
        executionOrder.push(toolCall.id);
        return {
          toolCallId: toolCall.id,
          content: `result:${toolCall.id}`,
          isError: false,
        };
      }),
    };

    const result = await runAgent(
      { messages: [{ role: "user", content: "run both" }], maxSteps: 2 },
      { provider, toolExecutor },
    );

    expect(executionOrder).toEqual(["call_a", "call_b"]);
    expect(provider.requests[1]).toEqual({
      messages: [
        { role: "user", content: "run both" },
        {
          role: "assistant",
          content: "",
          toolCalls: [firstCall, secondCall],
        },
        {
          role: "tool",
          toolCallId: "call_a",
          content: "result:call_a",
          isError: false,
        },
        {
          role: "tool",
          toolCallId: "call_b",
          content: "result:call_b",
          isError: false,
        },
      ],
    });
    expect(result).toMatchObject({ steps: 2, finalText: "done" });
  });

  it.each([0, -1, 1.5])("rejects invalid maxSteps=%s", async (maxSteps) => {
    const provider = new ScriptedProvider([]);

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "hello" }], maxSteps },
        { provider, toolExecutor: fakeExecutor() },
      ),
    ).rejects.toMatchObject({ code: "AGENT_INVALID_OPTIONS" });
    expect(provider.requests).toEqual([]);
  });

  it("does not execute a Tool Call requested on the last model step", async () => {
    const toolCall = { id: "call_last", name: "lookup", input: {} };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
    ]);
    const toolExecutor = fakeExecutor();

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "loop" }], maxSteps: 1 },
        { provider, toolExecutor },
      ),
    ).rejects.toMatchObject({ code: "AGENT_MAX_STEPS_EXCEEDED" });
    expect(toolExecutor.execute).not.toHaveBeenCalled();
  });

  it("rejects a Tool Result with the wrong call ID", async () => {
    const toolCall = { id: "call_expected", name: "lookup", input: {} };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
    ]);
    const toolExecutor: AgentToolExecutor = {
      execute: vi.fn(async () => ({
        toolCallId: "call_wrong",
        content: "wrong",
        isError: false,
      })),
    };

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "lookup" }], maxSteps: 2 },
        { provider, toolExecutor },
      ),
    ).rejects.toMatchObject({ code: "AGENT_INVALID_TOOL_RESULT" });
  });

  it("preserves a Tool Executor failure identity", async () => {
    const failure = new Error("scripted tool failure");
    const toolCall = { id: "call_fail", name: "fail", input: {} };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
    ]);
    const toolExecutor: AgentToolExecutor = {
      execute: vi.fn(async () => {
        throw failure;
      }),
    };

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "fail" }], maxSteps: 2 },
        { provider, toolExecutor },
      ),
    ).rejects.toBe(failure);
  });

  it.each([
    [
      "Tool Call with stop",
      [
        { type: "start" },
        {
          type: "tool-call",
          toolCall: { id: "call_1", name: "lookup", input: {} },
        },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "tool-call finish without a call",
      [{ type: "start" }, { type: "finish", reason: "tool-call" }],
    ],
    ["missing finish", [{ type: "start" }]],
    [
      "duplicate start",
      [
        { type: "start" },
        { type: "start" },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "invalid usage",
      [
        { type: "start" },
        {
          type: "usage",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 99 },
        },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "unknown event",
      [
        { type: "start" },
        { type: "future" } as unknown as ModelStreamEvent,
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "malformed Tool Call",
      [
        { type: "start" },
        {
          type: "tool-call",
          toolCall: {
            id: 123,
            name: "lookup",
            input: {},
          } as unknown as ModelToolCall,
        },
        { type: "finish", reason: "tool-call" },
      ],
    ],
  ] satisfies readonly [string, readonly ModelStreamEvent[]][])(
    "rejects an invalid model turn with %s",
    async (_label, events) => {
      await expect(
        runAgent(
          { messages: [{ role: "user", content: "hello" }], maxSteps: 1 },
          {
            provider: new ScriptedProvider([events]),
            toolExecutor: fakeExecutor(),
          },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
    },
  );

  it("rejects a Tool Call ID reused across model steps", async () => {
    const toolCall = { id: "call_repeat", name: "lookup", input: {} };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
    ]);
    const toolExecutor = fakeExecutor();

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "repeat" }], maxSteps: 3 },
        { provider, toolExecutor },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
    expect(toolExecutor.execute).toHaveBeenCalledOnce();
  });

  it("rejects duplicate Tool Call IDs inside initial messages", async () => {
    const duplicate = { id: "call_dup", name: "lookup", input: {} };
    const provider = new ScriptedProvider([]);

    await expect(
      runAgent(
        {
          messages: [
            {
              role: "assistant",
              content: "",
              toolCalls: [duplicate, duplicate],
            },
          ],
          maxSteps: 1,
        },
        { provider, toolExecutor: fakeExecutor() },
      ),
    ).rejects.toMatchObject({ code: "AGENT_INVALID_OPTIONS" });
    expect(provider.requests).toEqual([]);
  });

  it("does not call the model or tools when already aborted", async () => {
    const provider = new ScriptedProvider([]);
    const toolExecutor = fakeExecutor();
    const controller = new AbortController();
    controller.abort();

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "stop" }], maxSteps: 1 },
        { provider, toolExecutor },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(UserInterruptedError);
    expect(provider.requests).toEqual([]);
    expect(toolExecutor.execute).not.toHaveBeenCalled();
  });

  it("stops remaining tools when cancellation happens between calls", async () => {
    const controller = new AbortController();
    const firstCall = { id: "call_first", name: "first", input: {} };
    const secondCall = { id: "call_second", name: "second", input: {} };
    const provider = new ScriptedProvider([
      [
        { type: "start" },
        { type: "tool-call", toolCall: firstCall },
        { type: "tool-call", toolCall: secondCall },
        { type: "finish", reason: "tool-call" },
      ],
    ]);
    const execute = vi.fn(async (toolCall: typeof firstCall) => {
      controller.abort();
      return {
        toolCallId: toolCall.id,
        content: "first result",
        isError: false,
      };
    });

    await expect(
      runAgent(
        { messages: [{ role: "user", content: "two calls" }], maxSteps: 2 },
        { provider, toolExecutor: { execute } },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(UserInterruptedError);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(firstCall, {
      signal: controller.signal,
    });
  });
});
