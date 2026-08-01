import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  OpenAiChatCompletionsProvider,
  type ModelRequest,
  type ModelStreamEvent,
  type ProviderConfig,
} from "../../../src/index.js";

const config: ProviderConfig = {
  type: "openai-compatible",
  protocol: "openai-chat-completions",
  baseUrl: "https://provider.example/v1/",
  model: "fixture-model",
  apiKey: "fixture-secret-key",
  timeoutMs: 60000,
};

const request: ModelRequest = {
  messages: [
    { role: "system", content: "Answer briefly." },
    { role: "user", content: "Say hello." },
  ],
};

async function fixture(name: string): Promise<string> {
  return readFile(
    new URL(
      `../../fixtures/provider/openai-chat-completions/${name}`,
      import.meta.url,
    ),
    "utf8",
  );
}

async function collect(
  provider: OpenAiChatCompletionsProvider,
  modelRequest: ModelRequest = request,
): Promise<ModelStreamEvent[]> {
  const events: ModelStreamEvent[] = [];
  for await (const event of provider.stream(modelRequest)) events.push(event);
  return events;
}

function successfulResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

describe("OpenAiChatCompletionsProvider", () => {
  it("encodes a mainstream request and maps DeepSeek final usage", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      successfulResponse(await fixture("deepseek-final-usage.sse")),
    );
    const provider = new OpenAiChatCompletionsProvider(config, { fetch });

    await expect(collect(provider)).resolves.toEqual([
      { type: "start" },
      { type: "text-delta", delta: "Hello" },
      { type: "text-delta", delta: " world" },
      {
        type: "usage",
        usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 },
      },
      { type: "finish", reason: "stop" },
    ]);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://provider.example/v1/chat/completions");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer fixture-secret-key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("text/event-stream");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "fixture-model",
      messages: request.messages,
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it("defers finish until a separate OpenAI usage chunk is consumed", async () => {
    const provider = new OpenAiChatCompletionsProvider(config, {
      fetch: vi.fn(async () =>
        successfulResponse(await fixture("openai-separate-usage.sse")),
      ),
    });

    await expect(collect(provider)).resolves.toEqual([
      { type: "start" },
      { type: "text-delta", delta: "partial" },
      {
        type: "usage",
        usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5 },
      },
      { type: "finish", reason: "length" },
    ]);
  });

  it("encodes tool messages and emits complete calls from fragmented tool deltas", async () => {
    const toolRequest: ModelRequest = {
      messages: [
        { role: "user", content: "List the workspace" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_prior",
              name: "list_directory",
              input: { path: "." },
            },
          ],
        },
        {
          role: "tool",
          toolCallId: "call_prior",
          content: '{"path":".","entries":[]}',
          isError: false,
        },
      ],
      tools: [
        {
          name: "list_directory",
          description: "List a workspace directory",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
          },
        },
      ],
    };
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      successfulResponse(`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_next","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\"README"}}]},"finish_reason":null}]}

data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":".md\\"}"}}]},"finish_reason":"tool_calls"}]}

data: [DONE]

`),
    );
    const provider = new OpenAiChatCompletionsProvider(config, { fetch });

    await expect(collect(provider, toolRequest)).resolves.toEqual([
      { type: "start" },
      {
        type: "tool-call",
        toolCall: {
          id: "call_next",
          name: "read_file",
          input: { path: "README.md" },
        },
      },
      { type: "finish", reason: "tool-call" },
    ]);

    const [, init] = fetch.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "fixture-model",
      messages: [
        { role: "user", content: "List the workspace" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_prior",
              type: "function",
              function: {
                name: "list_directory",
                arguments: '{"path":"."}',
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_prior",
          content: '{"path":".","entries":[]}',
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "list_directory",
            description: "List a workspace directory",
            parameters: {
              type: "object",
              properties: { path: { type: "string" } },
            },
          },
        },
      ],
      tool_choice: "auto",
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it("rejects incomplete or invalid fragmented Tool Calls", async () => {
    const cases = [
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_missing","type":"function","function":{"name":"read_file","arguments":"{"}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_bad","type":"function","function":{"name":"read_file","arguments":"[]"}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',
    ];

    for (const body of cases) {
      const provider = new OpenAiChatCompletionsProvider(config, {
        fetch: vi.fn(async () => successfulResponse(body)),
      });
      await expect(
        collect(provider, { messages: [], tools: [] }),
      ).rejects.toMatchObject({
        code: "PROVIDER_INVALID_RESPONSE",
      });
    }
  });

  it("normalizes unsupported finish reasons without leaking wire values", async () => {
    const provider = new OpenAiChatCompletionsProvider(config, {
      fetch: vi.fn(async () =>
        successfulResponse(
          'data: {"choices":[{"index":0,"delta":{},"finish_reason":"vendor_reason"}]}\n\ndata: [DONE]\n\n',
        ),
      ),
    });

    await expect(collect(provider)).resolves.toEqual([
      { type: "start" },
      { type: "finish", reason: "unknown" },
    ]);
  });

  it.each([
    [401, {}, "PROVIDER_AUTHENTICATION_FAILED", false],
    [402, {}, "PROVIDER_QUOTA_EXCEEDED", false],
    [429, {}, "PROVIDER_RATE_LIMITED", true],
    [
      429,
      { error: { code: "insufficient_quota" } },
      "PROVIDER_QUOTA_EXCEEDED",
      false,
    ],
    [
      400,
      { error: { code: "context_length_exceeded" } },
      "PROVIDER_CONTEXT_LIMIT",
      false,
    ],
    [503, {}, "PROVIDER_SERVICE_UNAVAILABLE", true],
    [418, {}, "PROVIDER_INVALID_RESPONSE", false],
  ] as const)("maps HTTP %s to %s", async (status, body, code, retryable) => {
    const provider = new OpenAiChatCompletionsProvider(config, {
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          }),
      ),
    });

    await expect(collect(provider)).rejects.toMatchObject({
      code,
      retryable,
      exitCode: 3,
    });
  });

  it("rejects malformed successful streams without leaking provider data", async () => {
    const leaked = "raw-provider-secret";
    const cases = [
      new Response(leaked, { status: 200 }),
      new Response(`data: ${leaked}\n\n`, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
      successfulResponse(
        'data: {"choices":[{"index":0,"delta":{"content":"x"},"finish_reason":"stop"}]}\n\n',
      ),
      successfulResponse(
        'data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":2,"total_tokens":99}}\n\ndata: [DONE]\n\n',
      ),
      successfulResponse(
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":"late"},"finish_reason":null}]}\n\ndata: [DONE]\n\n',
      ),
      successfulResponse(
        'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\ndata: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\ndata: [DONE]\n\n',
      ),
    ];

    for (const response of cases) {
      const provider = new OpenAiChatCompletionsProvider(config, {
        fetch: vi.fn(async () => response),
      });
      try {
        await collect(provider);
        throw new Error("Expected stream to fail");
      } catch (error) {
        expect(error).toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
        expect(JSON.stringify(error)).not.toContain(leaked);
        expect(JSON.stringify(error)).not.toContain(config.apiKey);
      }
    }
  });
});
