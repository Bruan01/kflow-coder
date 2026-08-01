import { describe, expect, it } from "vitest";

import {
  interactiveCommands,
  interactiveToolDescription,
} from "../../src/interactive/catalog.js";

describe("interactive catalog", () => {
  it("contains one source-of-truth entry for every supported command", () => {
    expect(interactiveCommands.map((item) => item.command)).toEqual([
      "/help",
      "/clear",
      "/status",
      "/tool",
      "/exit",
    ]);
    expect(new Set(interactiveCommands.map((item) => item.command)).size).toBe(
      interactiveCommands.length,
    );
    expect(
      interactiveCommands.every((item) => item.label && item.description),
    ).toBe(true);
  });

  it("localizes known tools without changing unknown tool descriptions", () => {
    expect(interactiveToolDescription("read_file", "fallback")).toBe(
      "读取工作区文本文件",
    );
    expect(interactiveToolDescription("custom", "fallback")).toBe("fallback");
  });
});
