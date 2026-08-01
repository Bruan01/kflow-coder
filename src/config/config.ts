// 导入 KfcError 基类和 ThemeName 类型
import { KfcError } from "../errors/kfc-error.js";
import type { ThemeName } from "./runtime-settings.js";

// ProviderProtocol：模型提供者支持的两种协议联合类型
export type ProviderProtocol = "openai-chat-completions" | "openai-responses";

// ProviderConfig：模型提供者的完整配置（运行时使用）
export interface ProviderConfig {
  type: "openai-compatible"; // 提供者类型（目前只有 openai-compatible）
  protocol: ProviderProtocol; // 协议：openai-chat-completions 或 openai-responses
  baseUrl: string; // API 基础 URL（如 https://api.openai.com/v1）
  model: string; // 模型名称（如 gpt-4o）
  apiKey: string; // API 密钥
  timeoutMs: number; // 请求超时时间（毫秒）
}

// KfcConfig：KFC 的顶层配置结构
export interface KfcConfig {
  provider: ProviderConfig; // 提供者配置（必填）
  ui?:
    | {
        // UI 配置（可选）
        theme: ThemeName; // 终端主题名称
      }
    | undefined;
}

// ConfigIssue：描述配置中的单个问题
export interface ConfigIssue {
  path: string; // 问题所在的配置路径（如 "provider.baseUrl"）
  message: string; // 人类可读的问题描述
}

// ConfigErrorCode：配置相关错误码的联合类型
export type ConfigErrorCode =
  | "CONFIG_FILE_READ_FAILED" // 配置文件读取失败
  | "CONFIG_FILE_INVALID" // 配置文件内容无效
  | "CREDENTIALS_FILE_READ_FAILED" // 凭证文件读取失败
  | "CREDENTIALS_FILE_INVALID" // 凭证文件内容无效
  | "CONFIG_INVALID"; // 配置不完整或无效

// ConfigError：配置错误类，继承自 KfcError，额外携带 issues 列表
export class ConfigError extends KfcError {
  readonly issues: readonly ConfigIssue[]; // 配置问题列表（只读）

  constructor(
    code: ConfigErrorCode, // 错误码
    message: string, // 错误消息
    issues: readonly ConfigIssue[] = [], // 问题列表，默认为空
  ) {
    // 调用父类构造函数，组装完整的 KfcErrorOptions
    super({
      category: "config", // 分类固定为 "config"
      code, // 传入的错误码
      message, // 传入的消息
      exitCode: 2, // 退出码 2（配置错误）
      retryable: false, // 配置错误不可自动重试（需要用户修正）
      details: { issues }, // 将 issues 放入 details 供下游消费
    });
    this.name = "ConfigError"; // 覆盖错误名称为 "ConfigError"
    this.issues = issues; // 赋值问题列表
  }
}
