// 导入配置类型和模型提供者接口
import type { ProviderConfig } from "../config/config.js";
import type { ModelProvider } from "./model-provider.js";
// 导入两种具体的提供者实现
import { OpenAiChatCompletionsProvider } from "./openai-compatible/openai-chat-completions-provider.js";
import { OpenAiResponsesProvider } from "./openai-compatible/openai-responses-provider.js";

// CreateModelProviderDependencies：创建提供者时的可注入依赖
export interface CreateModelProviderDependencies {
  readonly fetch?: typeof globalThis.fetch; // 可自定义 fetch（用于测试 mock）
}

// createModelProvider：根据配置中的 protocol 字段选择对应的提供者实现（工厂函数）
export function createModelProvider(
  config: ProviderConfig, // 提供者配置
  dependencies: CreateModelProviderDependencies = {}, // 可注入依赖
): ModelProvider {
  // 根据协议分发
  switch (config.protocol) {
    case "openai-chat-completions":
      // Chat Completions 协议：创建 OpenAiChatCompletionsProvider 实例
      return new OpenAiChatCompletionsProvider(config, dependencies);
    case "openai-responses":
      // Responses 协议：创建 OpenAiResponsesProvider 实例
      return new OpenAiResponsesProvider(config, dependencies);
  }
}
