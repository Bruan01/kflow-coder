import type { ProviderConfig } from "../config/config.js";
import type { ModelProvider } from "./model-provider.js";
import { OpenAiChatCompletionsProvider } from "./openai-compatible/openai-chat-completions-provider.js";
import { OpenAiResponsesProvider } from "./openai-compatible/openai-responses-provider.js";

export interface CreateModelProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

export function createModelProvider(
  config: ProviderConfig,
  dependencies: CreateModelProviderDependencies = {},
): ModelProvider {
  switch (config.protocol) {
    case "openai-chat-completions":
      return new OpenAiChatCompletionsProvider(config, dependencies);
    case "openai-responses":
      return new OpenAiResponsesProvider(config, dependencies);
  }
}
