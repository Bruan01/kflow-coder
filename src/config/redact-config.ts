import type { KfcConfig } from "./config.js";

export type RedactedKfcConfig = Omit<KfcConfig, "provider"> & {
  provider: Omit<KfcConfig["provider"], "apiKey"> & { apiKey: "[REDACTED]" };
};

export function redactConfig(config: KfcConfig): RedactedKfcConfig {
  return {
    ...config,
    provider: {
      ...config.provider,
      apiKey: "[REDACTED]",
    },
  };
}
