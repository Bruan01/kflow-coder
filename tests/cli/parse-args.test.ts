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

  it("rejects unknown options without exposing a stack", () => {
    expect(parseCliArgs(["--unknown"])).toEqual({
      type: "error",
      message: "Unknown option: --unknown",
    });
  });

  it("rejects positionals that are not implemented yet", () => {
    expect(parseCliArgs(["ask"])).toEqual({
      type: "error",
      message: "Unexpected argument: ask",
    });
  });
});
