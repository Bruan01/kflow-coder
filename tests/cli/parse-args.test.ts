import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";

describe("parseCliArgs", () => {
  it.each([["--help"], ["-h"], []])("maps %j to help", (...args) => {
    expect(parseCliArgs(args)).toEqual({ type: "help" });
  });

  it.each([["--version"], ["-v"]])("maps %j to version", (...args) => {
    expect(parseCliArgs(args)).toEqual({ type: "version" });
  });

  it("maps the doctor positional to a doctor command", () => {
    expect(parseCliArgs(["doctor"])).toEqual({ type: "doctor" });
  });

  it.each([["--quickstart"], ["--qs"]])("maps %j to quickstart", (...args) => {
    expect(parseCliArgs(args)).toEqual({ type: "quickstart" });
  });

  it("maps ask and all remaining positionals to one prompt", () => {
    expect(parseCliArgs(["ask", "explain", "this", "project"])).toEqual({
      type: "ask",
      prompt: "explain this project",
    });
  });

  it("maps agent and all remaining positionals to one prompt", () => {
    expect(parseCliArgs(["agent", "inspect", "this", "workspace"])).toEqual({
      type: "agent",
      prompt: "inspect this workspace",
    });
  });

  it.each([["ask"], ["ask", "   "]])(
    "rejects ask without a non-empty prompt",
    (...args) => {
      expect(parseCliArgs(args)).toEqual({
        type: "error",
        message: "Ask prompt is required",
      });
    },
  );

  it.each([["agent"], ["agent", "   "]])(
    "rejects agent without a non-empty prompt",
    (...args) => {
      expect(parseCliArgs(args)).toEqual({
        type: "error",
        message: "Agent prompt is required",
      });
    },
  );

  it("rejects unknown options without exposing a stack", () => {
    expect(parseCliArgs(["--unknown"])).toEqual({
      type: "error",
      message: "Unknown option: --unknown",
    });
  });

  it("rejects positionals that are not implemented", () => {
    expect(parseCliArgs(["unknown-command"])).toEqual({
      type: "error",
      message: "Unexpected argument: unknown-command",
    });
  });
});
