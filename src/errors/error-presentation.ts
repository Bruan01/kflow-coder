// 导入 KfcError 基类
import { KfcError } from "./kfc-error.js";

// ErrorPresentationOptions：格式化错误时的可选配置
export interface ErrorPresentationOptions {
  debug?: boolean; // 是否输出调试信息（含脱敏后的详情）
}

// ErrorPresentation：格式化后的错误呈现结果
export interface ErrorPresentation {
  exitCode: number; // 进程退出码
  text: string; // 格式化的错误文本
}

// 敏感字段名正则：匹配 api_key、api-key、authorization、token、secret、password、credential 等
const SENSITIVE_KEY =
  /api[-_]?key|authorization|token|secret|password|credential/i;

// sanitizeDebugValue：递归脱敏调试值，防止敏感信息泄露到日志中
function sanitizeDebugValue(
  value: unknown, // 要脱敏的值
  key: string | undefined, // 当前值的键名（用于判断是否敏感字段）
  seen: WeakSet<object>, // 已处理对象的集合（防止循环引用）
): unknown {
  // 如果键名匹配敏感字段正则，直接返回 [REDACTED]
  if (key && SENSITIVE_KEY.test(key)) {
    return "[REDACTED]";
  }
  // 如果是 Error 对象，只保留其 name 属性
  if (value instanceof Error) {
    return { name: value.name };
  }
  // 如果是数组，递归处理每个元素
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDebugValue(item, undefined, seen));
  }
  // 如果是普通对象（非 null），需要递归脱敏其属性
  if (typeof value === "object" && value !== null) {
    // 检测循环引用：已经处理过的对象返回 [CIRCULAR]
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value); // 将当前对象加入已处理集合
    // 对每个属性递归脱敏，重建对象
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey, // 保留键名
        sanitizeDebugValue(childValue, childKey, seen), // 递归脱敏值
      ]),
    );
  }
  // 如果是 bigint，转为字符串
  if (typeof value === "bigint") {
    return value.toString();
  }
  // 基本类型（string、number、boolean 等）直接返回
  return value;
}

// publicIssueLines：从 KfcError 的 details.issues 中提取用户可见的问题行
function publicIssueLines(error: KfcError): string[] {
  // 尝试从 details 中获取 issues 数组
  const issues = error.details?.issues;
  // 如果 issues 不是数组，返回空数组
  if (!Array.isArray(issues)) return [];

  // 遍历每个 issue，格式化为 "  - path: message" 的形式
  return issues.flatMap((issue) => {
    // 跳过非对象或 null 的 issue
    if (typeof issue !== "object" || issue === null) return [];
    // 提取 path 字段，默认为 "config"
    const path = "path" in issue ? String(issue.path) : "config";
    // 提取 message 字段，默认为 "Invalid value"
    const message =
      "message" in issue ? String(issue.message) : "Invalid value";
    // 返回格式化的单行问题描述
    return [`  - ${path}: ${message}`];
  });
}

// normalizeUnknownError：将任意类型的错误统一转换为 KfcError 实例
export function normalizeUnknownError(error: unknown): KfcError {
  // 如果已经是 KfcError 实例，直接返回
  if (error instanceof KfcError) {
    return error;
  }

  // 否则包装为 "INTERNAL_ERROR" 类型的 KfcError
  return new KfcError({
    category: "internal", // 分类：内部错误
    code: "INTERNAL_ERROR", // 错误码
    message: "Unexpected internal error", // 用户可见消息
    exitCode: 1, // 退出码 1（通用错误）
    retryable: false, // 不可重试
    debugDetails: {
      // 记录原始错误的类型信息用于调试
      originalType: error instanceof Error ? error.name : typeof error,
    },
    cause: error, // 保留原始错误作为 cause 链
  });
}

// formatErrorForCli：将任意错误格式化为 CLI 可用的 ErrorPresentation
export function formatErrorForCli(
  error: unknown, // 任意类型的错误
  options: ErrorPresentationOptions = {}, // 格式化选项，默认为空
): ErrorPresentation {
  // 先将错误统一转换为 KfcError
  const normalized = normalizeUnknownError(error);
  // 构建输出行：错误码 + 消息，以及公开的问题详情
  const lines = [
    `Error [${normalized.code}]: ${normalized.message}`,
    ...publicIssueLines(normalized),
  ];

  // 如果开启了 debug 模式，追加调试信息
  if (options.debug) {
    // 构建调试对象（经过脱敏处理）
    const debug = {
      category: normalized.category, // 错误分类
      exitCode: normalized.exitCode, // 退出码
      retryable: normalized.retryable, // 是否可重试
      details: sanitizeDebugValue(
        // 脱敏后的调试详情
        normalized.debugDetails ?? {},
        undefined,
        new WeakSet(), // 新建 WeakSet 用于循环引用检测
      ),
    };
    // 追加 "Debug:" 标题和格式化的 JSON
    lines.push("Debug:", JSON.stringify(debug, null, 2));
  }

  // 返回最终的错误呈现结果
  return {
    exitCode: normalized.exitCode, // 进程退出码
    text: `${lines.join("\n")}\n`, // 所有行拼接为最终文本，末尾加换行
  };
}
