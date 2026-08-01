import { KfcError } from "../errors/kfc-error.js";

export type AgentErrorCode =
  | "AGENT_INVALID_OPTIONS"
  | "AGENT_MAX_STEPS_EXCEEDED"
  | "AGENT_INVALID_TOOL_RESULT"
  | "AGENT_REPEATED_TOOL_CALL";

export class AgentError extends KfcError {
  constructor(
    code: AgentErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super({
      category: "agent",
      code,
      message,
      exitCode: 1,
      retryable: false,
      ...(details === undefined ? {} : { details }),
    });
    this.name = "AgentError";
  }
}
