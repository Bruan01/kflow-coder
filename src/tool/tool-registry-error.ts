import { KfcError } from "../errors/kfc-error.js";

export type ToolRegistryErrorCode =
  "TOOL_DEFINITION_INVALID" | "TOOL_NAME_DUPLICATE";

export class ToolRegistryError extends KfcError {
  constructor(code: ToolRegistryErrorCode, message: string) {
    super({
      category: "agent",
      code,
      message,
      exitCode: 1,
      retryable: false,
    });
    this.name = "ToolRegistryError";
  }
}
