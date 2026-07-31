import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenAiChatCompletionsProvider,
  UserInterruptedError,
  type ModelRequest,
  type ModelStreamEvent,
  type ModelStreamOptions,
  type ProviderConfig,
} from "../../../src/index.js";

const request: ModelRequest = {
  messages: [{ role: "user", content: "hello" }],
};

function config(timeoutMs = 60000): ProviderConfig {
  return {
    type: "openai-compatible",
    protocol: "openai-chat-completions",
    baseUrl: "https://provider.example/v1",
    model: "fixture-model",
    apiKey: "lifecycle-secret",
    timeoutMs,
  };
}

function pendingFetch(): typeof globalThis.fetch {
  return vi.fn((_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!(signal instanceof AbortSignal)) {
        reject(new Error("Expected AbortSignal"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  });
}

function streamIterator(
  provider: OpenAiChatCompletionsProvider,
  options: ModelStreamOptions = {},
): AsyncIterator<ModelStreamEvent> {
  return provider.stream(request, options)[Symbol.asyncIterator]();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OpenAiChatCompletionsProvider lifecycle", () => {
  it("does not call fetch when the caller signal is already aborted", async () => {
    const fetch = vi.fn();
    const provider = new OpenAiChatCompletionsProvider(config(), {
      fetch: fetch as typeof globalThis.fetch,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      streamIterator(provider, { signal: controller.signal }).next(),
    ).rejects.toBeInstanceOf(UserInterruptedError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps caller cancellation while fetch is pending", async () => {
    const provider = new OpenAiChatCompletionsProvider(config(), {
      fetch: pendingFetch(),
    });
    const controller = new AbortController();
    const pending = streamIterator(provider, {
      signal: controller.signal,
    }).next();

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "USER_INTERRUPTED",
      exitCode: 130,
    });
  });

  it("maps the internal deadline to a retryable timeout", async () => {
    vi.useFakeTimers();
    const provider = new OpenAiChatCompletionsProvider(config(1000), {
      fetch: pendingFetch(),
    });
    const pending = streamIterator(provider).next();
    const rejection = expect(pending).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      retryable: true,
      exitCode: 3,
    });

    await vi.advanceTimersByTimeAsync(1000);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops stream consumption when the caller aborts", async () => {
    const caller = new AbortController();
    const fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"index":0,"delta":{"content":"first"},"finish_reason":null}]}\n\n',
            ),
          );
          signal?.addEventListener(
            "abort",
            () => controller.error(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });
    const provider = new OpenAiChatCompletionsProvider(config(), { fetch });
    const iterator = streamIterator(provider, { signal: caller.signal });

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: "start" },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: "text-delta", delta: "first" },
    });
    caller.abort();

    await expect(iterator.next()).rejects.toBeInstanceOf(UserInterruptedError);
  });

  it("cancels the response body when the consumer exits early", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"choices":[{"index":0,"delta":{"content":"first"},"finish_reason":null}]}\n\n',
          ),
        );
      },
      cancel,
    });
    const provider = new OpenAiChatCompletionsProvider(config(), {
      fetch: vi.fn(
        async () =>
          new Response(body, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          }),
      ),
    });

    for await (const event of provider.stream(request)) {
      if (event.type === "text-delta") break;
    }

    expect(cancel).toHaveBeenCalledOnce();
  });

  it("normalizes unknown network failures without exposing their message", async () => {
    const leaked = "network-secret-detail";
    const provider = new OpenAiChatCompletionsProvider(config(), {
      fetch: vi.fn(async () => {
        throw new Error(leaked);
      }),
    });

    try {
      await streamIterator(provider).next();
      throw new Error("Expected network failure");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROVIDER_SERVICE_UNAVAILABLE",
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain(leaked);
      expect(JSON.stringify(error)).not.toContain(config().apiKey);
    }
  });
});
