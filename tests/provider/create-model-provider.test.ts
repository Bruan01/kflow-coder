import { describe, expect, it, vi } from "vitest";

import {
  createModelProvider,
  OpenAiChatCompletionsProvider,
  OpenAiResponsesProvider,
  type ProviderConfig,
  type ProviderProtocol,
} from "../../src/index.js";

function config(protocol: ProviderProtocol): ProviderConfig {
  return {
    type: "openai-compatible",
    protocol,
    baseUrl: "https://provider.example/v1",
    model: "fixture-model",
    apiKey: "factory-test-secret",
    timeoutMs: 60000,
  };
}

describe("createModelProvider", () => {
  it.each([
    ["openai-chat-completions", OpenAiChatCompletionsProvider],
    ["openai-responses", OpenAiResponsesProvider],
  ] as const)("maps %s to its explicit adapter", (protocol, ProviderClass) => {
    const fetch = vi.fn<typeof globalThis.fetch>();

    const provider = createModelProvider(config(protocol), { fetch });

    expect(provider).toBeInstanceOf(ProviderClass);
    expect(fetch).not.toHaveBeenCalled();
  });
});
