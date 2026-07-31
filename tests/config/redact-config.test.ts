import { describe, expect, it } from "vitest";

import { redactConfig } from "../../src/config/redact-config.js";

describe("redactConfig", () => {
  it("preserves useful provider information while removing the API key", () => {
    const result = redactConfig({
      provider: {
        type: "openai-compatible",
        protocol: "openai-chat-completions",
        baseUrl: "https://provider.example/v1",
        model: "model-a",
        apiKey: "real-secret-value",
        timeoutMs: 60000,
      },
    });

    expect(result).toEqual({
      provider: {
        type: "openai-compatible",
        protocol: "openai-chat-completions",
        baseUrl: "https://provider.example/v1",
        model: "model-a",
        apiKey: "[REDACTED]",
        timeoutMs: 60000,
      },
    });
    expect(JSON.stringify(result)).not.toContain("real-secret-value");
  });
});
