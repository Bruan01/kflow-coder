// 导入 KfcError 基类和 KfcErrorCode 类型
import { type KfcErrorCode, KfcError } from "./kfc-error.js";

// ProviderErrorCode 是从 KfcErrorCode 中提取的与提供者相关的错误码子集
export type ProviderErrorCode = Extract<
  KfcErrorCode,
  | "PROVIDER_AUTHENTICATION_FAILED" // 认证失败
  | "PROVIDER_QUOTA_EXCEEDED" // 配额超限
  | "PROVIDER_RATE_LIMITED" // 速率限制
  | "PROVIDER_TIMEOUT" // 请求超时
  | "PROVIDER_CONTEXT_LIMIT" // 上下文超限
  | "PROVIDER_SERVICE_UNAVAILABLE" // 服务不可用
  | "PROVIDER_INVALID_RESPONSE" // 无效响应
>;

// ProviderError 的构造选项接口（比 KfcErrorOptions 更精简）
export interface ProviderErrorOptions {
  details?: Readonly<Record<string, unknown>>; // 可选的公开详情
  debugDetails?: Readonly<Record<string, unknown>>; // 可选的调试详情
  cause?: unknown; // 可选的原始错误
}

// 可重试的错误码集合：速率限制、超时、服务不可用这三种情况重试可能成功
const RETRYABLE_CODES = new Set<ProviderErrorCode>([
  "PROVIDER_RATE_LIMITED", // 速率限制 — 等待后可重试
  "PROVIDER_TIMEOUT", // 超时 — 网络恢复后可重试
  "PROVIDER_SERVICE_UNAVAILABLE", // 服务不可用 — 服务恢复后可重试
]);

// ProviderError 是提供者相关的错误类，继承自 KfcError
export class ProviderError extends KfcError {
  // 构造函数：接收错误码、消息和可选的选项对象
  constructor(
    code: ProviderErrorCode,
    message: string,
    options: ProviderErrorOptions = {}, // 默认为空对象
  ) {
    // 调用父类 KfcError 构造函数，自动组装完整的 KfcErrorOptions
    super({
      category: "provider", // 分类固定为 "provider"
      code, // 传入的错误码
      message, // 传入的消息
      exitCode: 3, // 退出码固定为 3（提供者错误）
      retryable: RETRYABLE_CODES.has(code), // 根据错误码判断是否可重试
      // 条件展开：只在 details 存在时才包含 details 字段
      ...(options.details === undefined ? {} : { details: options.details }),
      // 条件展开：只在 debugDetails 存在时才包含 debugDetails 字段
      ...(options.debugDetails === undefined
        ? {}
        : { debugDetails: options.debugDetails }),
      // 条件展开：只在 cause 存在时才包含 cause 字段
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "ProviderError"; // 覆盖错误名称为 "ProviderError"
  }
}
