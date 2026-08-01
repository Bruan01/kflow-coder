import { describe, expect, it } from "vitest";

import {
  ProviderError,
  UserInterruptedError,
  type ModelProvider,
  type ModelRequest,
  type ModelStreamEvent,
  type ModelStreamOptions,
  type ModelToolCall,
} from "../../src/index.js";

const request: ModelRequest = {
  messages: [
    { role: "system", content: "Answer concisely." },
    { role: "user", content: "What is KFlow Code?" },
  ],
};

class ScriptedModelProvider implements ModelProvider {
  constructor(
    private readonly events: readonly ModelStreamEvent[],
    private readonly failure?: ProviderError,
    private readonly expectedRequest: ModelRequest = request,
  ) {}

  async *stream(
    receivedRequest: ModelRequest,
    options: ModelStreamOptions = {},
  ): AsyncIterable<ModelStreamEvent> {
    expect(receivedRequest).toBe(this.expectedRequest);
    throwIfAborted(options.signal);

    for (const event of this.events) {
      throwIfAborted(options.signal);
      yield event;
      await Promise.resolve();
    }

    if (this.failure !== undefined) {
      throw this.failure;
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new UserInterruptedError();
  }
}

describe("ModelProvider contract", () => {
  it("streams normalized text, usage, and finish events in order", async () => {
    const provider = new ScriptedModelProvider([
      { type: "start" },
      { type: "text-delta", delta: "KFlow " },
      { type: "text-delta", delta: "Code" },
      {
        type: "usage",
        usage: { inputTokens: 12, outputTokens: 2, totalTokens: 14 },
      },
      { type: "finish", reason: "stop" },
    ]);
    const observed: ModelStreamEvent[] = [];

    for await (const event of provider.stream(request)) {
      observed.push(event);
    }

    expect(observed).toEqual([
      { type: "start" },
      { type: "text-delta", delta: "KFlow " },
      { type: "text-delta", delta: "Code" },
      {
        type: "usage",
        usage: { inputTokens: 12, outputTokens: 2, totalTokens: 14 },
      },
      { type: "finish", reason: "stop" },
    ]);
    expect(
      observed
        .filter(
          (
            event,
          ): event is Extract<
            ModelStreamEvent,
            { readonly type: "text-delta" }
          > => event.type === "text-delta",
        )
        .map((event) => event.delta)
        .join(""),
    ).toBe("KFlow Code");
  });

  it("preserves structured ProviderError failures from async iteration", async () => {
    const failure = new ProviderError(
      "PROVIDER_SERVICE_UNAVAILABLE",
      "Provider is temporarily unavailable",
      { details: { status: 503 } },
    );
    const provider = new ScriptedModelProvider([{ type: "start" }], failure);

    const consume = async (): Promise<void> => {
      for await (const event of provider.stream(request)) {
        void event;
        // Consume until the scripted provider fails.
      }
    };

    await expect(consume()).rejects.toBe(failure);
    await expect(consume()).rejects.toMatchObject({
      category: "provider",
      code: "PROVIDER_SERVICE_UNAVAILABLE",
      retryable: true,
      details: { status: 503 },
    });
  });

  it("rejects an already-aborted request with UserInterruptedError", async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new ScriptedModelProvider([
      { type: "start" },
      { type: "finish", reason: "stop" },
    ]);

    const consume = async (): Promise<void> => {
      for await (const event of provider.stream(request, {
        signal: controller.signal,
      })) {
        void event;
        // No event may be observed after cancellation.
      }
    };

    await expect(consume()).rejects.toBeInstanceOf(UserInterruptedError);
    await expect(consume()).rejects.toMatchObject({
      code: "USER_INTERRUPTED",
      exitCode: 130,
    });
  });

  it("stops subsequent events when aborted during consumption", async () => {
    const controller = new AbortController();
    const provider = new ScriptedModelProvider([
      { type: "start" },
      { type: "text-delta", delta: "first" },
      { type: "text-delta", delta: "must-not-arrive" },
      { type: "finish", reason: "stop" },
    ]);
    const observed: ModelStreamEvent[] = [];

    const consume = async (): Promise<void> => {
      for await (const event of provider.stream(request, {
        signal: controller.signal,
      })) {
        observed.push(event);
        if (event.type === "text-delta") {
          controller.abort();
        }
      }
    };

    await expect(consume()).rejects.toBeInstanceOf(UserInterruptedError);
    expect(observed).toEqual([
      { type: "start" },
      { type: "text-delta", delta: "first" },
    ]);
  });

  it("represents atomic tool calls and tool result messages without wire fields", async () => {
    const toolCall: ModelToolCall = {
      id: "call_1",
      name: "lookup",
      input: { query: "KFC" },
    };
    const toolRequest: ModelRequest = {
      messages: [
        { role: "user", content: "Look up KFC" },
        { role: "assistant", content: "", toolCalls: [toolCall] },
        {
          role: "tool",
          toolCallId: "call_1",
          content: "KFlow Code",
          isError: false,
        },
      ],
    };
    const provider = new ScriptedModelProvider(
      [
        { type: "start" },
        { type: "tool-call", toolCall },
        { type: "finish", reason: "tool-call" },
      ],
      undefined,
      toolRequest,
    );
    const observed: ModelStreamEvent[] = [];

    for await (const event of provider.stream(toolRequest)) {
      observed.push(event);
    }

    expect(observed).toEqual([
      { type: "start" },
      { type: "tool-call", toolCall },
      { type: "finish", reason: "tool-call" },
    ]);
    expect(toolRequest.messages[2]).toEqual({
      role: "tool",
      toolCallId: "call_1",
      content: "KFlow Code",
      isError: false,
    });
  });
});
