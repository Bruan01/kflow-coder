import { type KfcErrorCode, KfcError } from "./kfc-error.js";

export type ProviderErrorCode = Extract<
  KfcErrorCode,
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_CONTEXT_LIMIT"
  | "PROVIDER_SERVICE_UNAVAILABLE"
  | "PROVIDER_INVALID_RESPONSE"
>;

export interface ProviderErrorOptions {
  details?: Readonly<Record<string, unknown>>;
  debugDetails?: Readonly<Record<string, unknown>>;
  cause?: unknown;
}

const RETRYABLE_CODES = new Set<ProviderErrorCode>([
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_SERVICE_UNAVAILABLE",
]);

export class ProviderError extends KfcError {
  constructor(
    code: ProviderErrorCode,
    message: string,
    options: ProviderErrorOptions = {},
  ) {
    super({
      category: "provider",
      code,
      message,
      exitCode: 3,
      retryable: RETRYABLE_CODES.has(code),
      ...(options.details === undefined ? {} : { details: options.details }),
      ...(options.debugDetails === undefined
        ? {}
        : { debugDetails: options.debugDetails }),
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "ProviderError";
  }
}
