import { KfcError } from "../errors/kfc-error.js";

export class SessionStorageError extends KfcError {
  constructor(message: string, cause?: unknown) {
    super({
      category: "internal",
      code: "SESSION_STORAGE_FAILED",
      message,
      exitCode: 1,
      retryable: false,
      ...(cause === undefined ? {} : { cause }),
    });
    this.name = "SessionStorageError";
  }
}
