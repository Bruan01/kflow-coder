// 导入 KfcConfig 类型（仅类型导入）
import type { KfcConfig } from "./config.js";

// RedactedKfcConfig：脱敏后的配置类型，apiKey 被替换为 "[REDACTED]" 字面量
export type RedactedKfcConfig = Omit<KfcConfig, "provider"> & {
  provider: Omit<KfcConfig["provider"], "apiKey"> & { apiKey: "[REDACTED]" };
};

// redactConfig：对配置对象进行脱敏处理，隐藏 API Key
export function redactConfig(config: KfcConfig): RedactedKfcConfig {
  return {
    ...config, // 展开顶层字段
    provider: {
      ...config.provider, // 展开 provider 字段
      apiKey: "[REDACTED]", // 覆盖 apiKey 为脱敏占位符
    },
  };
}
