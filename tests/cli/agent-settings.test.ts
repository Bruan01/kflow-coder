import { describe, expect, it } from "vitest";

import {
  MAX_AGENT_MAX_STEPS,
  resolveAgentMaxSteps,
} from "../../src/cli/agent-settings.js";
import { DEFAULT_AGENT_MAX_STEPS } from "../../src/agent/run-agent.js";

describe("Agent step settings", () => {
  it("uses the safe default when no environment override is present", () => {
    expect(resolveAgentMaxSteps(undefined)).toBe(DEFAULT_AGENT_MAX_STEPS);
  });

  it("accepts integer overrides within the bounded range", () => {
    expect(resolveAgentMaxSteps("16")).toBe(16);
    expect(resolveAgentMaxSteps(String(MAX_AGENT_MAX_STEPS))).toBe(
      MAX_AGENT_MAX_STEPS,
    );
  });

  it.each(["", "0", "65", "1.5", "many"])(
    "rejects invalid override %s",
    (value) => {
      expect(() => resolveAgentMaxSteps(value)).toThrow(
        expect.objectContaining({ code: "CONFIG_INVALID" }),
      );
    },
  );
});
