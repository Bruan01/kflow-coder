// 导入错误类型
import { KfcError } from "../../errors/kfc-error.js";
import { ProviderError } from "../../errors/provider-error.js";
import { UserInterruptedError } from "../../errors/user-interrupted-error.js";

// ProviderRequestLifecycle 接口：管理一次 Provider 请求的生命周期（信号、错误处理、清理）
export interface ProviderRequestLifecycle {
  readonly signal: AbortSignal; // 用于 fetch 的 AbortSignal
  normalizeError(error: unknown): KfcError; // 将原始错误转换为 KfcError
  dispose(): void; // 清理资源（定时器、监听器）
}

// createProviderRequestLifecycle：创建 Provider 请求生命周期管理器
export function createProviderRequestLifecycle(
  callerSignal: AbortSignal | undefined, // 调用者传入的取消信号（如 Ctrl+C）
  timeoutMs: number, // 请求超时时间（毫秒）
): ProviderRequestLifecycle {
  // 如果调用者在开始之前就已经取消了，直接抛出用户中断错误
  if (callerSignal?.aborted === true) throw new UserInterruptedError();

  // 创建自己的 AbortController，用于组合调用者信号和超时信号
  const controller = new AbortController();
  let interrupted = false; // 标记是否由调用者中断（Ctrl+C）
  let timedOut = false; // 标记是否超时
  // 调用者中断的回调
  const handleCallerAbort = (): void => {
    interrupted = true; // 设置中断标记
    controller.abort(); // 触发自己的 AbortController
  };
  // 监听调用者的 abort 事件（一次性）
  callerSignal?.addEventListener("abort", handleCallerAbort, { once: true });
  // 设置超时定时器
  const timeout = setTimeout(() => {
    timedOut = true; // 设置超时标记
    controller.abort(); // 超时后触发取消
  }, timeoutMs);

  return {
    signal: controller.signal, // 返回组合后的 signal 给 fetch 使用

    // normalizeError：根据生命周期状态将错误转换为合适的 KfcError 类型
    normalizeError(error: unknown): KfcError {
      // 如果调用者中断了，返回 UserInterruptedError
      if (interrupted) return new UserInterruptedError();
      // 如果超时了，返回 ProviderError(PROVIDER_TIMEOUT)
      if (timedOut) {
        return new ProviderError(
          "PROVIDER_TIMEOUT",
          "Provider request timed out",
        );
      }
      // 如果已经是 KfcError，直接返回
      if (error instanceof KfcError) return error;
      // 否则包装为 PROVIDER_SERVICE_UNAVAILABLE
      return new ProviderError(
        "PROVIDER_SERVICE_UNAVAILABLE",
        "Provider is temporarily unavailable",
        {
          debugDetails: {
            originalType: error instanceof Error ? error.name : typeof error,
          },
          cause: error, // 保留原始错误链
        },
      );
    },

    // dispose：清理所有资源
    dispose(): void {
      clearTimeout(timeout); // 清除超时定时器
      callerSignal?.removeEventListener("abort", handleCallerAbort); // 移除 abort 监听器
      controller.abort(); // 确保任何未完成的请求被取消
    },
  };
}
