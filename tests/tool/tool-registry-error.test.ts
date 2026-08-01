import { describe, expect, it } from "vitest";

import { ToolRegistryError, formatErrorForCli } from "../../src/index.js";

describe("ToolRegistryError", () => {
  it.each(["TOOL_DEFINITION_INVALID", "TOOL_NAME_DUPLICATE"] as const)(
    "exposes stable registration semantics for %s",
    (code) => {
      const error = new ToolRegistryError(code, "Safe registry failure");

      expect(error).toMatchObject({
        category: "agent",
        code,
        exitCode: 1,
        retryable: false,
      });
      expect(formatErrorForCli(error)).toEqual({
        exitCode: 1,
        text: `Error [${code}]: Safe registry failure\n`,
      });
    },
  );
});
