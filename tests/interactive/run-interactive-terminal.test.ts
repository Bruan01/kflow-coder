import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
  runInteractiveTerminal,
  type InteractiveRuntimeStatus,
} from "../../src/interactive/run-interactive-terminal.js";
import { getInteractiveTheme } from "../../src/interactive/themes.js";

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

  it("pauses before edit tools and feeds a denied confirmation back as a Tool Result", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const toolCall = {
      id: "call_write",
      name: "write_file",
      input: { path: "notes.txt", content: "private" },
    };
    const runTurn = vi.fn(async (messages, handlers) => {
      handlers.onToolCall(toolCall);
      const approved = await handlers.authorizeToolCall(toolCall);
      handlers.onToolResult({
        toolCall,
        result: {
          toolCallId: toolCall.id,
          content: JSON.stringify(
            approved
              ? { bytesWritten: 7 }
              : { error: { code: "TOOL_CALL_DENIED", tool: toolCall.name } },
          ),
          isError: !approved,
        },
        durationMs: 3,
      });
      return {
        messages: [
          ...messages,
          { role: "assistant" as const, content: "denied" },
        ],
        steps: 1,
        finalText: "denied",
        finishReason: "stop" as const,
      };
    });
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      tools: () => [
        {
          name: "write_file",
          description: "创建工作区新文件",
          capability: "edit" as const,
          enabled: true,
        },
      ],
      runTurn,
      playAnimation: async ({ write }) => write("KFLOW\n"),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("write it\r");
    await vi.waitFor(() => {
      expect(output.text.join("")).toContain("模型请求执行");
      expect(output.text.join("")).toContain("❯ Yes");
      expect(output.text.join("")).toContain("Tell me why?");
      expect(output.text.join("")).toContain("⚠ write_file");
    });
    input.write("\u001b[B\r");
    await vi.waitFor(() => expect(output.text.join("")).toContain("已拒绝 ·"));
    expect(runTurn).toHaveBeenCalledOnce();

    input.write("/exit\r");
    await pending;
  });

  it("resumes an approved edit tool and reports its structured result", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const toolCall = {
      id: "call_patch",
      name: "apply_patch",
      input: { path: "src/app.ts" },
    };
    const approvedValues: unknown[] = [];
    const runTurn = vi.fn(async (messages, handlers) => {
      handlers.onToolCall(toolCall);
      const approved = await handlers.authorizeToolCall(toolCall);
      approvedValues.push(approved);
      handlers.onToolResult({
        toolCall,
        result: {
          toolCallId: toolCall.id,
          content: JSON.stringify({ replacements: 1, bytesWritten: 12 }),
          isError: false,
        },
        durationMs: 4,
      });
      return {
        messages: [
          ...messages,
          { role: "assistant" as const, content: "patched" },
        ],
        steps: 1,
        finalText: "patched",
        finishReason: "stop" as const,
      };
    });
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      tools: () => [
        {
          name: "apply_patch",
          description: "修改文件",
          capability: "edit" as const,
          enabled: true,
        },
      ],
      runTurn,
      playAnimation: async ({ write }) => write("KFLOW\n"),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("patch it\r");
    await vi.waitFor(() => expect(output.text.join("")).toContain("❯ Yes"));
    input.write("\u001b[B\u001b[A\r");
    await vi.waitFor(() => {
      expect(approvedValues).toEqual([true]);
      expect(output.text.join("")).toContain("替换 1 处 · 写入 12 字节");
    });

    input.write("/exit\r");
    await pending;
  });

  it("lets the user ask why a high-risk tool is needed without executing it", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    const toolCall = {
      id: "call_shell_explain",
      name: "shell",
      input: { command: "pnpm test" },
    };
    const decisions: unknown[] = [];
    const runTurn = vi.fn(async (messages, handlers) => {
      handlers.onToolCall(toolCall);
      const decision = await handlers.authorizeToolCall(toolCall);
      decisions.push(decision);
      handlers.onToolResult({
        toolCall,
        result: {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            error: {
              code: "TOOL_CALL_EXPLANATION_REQUESTED",
              tool: toolCall.name,
            },
          }),
          isError: true,
        },
        durationMs: 5,
      });
      return {
        messages: [
          ...messages,
          {
            role: "assistant" as const,
            content: "该命令会运行项目测试，但我没有执行它。",
          },
        ],
        steps: 1,
        finalText: "该命令会运行项目测试，但我没有执行它。",
        finishReason: "stop" as const,
      };
    });
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      tools: () => [
        {
          name: "shell",
          description: "执行工作区命令",
          capability: "execute" as const,
          enabled: true,
        },
      ],
      runTurn,
      playAnimation: async ({ write }) => write("KFLOW\n"),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    input.write("run tests\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Tell me why?"),
    );
    input.write("\u001b[B\u001b[B\r");
    await vi.waitFor(() => {
      expect(decisions).toEqual(["explain"]);
      expect(output.text.join("")).toContain("已请求说明 ·");
      expect(output.text.join("")).toContain("该命令会运行项目测试");
    });

    input.write("/exit\r");
    await pending;
  });

  it("previews the selected theme immediately and keeps it after Enter confirmation", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    let activeTheme = getInteractiveTheme("kflow-dark");
    const setTheme = vi.fn(
      (name: Parameters<typeof getInteractiveTheme>[0]) => {
        activeTheme = getInteractiveTheme(name);
      },
    );
    const pending = runInteractiveTerminal({
      input,
      output,
      color: true,
      status: () => "Read-only",
      theme: () => activeTheme,
      setTheme,
      sessionInfo: () => ({
        model: "fixture-model",
        cwd: "/tmp/kflow",
        protocol: "openai-chat-completions",
        theme: activeTheme.name,
        turns: 0,
        enabledToolCount: 1,
        totalToolCount: 2,
      }),
      playAnimation: async ({ write }) => write("KFLOW\n"),
      runTurn: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("Enter send"),
    );
    expect(output.text.join("")).toContain("模型: fixture-model");
    expect(output.text.join("")).toContain("目录: /tmp/kflow");

    input.write("/themes\r");
    await vi.waitFor(() => expect(output.text.join("")).toContain("主题"));
    input.write("\u001b[B");
    await vi.waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith("nord");
      expect(output.text.join("")).toContain("\u001b[1;96mKFLOW");
    });
    input.write("\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("主题: nord"),
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
    expect(playAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ columns: 80, rows: 24 }),
    );
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

  it("animates model thinking and tool execution, then clears the timer", async () => {
    const input = new PassThrough();
    const output = terminalOutput();
    let resolveTurn:
      | ((result: {
          readonly messages: readonly [
            { readonly role: "assistant"; readonly content: string },
          ];
          readonly steps: number;
          readonly finalText: string;
          readonly finishReason: "stop";
        }) => void)
      | undefined;
    const runTurn = vi.fn(
      async (
        _messages: readonly unknown[],
        handlers: {
          onToolCall(toolCall: {
            readonly id: string;
            readonly name: string;
            readonly input: unknown;
          }): void;
          onToolResult(event: {
            readonly toolCall: {
              readonly id: string;
              readonly name: string;
              readonly input: unknown;
            };
            readonly result: {
              readonly toolCallId: string;
              readonly content: string;
              readonly isError: boolean;
            };
            readonly durationMs: number;
          }): void;
        },
      ) => {
        handlers.onToolCall({
          id: "call_1",
          name: "read_file",
          input: { path: "src/interactive/workbench.ts" },
        });
        handlers.onToolResult({
          toolCall: {
            id: "call_1",
            name: "read_file",
            input: { path: "src/interactive/workbench.ts" },
          },
          result: {
            toolCallId: "call_1",
            content: JSON.stringify({
              lines: [{ number: 1, text: "private content" }],
              truncated: false,
            }),
            isError: false,
          },
          durationMs: 12,
        });
        return new Promise<{
          readonly messages: readonly [
            {
              readonly role: "assistant";
              readonly content: string;
            },
          ];
          readonly steps: number;
          readonly finalText: string;
          readonly finishReason: "stop";
        }>((resolve) => {
          resolveTurn = resolve;
        });
      },
    );
    const pending = runInteractiveTerminal({
      input,
      output,
      color: false,
      status: () => "Read-only",
      runTurn,
      playAnimation: async ({ write }) => write("KFLOW\n"),
    });

    await vi.waitFor(() =>
      expect(output.text.join(" ")).toContain("Enter send"),
    );
    input.write("inspect\r");
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain("⠋ 模型思考中"),
    );
    await vi.waitFor(() =>
      expect(output.text.join("")).toContain(
        "⠋ 执行工具: read_file · 文件: src/interactive/workbench.ts",
      ),
    );
    const outputAfterActivity = output.text.length;
    resolveTurn?.({
      messages: [{ role: "assistant", content: "done" }],
      steps: 1,
      finalText: "done",
      finishReason: "stop",
    });
    await vi.waitFor(() =>
      expect(output.text.length).toBeGreaterThan(outputAfterActivity),
    );
    expect(output.text.join("")).toContain("Ready");
    await new Promise((resolve) => setTimeout(resolve, 140));
    expect(output.text.length).toBe(outputAfterActivity + 1);

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
