import { describe, expect, it } from "vitest";

import { responsesStreamEventSchema } from "../../../src/provider/openai-compatible/responses-schema.js";

describe("responsesStreamEventSchema", () => {
  it("parses official text delta and completed event fields", () => {
    expect(
      responsesStreamEventSchema.parse({
        type: "response.output_text.delta",
        sequence_number: 3,
        item_id: "msg_123",
        output_index: 0,
        content_index: 0,
        delta: "Hello",
        logprobs: [],
      }),
    ).toEqual({
      type: "response.output_text.delta",
      sequence_number: 3,
      item_id: "msg_123",
      output_index: 0,
      content_index: 0,
      delta: "Hello",
    });

    expect(
      responsesStreamEventSchema.parse({
        type: "response.completed",
        sequence_number: 9,
        response: {
          id: "resp_123",
          status: "completed",
          usage: {
            input_tokens: 8,
            output_tokens: 2,
            total_tokens: 10,
            input_tokens_details: { cached_tokens: 0 },
          },
        },
      }),
    ).toEqual({
      type: "response.completed",
      sequence_number: 9,
      response: {
        status: "completed",
        usage: {
          input_tokens: 8,
          output_tokens: 2,
          total_tokens: 10,
        },
      },
    });
  });

  it("rejects malformed fields consumed by the adapter", () => {
    const cases = [
      {
        type: "response.output_text.delta",
        sequence_number: -1,
        item_id: "msg_123",
        output_index: 0,
        content_index: 0,
        delta: "text",
      },
      {
        type: "response.refusal.delta",
        sequence_number: 1,
        item_id: "",
        output_index: 0,
        content_index: 0,
        delta: 42,
      },
      {
        type: "error",
        sequence_number: 1,
        code: "x".repeat(129),
      },
      {
        type: "response.completed",
        sequence_number: 1,
        response: {
          status: "completed",
          usage: { input_tokens: 1.5, output_tokens: 1, total_tokens: 2.5 },
        },
      },
    ];

    for (const event of cases) {
      expect(responsesStreamEventSchema.safeParse(event).success).toBe(false);
    }
  });
});
