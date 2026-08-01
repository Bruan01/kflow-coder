// KfcError 错误分类：config(配置)、provider(提供者)、agent(智能体)、user_interrupted(用户中断)、internal(内部)
export type KfcErrorCategory =
  "config" | "provider" | "agent" | "user_interrupted" | "internal";

// KfcError 具体错误码联合类型，涵盖配置、提供者、智能体、工具、用户中断、内部等所有错误场景
export type KfcErrorCode =
  | "CONFIG_FILE_READ_FAILED" // 配置文件读取失败
  | "CONFIG_FILE_INVALID" // 配置文件内容无效
  | "CREDENTIALS_FILE_READ_FAILED" // 凭证文件读取失败
  | "CREDENTIALS_FILE_INVALID" // 凭证文件内容无效
  | "CONFIG_INVALID" // 配置无效
  | "PROVIDER_AUTHENTICATION_FAILED" // 提供者认证失败
  | "PROVIDER_QUOTA_EXCEEDED" // 提供者配额超限
  | "PROVIDER_RATE_LIMITED" // 提供者速率限制
  | "PROVIDER_TIMEOUT" // 提供者请求超时
  | "PROVIDER_CONTEXT_LIMIT" // 提供者上下文长度超限
  | "PROVIDER_SERVICE_UNAVAILABLE" // 提供者服务不可用
  | "PROVIDER_INVALID_RESPONSE" // 提供者返回无效响应
  | "AGENT_INVALID_OPTIONS" // 智能体选项无效
  | "AGENT_MAX_STEPS_EXCEEDED" // 智能体超过最大步数
  | "AGENT_INVALID_TOOL_RESULT" // 智能体工具结果无效
  | "AGENT_REPEATED_TOOL_CALL" // 智能体重复执行无进展工具调用
  | "SESSION_STORAGE_FAILED" // 会话日志读写失败
  | "TOOL_DEFINITION_INVALID" // 工具定义无效
  | "TOOL_NAME_DUPLICATE" // 工具名称重复
  | "USER_INTERRUPTED" // 用户中断操作
  | "INTERNAL_ERROR"; // 内部未知错误

// KfcError 构造选项接口，定义创建 KfcError 所需的所有参数
export interface KfcErrorOptions {
  category: KfcErrorCategory; // 错误分类
  code: KfcErrorCode; // 错误码
  message: string; // 用户可见的错误消息
  exitCode: number; // 进程退出码
  retryable: boolean; // 是否可重试
  details?: Readonly<Record<string, unknown>>; // 可选的公开详情（对用户可见）
  debugDetails?: Readonly<Record<string, unknown>>; // 可选的调试详情（仅 debug 模式可见）
  cause?: unknown; // 可选的原始错误原因（链式错误）
}

// KfcError 是所有 KFC 错误的基类，继承自标准 Error，增加了结构化错误信息
export class KfcError extends Error {
  readonly category: KfcErrorCategory; // 错误分类（只读）
  readonly code: KfcErrorCode; // 错误码（只读）
  readonly exitCode: number; // 进程退出码（只读）
  readonly retryable: boolean; // 是否可重试（只读）
  readonly details: Readonly<Record<string, unknown>> | undefined; // 公开详情（只读，可选）
  readonly debugDetails: Readonly<Record<string, unknown>> | undefined; // 调试详情（只读，可选）

  // 构造函数，接收 KfcErrorOptions 对象来初始化所有字段
  constructor(options: KfcErrorOptions) {
    // 调用父类 Error 的构造函数，传入消息和 cause（如果有的话）
    super(
      options.message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "KfcError"; // 设置错误名称为 "KfcError"
    this.category = options.category; // 赋值错误分类
    this.code = options.code; // 赋值错误码
    this.exitCode = options.exitCode; // 赋值进程退出码
    this.retryable = options.retryable; // 赋值是否可重试
    this.details = options.details; // 赋值公开详情
    this.debugDetails = options.debugDetails; // 赋值调试详情
  }

  // 序列化为 JSON 对象，用于日志输出或 API 响应
  toJSON(): object {
    return {
      name: this.name, // 错误名称
      category: this.category, // 错误分类
      code: this.code, // 错误码
      message: this.message, // 错误消息
      exitCode: this.exitCode, // 退出码
      retryable: this.retryable, // 是否可重试
      details: this.details, // 公开详情
    };
  }
}
