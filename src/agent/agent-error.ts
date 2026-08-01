import { KfcError } from "../errors/kfc-error.js";

export type AgentErrorCode =
  | "AGENT_INVALID_OPTIONS"
  | "AGENT_MAX_STEPS_EXCEEDED"
  | "AGENT_INVALID_TOOL_RESULT";

export class AgentError extends KfcError {
  constructor(code: AgentErrorCode, message: string) {
    super({
      category: "agent",
      code,
      message,
      exitCode: 1,
      retryable: false,
    });
    this.name = "AgentError";
  }
}
