import { describe, expect, it } from "vitest";

import { describeToolCall } from "../../src/interactive/tool-activity.js";

describe("tool activity descriptions", () => {
  it("shows the target file for read and edit tools without exposing content", () => {
    expect(
      describeToolCall("read_file", {
        path: "src/interactive/workbench.ts",
        offset: 20,
      }),
    ).toBe("文件: src/interactive/workbench.ts");
    expect(
      describeToolCall("apply_patch", {
        path: "src/interactive/workbench.ts",
        oldText: "secret source",
        newText: "replacement source",
      }),
    ).toBe("文件: src/interactive/workbench.ts");
  });

  it("shows search and directory targets", () => {
    expect(
      describeToolCall("find_files", {
        pattern: "**/*.test.ts",
        path: "tests",
      }),
    ).toBe("匹配: **/*.test.ts · 目录: tests");
    expect(
      describeToolCall("grep", {
        query: "WorkbenchState",
        path: "src",
      }),
    ).toBe("搜索: WorkbenchState · 位置: src");
    expect(describeToolCall("list_directory", {})).toBe("目录: .");
  });

  it("summarizes shell commands and redacts inline secrets", () => {
    expect(
      describeToolCall("shell", {
        command: "pnpm test --token top-secret",
        cwd: "packages/kfc",
      }),
    ).toBe("命令: pnpm test --token [redacted] · 目录: packages/kfc");
  });

  it("does not invent details for unknown tools or malformed input", () => {
    expect(
      describeToolCall("custom_tool", { path: "file.ts" }),
    ).toBeUndefined();
    expect(describeToolCall("read_file", undefined)).toBe("文件: .");
  });
});
