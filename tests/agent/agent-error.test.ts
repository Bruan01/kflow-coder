import { describe, expect, it } from "vitest";

import { AgentError, formatErrorForCli } from "../../src/index.js";

describe("AgentError", () => {
  it.each([
    "AGENT_INVALID_OPTIONS",
    "AGENT_MAX_STEPS_EXCEEDED",
    "AGENT_INVALID_TOOL_RESULT",
  ] as const)("exposes stable non-retryable semantics for %s", (code) => {
    const error = new AgentError(code, "Safe agent failure");

    expect(error).toMatchObject({
      category: "agent",
      code,
      exitCode: 1,
      retryable: false,
    });
    expect(formatErrorForCli(error)).toEqual({
      exitCode: 1,
      text: `Error [${code}]: Safe agent failure\n`,
    });
  });
});
