import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
  runInteractiveTerminal,
  type InteractiveRuntimeStatus,
} from "../../src/interactive/run-interactive-terminal.js";

function terminalOutput(): NodeJS.WriteStream & { readonly text: string[] } {
  const text: string[] = [];
  return Object.assign(new PassThrough(), {
    columns: 80,
    isTTY: true,
    text,
    write(chunk: string): boolean {
      text.push(chunk);
      return true;
    },
  }) as unknown as NodeJS.WriteStream & { readonly text: string[] };
}

describe("runInteractiveTerminal", () => {
  it("ignores mouse-shaped keypress events instead of terminating the session", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.emit("keypress", undefined, { name: "undefined", mouse: true });
    input.write("/exit\r");
    await pending;

    expect(output.text.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });

  it("opens a slash command menu and uses arrows plus Enter to select a command", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const pending = runInteractiveTerminal({
      input,
      output,
      color: true,
      status: () => "Read-only",
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("/\u001b[B\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("清除当前会话上下文和时间线"),
    );
    input.write("\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain(
        "确认清除当前会话上下文和时间线？",
      ),
    );
    input.write("n\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("已取消清除"),
    );
    input.write("/exit\r");
    await pending;
  });

  it("shows a multiline Chinese status panel and allows scroll-shaped input without crashing", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "当前配置\n模型: fixture-model\n累计 Token: 3 / 2 / 5",
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.emit("keypress", undefined, { name: "undefined", mouse: true });
    input.emit("data", Buffer.from("\u001b[<64;20;10M"));
    await Promise.resolve();
    input.write("/status\r");
    await vi.waitFor(() => {
      expect(output.text.join("")).toContain("当前配置");
      expect(output.text.join("")).toContain("累计 Token: 3 / 2 / 5");
    });
    input.write("/exit\r");
    await pending;
  });

  it("toggles tools through /tool with Space and exposes the live enabled count to status", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const tools = [
      { name: "list_directory", description: "列出目录", enabled: true },
      { name: "read_file", description: "读取文件", enabled: true },
    ];
    const toggleTool = vi.fn((name: string) => {
      const tool = tools.find((candidate) => candidate.name === name);
      if (tool !== undefined) tool.enabled = !tool.enabled;
    });
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: (runtime) =>
        `已启用工具: ${runtime.enabledToolCount}/${runtime.totalToolCount}`,
      tools: () => tools,
      toggleTool,
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("/tool\r");
    await vi.waitFor(() => expect(output.text.join("")).toContain("工具管理"));
    input.write(" ");
    await vi.waitFor(() =>
      expect(toggleTool).toHaveBeenCalledWith("list_directory"),
    );
    expect(output.text.join("")).toContain("○ list_directory");
    input.write("\r/status\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("已启用工具: 1/2"),
    );
    input.write("/exit\r");
    await pending;
  });
  it("restores cursor and the prior terminal screen after /exit", async () => {
    const input = new PassThrough();
    const pause = vi.spyOn(input, "pause");
    const output = terminalOutput();
    const playAnimation = vi.fn(async ({ write }) => write("KFLOW\n"));
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      runTurn: vi.fn(),
      playAnimation,
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("/exit\r");
    await pending;

    expect(output.text[0]).toContain("\u001b[?1049h");
    expect(output.text.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
    expect(playAnimation).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalled();
  });

  it("renders tool and streamed model events inside the fixed workbench", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn: async (messages, handlers) => {
        handlers.onToolCall({
          id: "call_1",
          name: "list_directory",
          input: {},
        });
        handlers.onText("Repository summary");
        return {
          messages: [
            ...messages,
            { role: "assistant", content: "Repository summary" },
          ],
          steps: 2,
          finalText: "Repository summary",
          finishReason: "stop",
        };
      },
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("inspect\r");
    await vi.waitFor(() => {
      expect(output.text.join("")).toContain("Tool  list_directory");
      expect(output.text.join("")).toContain("Repository summary");
    });
    input.write("/exit\r");
    await pending;
  });

  it("reports accumulated session usage and resets conversation history only after clear confirmation", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const status = vi.fn(
      (runtime: InteractiveRuntimeStatus) =>
        `会话轮数: ${runtime.turns}\n消息数: ${runtime.messageCount}\n总 Token: ${runtime.usage?.totalTokens ?? "n/a"}`,
    );
    const runTurn = vi.fn(async (messages) => ({
      messages: [...messages, { role: "assistant" as const, content: "done" }],
      steps: 1,
      finalText: "done",
      finishReason: "stop" as const,
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    }));
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status,
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn,
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("first\r");
    await vi.waitFor(() => expect(output.text.join("")).toContain("done"));
    input.write("/status\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("总 Token: 5"),
    );
    input.write("/clear\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("输入 y 确认"),
    );
    input.write("y\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("已清除当前会话上下文和时间线。"),
    );
    input.write("second\r");
    await vi.waitFor(() => expect(runTurn).toHaveBeenCalledTimes(2));
    expect(runTurn.mock.calls[1]?.[0]).toEqual([
      { role: "user", content: "second" },
    ]);
    input.write("/exit\r");
    await pending;
  });
});
