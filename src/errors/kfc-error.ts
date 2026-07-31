export type KfcErrorCategory =
  "config" | "provider" | "user_interrupted" | "internal";

export type KfcErrorCode =
  | "CONFIG_FILE_READ_FAILED"
  | "CONFIG_FILE_INVALID"
  | "CREDENTIALS_FILE_READ_FAILED"
  | "CREDENTIALS_FILE_INVALID"
  | "CONFIG_INVALID"
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_CONTEXT_LIMIT"
  | "PROVIDER_SERVICE_UNAVAILABLE"
  | "PROVIDER_INVALID_RESPONSE"
  | "USER_INTERRUPTED"
  | "INTERNAL_ERROR";

export interface KfcErrorOptions {
  category: KfcErrorCategory;
  code: KfcErrorCode;
  message: string;
  exitCode: number;
  retryable: boolean;
  details?: Readonly<Record<string, unknown>>;
  debugDetails?: Readonly<Record<string, unknown>>;
  cause?: unknown;
}

export class KfcError extends Error {
  readonly category: KfcErrorCategory;
  readonly code: KfcErrorCode;
  readonly exitCode: number;
  readonly retryable: boolean;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly debugDetails: Readonly<Record<string, unknown>> | undefined;

  constructor(options: KfcErrorOptions) {
    super(
      options.message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "KfcError";
    this.category = options.category;
    this.code = options.code;
    this.exitCode = options.exitCode;
    this.retryable = options.retryable;
    this.details = options.details;
    this.debugDetails = options.debugDetails;
  }

  toJSON(): object {
    return {
      name: this.name,
      category: this.category,
      code: this.code,
      message: this.message,
      exitCode: this.exitCode,
      retryable: this.retryable,
      details: this.details,
    };
  }
}
