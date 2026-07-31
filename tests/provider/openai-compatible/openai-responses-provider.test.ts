import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  OpenAiResponsesProvider,
  type ModelRequest,
  type ModelStreamEvent,
} from "../../../src/index.js";

const config = {
  type: "openai-compatible" as const,
  protocol: "openai-responses" as const,
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
      `../../fixtures/provider/openai-responses/${name}`,
      import.meta.url,
    ),
    "utf8",
  );
}

async function collect(
  provider: OpenAiResponsesProvider,
): Promise<ModelStreamEvent[]> {
  const events: ModelStreamEvent[] = [];
  for await (const event of provider.stream(request)) events.push(event);
  return events;
}

function successfulResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

describe("OpenAiResponsesProvider", () => {
  it("encodes a Responses request and projects a completed text stream", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      successfulResponse(await fixture("openai-text-completed.sse")),
    );
    const provider = new OpenAiResponsesProvider(config, { fetch });

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
    expect(url).toBe("https://provider.example/v1/responses");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer fixture-secret-key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("text/event-stream");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "fixture-model",
      input: request.messages,
      stream: true,
      store: false,
    });
  });

  it("projects refusal text while ignoring reasoning events", async () => {
    const provider = new OpenAiResponsesProvider(config, {
      fetch: vi.fn(async () =>
        successfulResponse(await fixture("openai-refusal-completed.sse")),
      ),
    });

    await expect(collect(provider)).resolves.toEqual([
      { type: "start" },
      { type: "text-delta", delta: "I cannot" },
      { type: "text-delta", delta: " help with that." },
      { type: "finish", reason: "stop" },
    ]);
  });

  it.each([
    ["max_output_tokens", "length"],
    ["content_filter", "content-filter"],
    ["provider_specific_reason", "unknown"],
  ] as const)(
    "maps incomplete reason %s to %s",
    async (incompleteReason, finishReason) => {
      const provider = new OpenAiResponsesProvider(config, {
        fetch: vi.fn(async () =>
          successfulResponse(
            `data: ${JSON.stringify({
              type: "response.incomplete",
              sequence_number: 0,
              response: {
                status: "incomplete",
                incomplete_details: { reason: incompleteReason },
                usage: {
                  input_tokens: 5,
                  output_tokens: 3,
                  total_tokens: 8,
                },
              },
            })}\n\n`,
          ),
        ),
      });

      await expect(collect(provider)).resolves.toEqual([
        { type: "start" },
        {
          type: "usage",
          usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        },
        { type: "finish", reason: finishReason },
      ]);
    },
  );

  it.each([
    [
      {
        type: "response.failed",
        sequence_number: 0,
        response: {
          status: "failed",
          error: { code: "server_error", message: "raw-server-secret" },
        },
      },
      "PROVIDER_SERVICE_UNAVAILABLE",
      true,
    ],
    [
      {
        type: "error",
        sequence_number: 0,
        code: "rate_limit_exceeded",
        message: "raw-rate-limit-secret",
        param: null,
      },
      "PROVIDER_RATE_LIMITED",
      true,
    ],
    [
      {
        type: "error",
        sequence_number: 0,
        code: "unrecognized_wire_code",
        message: "raw-unknown-secret",
        param: null,
      },
      "PROVIDER_INVALID_RESPONSE",
      false,
    ],
  ] as const)(
    "maps a stream failure to %s without leaking provider text",
    async (wireEvent, code, retryable) => {
      const provider = new OpenAiResponsesProvider(config, {
        fetch: vi.fn(async () =>
          successfulResponse(`data: ${JSON.stringify(wireEvent)}\n\n`),
        ),
      });

      try {
        await collect(provider);
        throw new Error("Expected stream to fail");
      } catch (error) {
        expect(error).toMatchObject({ code, retryable, exitCode: 3 });
        expect(JSON.stringify(error)).not.toContain("raw-");
        expect(JSON.stringify(error)).not.toContain(config.apiKey);
      }
    },
  );

  it.each([
    {
      type: "response.output_item.added",
      sequence_number: 0,
      output_index: 0,
      item: {
        id: "call_123",
        type: "function_call",
        status: "in_progress",
        name: "lookup",
        arguments: "",
      },
    },
    {
      type: "response.content_part.added",
      sequence_number: 0,
      item_id: "msg_123",
      output_index: 0,
      content_index: 0,
      part: { type: "output_audio", transcript: "unsupported" },
    },
  ])("rejects unexpected output announced by wrapper events", async (event) => {
    const terminal = {
      type: "response.completed",
      sequence_number: 1,
      response: { status: "completed", usage: null },
    };
    const provider = new OpenAiResponsesProvider(config, {
      fetch: vi.fn(async () =>
        successfulResponse(
          `data: ${JSON.stringify(event)}\n\ndata: ${JSON.stringify(terminal)}\n\n`,
        ),
      ),
    });

    await expect(collect(provider)).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("rejects malformed streams and protocol invariant violations", async () => {
    const completed = {
      type: "response.completed",
      sequence_number: 2,
      response: { status: "completed", usage: null },
    };
    const cases = [
      "data: [DONE]\n\n",
      'data: {"type":"response.created","sequence_number":0}\n\n',
      `data: ${JSON.stringify({ type: "response.created", sequence_number: 2 })}\n\ndata: ${JSON.stringify(completed)}\n\n`,
      `data: ${JSON.stringify({ type: "response.output_text.delta", sequence_number: 0, item_id: "a", output_index: 0, content_index: 0, delta: "first" })}\n\ndata: ${JSON.stringify({ type: "response.output_text.delta", sequence_number: 1, item_id: "b", output_index: 1, content_index: 0, delta: "second" })}\n\ndata: ${JSON.stringify(completed)}\n\n`,
      `data: ${JSON.stringify({ type: "response.output_text.done", sequence_number: 0, item_id: "a", output_index: 0, content_index: 0, text: "done" })}\n\ndata: ${JSON.stringify({ type: "response.output_text.delta", sequence_number: 1, item_id: "a", output_index: 0, content_index: 0, delta: "late" })}\n\ndata: ${JSON.stringify(completed)}\n\n`,
      `data: ${JSON.stringify({ type: "response.function_call_arguments.delta", sequence_number: 0, item_id: "call_123", output_index: 0, delta: "{}" })}\n\ndata: ${JSON.stringify(completed)}\n\n`,
      `data: ${JSON.stringify({ type: "response.future_event", sequence_number: 0 })}\n\ndata: ${JSON.stringify(completed)}\n\n`,
      `data: ${JSON.stringify({ type: "response.completed", sequence_number: 0, response: { status: "completed", usage: { input_tokens: 2, output_tokens: 3, total_tokens: 99 } } })}\n\n`,
      `data: ${JSON.stringify({ type: "response.completed", sequence_number: 0, response: { status: "failed", usage: null } })}\n\n`,
    ];

    for (const body of cases) {
      const provider = new OpenAiResponsesProvider(config, {
        fetch: vi.fn(async () => successfulResponse(body)),
      });

      await expect(collect(provider)).rejects.toMatchObject({
        code: "PROVIDER_INVALID_RESPONSE",
        retryable: false,
      });
    }
  });
});
