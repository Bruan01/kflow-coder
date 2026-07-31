import { describe, expect, it, vi } from "vitest";

import {
  ProviderError,
  runAsk,
  UserInterruptedError,
  type ModelProvider,
  type ModelRequest,
  type ModelStreamEvent,
  type ModelStreamOptions,
} from "../../src/index.js";

class ScriptedProvider implements ModelProvider {
  readonly requests: ModelRequest[] = [];

  constructor(
    private readonly events: readonly ModelStreamEvent[],
    private readonly failure?: Error,
  ) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    this.requests.push(request);
    for (const event of this.events) yield event;
    if (this.failure !== undefined) throw this.failure;
  }
}

class PendingProvider implements ModelProvider {
  private markReady: (() => void) | undefined;
  readonly ready = new Promise<void>((resolve) => {
    this.markReady = resolve;
  });

  async *stream(
    _request: ModelRequest,
    options: ModelStreamOptions = {},
  ): AsyncIterable<ModelStreamEvent> {
    yield { type: "start" };
    this.markReady?.();
    await new Promise<void>((_resolve, reject) => {
      const signal = options.signal;
      if (signal?.aborted === true) {
        reject(new UserInterruptedError());
        return;
      }
      signal?.addEventListener(
        "abort",
        () => reject(new UserInterruptedError()),
        { once: true },
      );
    });
  }
}

function clock(...values: number[]): () => number {
  const queue = [...values];
  return () => {
    const value = queue.shift();
    if (value === undefined) throw new Error("Clock exhausted");
    return value;
  };
}

describe("runAsk", () => {
  it("streams one user prompt and returns metrics from the real event flow", async () => {
    const provider = new ScriptedProvider([
      { type: "start" },
      { type: "text-delta", delta: "Hello" },
      { type: "text-delta", delta: " world" },
      {
        type: "usage",
        usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 },
      },
      { type: "finish", reason: "stop" },
    ]);
    const onText = vi.fn();

    await expect(
      runAsk("Say hello", {
        provider,
        onText,
        now: clock(100, 125, 180),
      }),
    ).resolves.toEqual({
      timeToFirstTokenMs: 25,
      totalDurationMs: 80,
      usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 },
      finishReason: "stop",
      endedWithNewline: false,
    });
    expect(provider.requests).toEqual([
      { messages: [{ role: "user", content: "Say hello" }] },
    ]);
    expect(onText.mock.calls).toEqual([["Hello"], [" world"]]);
  });

  it.each([
    [
      "missing start",
      [
        { type: "text-delta", delta: "orphan" },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "duplicate start",
      [
        { type: "start" },
        { type: "start" },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "duplicate usage",
      [
        { type: "start" },
        {
          type: "usage",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
        {
          type: "usage",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "invalid usage arithmetic",
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
      "content after finish",
      [
        { type: "start" },
        { type: "finish", reason: "stop" },
        { type: "text-delta", delta: "late" },
      ],
    ],
    [
      "duplicate finish",
      [
        { type: "start" },
        { type: "finish", reason: "stop" },
        { type: "finish", reason: "stop" },
      ],
    ],
    [
      "unknown runtime event",
      [
        { type: "start" },
        { type: "future-event" } as unknown as ModelStreamEvent,
        { type: "finish", reason: "stop" },
      ],
    ],
    ["missing finish", [{ type: "start" }]],
  ] satisfies readonly [string, readonly ModelStreamEvent[]][])(
    "rejects a stream with %s",
    async (_label, events) => {
      await expect(
        runAsk("hello", {
          provider: new ScriptedProvider(events),
          onText: vi.fn(),
          now: () => 0,
        }),
      ).rejects.toMatchObject({
        code: "PROVIDER_INVALID_RESPONSE",
        retryable: false,
      });
    },
  );

  it("does not call the provider when the signal is already aborted", async () => {
    const provider = new ScriptedProvider([
      { type: "start" },
      { type: "finish", reason: "stop" },
    ]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      runAsk(
        "hello",
        { provider, onText: vi.fn(), now: () => 0 },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(UserInterruptedError);
    expect(provider.requests).toEqual([]);
  });

  it("reports null TTFT for a successful response without visible text", async () => {
    const onText = vi.fn();

    await expect(
      runAsk("silent", {
        provider: new ScriptedProvider([
          { type: "start" },
          { type: "text-delta", delta: "" },
          { type: "finish", reason: "content-filter" },
        ]),
        onText,
        now: clock(10, 40),
      }),
    ).resolves.toEqual({
      timeToFirstTokenMs: null,
      totalDurationMs: 30,
      finishReason: "content-filter",
      endedWithNewline: false,
    });
    expect(onText).not.toHaveBeenCalled();
  });

  it("preserves the original ProviderError identity", async () => {
    const failure = new ProviderError(
      "PROVIDER_SERVICE_UNAVAILABLE",
      "Provider is temporarily unavailable",
    );

    await expect(
      runAsk("hello", {
        provider: new ScriptedProvider([{ type: "start" }], failure),
        onText: vi.fn(),
        now: () => 0,
      }),
    ).rejects.toBe(failure);
  });

  it("preserves interruption during stream consumption", async () => {
    const provider = new PendingProvider();
    const controller = new AbortController();
    const pending = runAsk(
      "hello",
      { provider, onText: vi.fn(), now: () => 0 },
      { signal: controller.signal },
    );

    await provider.ready;
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(UserInterruptedError);
  });
});
