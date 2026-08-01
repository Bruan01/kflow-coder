// 从 config 模块导出 ConfigError 类（配置错误）
export { ConfigError } from "./config/config.js";
// 从 ask 模块导出所有公开 API（提问功能）
export * from "./ask/index.js";
// 从 agent 模块导出所有公开 API（智能体功能）
export * from "./agent/index.js";
// 导出配置相关的 TypeScript 类型（仅类型，编译后不产生 JS 代码）
export type {
  ConfigErrorCode, // 配置错误码类型
  ConfigIssue, // 配置问题描述类型
  KfcConfig, // KFC 完整配置类型
  ProviderConfig, // 模型提供者配置类型
  ProviderProtocol, // 提供者协议类型（如 openai-chat-completions）
} from "./config/config.js";
// 导出配置文件和凭证文件的路径解析函数
export {
  resolveConfigPath, // 解析配置文件路径
  resolveCredentialsPath, // 解析凭证文件路径
} from "./config/config-path.js";
// 导出加载配置的函数
export { loadConfig } from "./config/load-config.js";
// 导出脱敏配置的函数（隐藏 API Key 等敏感信息）
export { redactConfig } from "./config/redact-config.js";
// 导出运行时设置相关的常量和函数
export {
  DEFAULT_THEME, // 默认终端主题
  runtimeSettings, // 运行时设置对象
} from "./config/runtime-settings.js";
// 导出主题名称类型（仅类型）
export type { ThemeName } from "./config/runtime-settings.js";
// 导出原子写入主题的函数
export { writeThemeAtomically } from "./config/write-theme.js";
// 导出脱敏后的配置类型（仅类型）
export type { RedactedKfcConfig } from "./config/redact-config.js";
// 从 doctor 模块导出所有公开 API（诊断功能）
export * from "./doctor/index.js";
// 从 errors 模块导出所有公开 API（错误处理）
export * from "./errors/index.js";
// 从 interactive 模块导出所有公开 API（交互终端）
export * from "./interactive/index.js";
// 从 quickstart 模块导出所有公开 API（快速入门）
export * from "./quickstart/index.js";
// 从 provider 模块导出所有公开 API（模型提供者）
export * from "./provider/index.js";
// 从 tool 模块导出所有公开 API（工具系统）
export * from "./tool/index.js";

// 项目的名称常量，用于标识和显示
export const projectName = "kflow-code";
