import { describe, expect, it } from "vitest";

import {
  chatCompletionChunkSchema,
  providerErrorResponseSchema,
} from "../../../src/provider/openai-compatible/chat-completions-schema.js";

describe("chatCompletionChunkSchema", () => {
  it("accepts mainstream chunks while preserving only validated fields", () => {
    const result = chatCompletionChunkSchema.safeParse({
      id: "chunk-id",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "hello" },
          finish_reason: null,
          vendor_extension: true,
        },
      ],
      usage: null,
      vendor_extension: { ignored: true },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.choices[0]).toMatchObject({
        index: 0,
        delta: { content: "hello" },
        finish_reason: null,
      });
    }
  });

  it("rejects malformed consumed fields", () => {
    expect(
      chatCompletionChunkSchema.safeParse({
        choices: [{ index: "zero", delta: { content: 42 } }],
      }).success,
    ).toBe(false);
    expect(
      chatCompletionChunkSchema.safeParse({
        choices: [],
        usage: {
          prompt_tokens: 1.5,
          completion_tokens: 2,
          total_tokens: 3.5,
        },
      }).success,
    ).toBe(false);
  });
});

describe("providerErrorResponseSchema", () => {
  it("accepts a bounded machine-readable error code", () => {
    expect(
      providerErrorResponseSchema.parse({
        error: {
          code: "insufficient_quota",
          message: "untrusted provider text",
        },
      }),
    ).toMatchObject({ error: { code: "insufficient_quota" } });
  });

  it("rejects oversized error codes", () => {
    expect(
      providerErrorResponseSchema.safeParse({
        error: { code: "x".repeat(129) },
      }).success,
    ).toBe(false);
  });
});
