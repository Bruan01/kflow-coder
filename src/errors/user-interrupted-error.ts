import { KfcError } from "./kfc-error.js";

export class UserInterruptedError extends KfcError {
  constructor(message = "Operation cancelled by user") {
    super({
      category: "user_interrupted",
      code: "USER_INTERRUPTED",
      message,
      exitCode: 130,
      retryable: false,
    });
    this.name = "UserInterruptedError";
  }
}
