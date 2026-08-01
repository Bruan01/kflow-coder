export { ConfigError } from "./config/config.js";
export * from "./ask/index.js";
export * from "./agent/index.js";
export type {
  ConfigErrorCode,
  ConfigIssue,
  KfcConfig,
  ProviderConfig,
  ProviderProtocol,
} from "./config/config.js";
export {
  resolveConfigPath,
  resolveCredentialsPath,
} from "./config/config-path.js";
export { loadConfig } from "./config/load-config.js";
export { redactConfig } from "./config/redact-config.js";
export type { RedactedKfcConfig } from "./config/redact-config.js";
export * from "./doctor/index.js";
export * from "./errors/index.js";
export * from "./quickstart/index.js";
export * from "./provider/index.js";

export const projectName = "kflow-code";
