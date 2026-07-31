import { KfcError } from "../errors/kfc-error.js";

export type ProviderProtocol = "openai-chat-completions" | "openai-responses";

export interface ProviderConfig {
  type: "openai-compatible";
  protocol: ProviderProtocol;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export interface KfcConfig {
  provider: ProviderConfig;
}

export interface ConfigIssue {
  path: string;
  message: string;
}

export type ConfigErrorCode =
  | "CONFIG_FILE_READ_FAILED"
  | "CONFIG_FILE_INVALID"
  | "CREDENTIALS_FILE_READ_FAILED"
  | "CREDENTIALS_FILE_INVALID"
  | "CONFIG_INVALID";

export class ConfigError extends KfcError {
  readonly issues: readonly ConfigIssue[];

  constructor(
    code: ConfigErrorCode,
    message: string,
    issues: readonly ConfigIssue[] = [],
  ) {
    super({
      category: "config",
      code,
      message,
      exitCode: 2,
      retryable: false,
      details: { issues },
    });
    this.name = "ConfigError";
    this.issues = issues;
  }
}
