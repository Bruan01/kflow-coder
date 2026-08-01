import { describe, expect, it } from "vitest";

import { summarizeToolResult } from "../../src/interactive/tool-result-summary.js";

describe("tool result summaries", () => {
  it("summarizes read, search, and edit results without returning content", () => {
    expect(
      summarizeToolResult(
        "read_file",
        {
          toolCallId: "read",
          content: JSON.stringify({
            lines: [{ number: 1, text: "private content" }],
            truncated: true,
          }),
          isError: false,
        },
        12,
      ),
    ).toBe("读取 1 行 · 结果已截断 · 12ms");
    expect(
      summarizeToolResult(
        "grep",
        {
          toolCallId: "grep",
          content: JSON.stringify({ matches: [{ preview: "secret" }] }),
          isError: false,
        },
        8,
      ),
    ).toBe("命中 1 条 · 8ms");
    expect(
      summarizeToolResult(
        "apply_patch",
        {
          toolCallId: "patch",
          content: JSON.stringify({ replacements: 1, bytesWritten: 42 }),
          isError: false,
        },
        3,
      ),
    ).toBe("替换 1 处 · 写入 42 字节 · 3ms");
  });

  it("summarizes shell status and structured failures", () => {
    expect(
      summarizeToolResult(
        "shell",
        {
          toolCallId: "shell",
          content: JSON.stringify({
            exitCode: 0,
            timedOut: false,
            truncated: true,
          }),
          isError: false,
        },
        101,
      ),
    ).toBe("exit 0 · 输出已截断 · 101ms");
    expect(
      summarizeToolResult(
        "read_file",
        {
          toolCallId: "error",
          content: JSON.stringify({
            error: { code: "TOOL_EXECUTION_FAILED", tool: "read_file" },
          }),
          isError: true,
        },
        5,
      ),
    ).toBe("失败: TOOL_EXECUTION_FAILED · 5ms");
  });
});
