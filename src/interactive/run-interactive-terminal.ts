import { emitKeypressEvents } from "node:readline";

import type {
  AgentMaxSteps,
  AgentRunResult,
  AgentToolAuthorizationDecision,
  AgentToolResult,
} from "../agent/run-agent.js";
import type { ThemeName } from "../config/runtime-settings.js";
import {
  formatErrorForCli,
  normalizeUnknownError,
} from "../errors/error-presentation.js";
import type { ModelMessage } from "../provider/model-provider.js";
import type { ModelTokenUsage } from "../provider/model-provider.js";
import {
  applyInputKey,
  createInputEditor,
  type InputKey,
} from "./input-editor.js";
import {
  startActivityAnimation,
  type ActivityAnimationHandle,
} from "./activity-animation.js";
import { describeToolCall } from "./tool-activity.js";
import {
  inspectToolResult,
  summarizeToolResult,
  type ToolWorkspaceChange,
} from "./tool-result-summary.js";
import { playStartupAnimation } from "./startup-animation.js";
import {
  appendAssistantText,
  appendNotice,
  appendToolEvent,
  appendToolResult,
  appendUserEvent,
  createWorkbenchState,
  isKnownCommand,
  moveCommandMenu,
  moveWorkbenchScroll,
  renderWorkbench,
  selectedCommand,
  setCommandMenu,
  setClearConfirmation,
  setThemeMenu,
  setToolMenu,
  setWorkbenchInput,
  setWorkbenchActivity,
  setWorkbenchStatus,
  setToolConfirmation,
  updateToolApproval,
  moveToolConfirmation,
  selectedToolConfirmation,
  moveToolMenu,
  moveThemeMenu,
  selectedThemeIndex,
  type InteractiveSessionInfo,
  type InteractiveToolStatus,
  type WorkbenchState,
} from "./workbench.js";
import { interactiveCommands } from "./catalog.js";
import {
  getInteractiveTheme,
  interactiveThemes,
  type WorkbenchTheme,
} from "./themes.js";

const ENTER_ALTERNATE_SCREEN = "\u001b[?1049h\u001b[2J\u001b[H\u001b[?25l";
const LEAVE_ALTERNATE_SCREEN = "\u001b[?25h\u001b[?1049l";
const SGR_MOUSE_PREFIX = `${String.fromCharCode(27)}[<`;

export interface InteractiveTerminalTurnHandlers {
  onText(delta: string): void;
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
    readonly result: AgentToolResult;
    readonly durationMs: number;
  }): void;
  authorizeToolCall(toolCall: {
    readonly id: string;
    readonly name: string;
    readonly input: unknown;
  }): Promise<AgentToolAuthorizationDecision>;
}

export interface InteractiveTerminalInput extends NodeJS.ReadableStream {
  readonly isTTY?: boolean;
  setRawMode?(mode: boolean): void;
}

export interface InteractiveTerminalOptions {
  readonly input: InteractiveTerminalInput;
  readonly output: NodeJS.WriteStream;
  readonly color: boolean;
  readonly status: (runtime: InteractiveRuntimeStatus) => string;
  readonly tools?: () => readonly InteractiveToolStatus[];
  readonly toggleTool?: (name: string) => void;
  readonly maxSteps?: AgentMaxSteps;
  readonly themes?: readonly WorkbenchTheme[];
  readonly theme?: () => WorkbenchTheme;
  readonly setTheme?: (name: ThemeName) => void | Promise<void>;
  readonly sessionInfo?: (
    runtime: InteractiveRuntimeStatus,
  ) => InteractiveSessionInfo;
  readonly runTurn: (
    messages: readonly ModelMessage[],
    handlers: InteractiveTerminalTurnHandlers,
    signal: AbortSignal,
  ) => Promise<AgentRunResult>;
  readonly playAnimation?: typeof playStartupAnimation;
}

export interface InteractiveRuntimeStatus {
  readonly turns: number;
  readonly messageCount: number;
  readonly usage: ModelTokenUsage | undefined;
  readonly enabledToolCount: number;
  readonly totalToolCount: number;
  readonly maxSteps: AgentMaxSteps;
}

function terminalColumns(output: NodeJS.WriteStream): number {
  return Number.isInteger(output.columns) && output.columns > 0
    ? output.columns
    : 80;
}

function terminalRows(output: NodeJS.WriteStream): number {
  return Number.isInteger(output.rows) && output.rows > 0 ? output.rows : 24;
}

function commandHelp(): string {
  return [
    "可用命令：",
    ...interactiveCommands.map(
      (item) => `  ${item.command.padEnd(8)} ${item.description}`,
    ),
    "快捷键：↑↓/PageUp/PageDown 浏览历史；Esc 或 Ctrl+C 取消当前请求；Ctrl+J 换行。",
    "复制：鼠标选区使用终端原生复制；历史浏览使用键盘快捷键。",
  ].join("\n");
}

function toolCounts(options: InteractiveTerminalOptions): {
  readonly enabled: number;
  readonly total: number;
} {
  const tools = options.tools?.() ?? [];
  return {
    enabled: tools.filter((tool) => tool.enabled).length,
    total: tools.length,
  };
}

function runtimeStatus(
  options: InteractiveTerminalOptions,
  turns: number,
  messageCount: number,
  usage: ModelTokenUsage | undefined,
): InteractiveRuntimeStatus {
  const counts = toolCounts(options);
  return {
    turns,
    messageCount,
    usage,
    enabledToolCount: counts.enabled,
    totalToolCount: counts.total,
    maxSteps: options.maxSteps ?? "unlimited",
  };
}

function mergeWorkspaceChange(
  current: ToolWorkspaceChange,
  next: ToolWorkspaceChange,
): ToolWorkspaceChange {
  if (current === "changed" || next === "changed") return "changed";
  if (current === "unknown" || next === "unknown") return "unknown";
  return "unchanged";
}

function uniqueNames(names: readonly string[]): string {
  const unique = [...new Set(names)];
  return unique.length === 0 ? "无" : unique.join("、");
}

function turnRecoveryNotice(
  completedTools: readonly string[],
  failedTools: readonly string[],
  workspaceChange: ToolWorkspaceChange,
  recoveryNotes: readonly string[],
): string | undefined {
  if (completedTools.length === 0 && failedTools.length === 0) return undefined;
  const workspaceText =
    workspaceChange === "changed"
      ? "已产生修改；先运行 git_diff 查看文件摘要，人工审查后再决定恢复。"
      : workspaceChange === "unknown"
        ? "可能产生修改；先运行 git_diff 确认，不能直接假定可回滚。"
        : "未发现已写入的修改；失败或拒绝的操作没有执行。";
  return [
    "本轮执行说明：",
    `已完成：${uniqueNames(completedTools)}`,
    `失败：${uniqueNames(failedTools)}`,
    `工作区：${workspaceText}`,
    recoveryNotes.length > 0
      ? `恢复提示：${[...new Set(recoveryNotes)].join("；")}`
      : "恢复提示：KFC 不自动执行 reset、checkout 或删除文件。",
  ].join("\n");
}

function interactiveErrorText(error: unknown): string {
  const normalized = normalizeUnknownError(error);
  if (normalized.code === "AGENT_MAX_STEPS_EXCEEDED") {
    return "Agent 遇到显式步数预算并停止；当前生产模式默认不设置固定步数上限。";
  }
  return (
    formatErrorForCli(normalized).text.split("\n", 1)[0] ?? "Request failed"
  );
}

function addUsage(
  current: ModelTokenUsage | undefined,
  next: ModelTokenUsage | undefined,
): ModelTokenUsage | undefined {
  if (next === undefined) return current;
  if (current === undefined) return next;
  return {
    inputTokens: current.inputTokens + next.inputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  };
}

function mapInputKey(
  value: unknown,
  key: { name?: string; ctrl?: boolean; meta?: boolean },
): InputKey | undefined {
  if (key.ctrl === true && key.name === "j") return { type: "newline" };
  if (key.name === "left") return { type: "left" };
  if (key.name === "right") return { type: "right" };
  if (key.name === "home") return { type: "home" };
  if (key.name === "end") return { type: "end" };
  if (key.name === "backspace") return { type: "backspace" };
  if (key.name === "delete") return { type: "delete" };
  if (
    key.ctrl === true ||
    key.meta === true ||
    typeof value !== "string" ||
    value === ""
  ) {
    return undefined;
  }
  return { type: "text", value };
}

function requiresToolConfirmation(
  options: InteractiveTerminalOptions,
  name: string,
): boolean {
  const tool = options.tools?.().find((candidate) => candidate.name === name);
  return tool?.capability === "edit" || tool?.capability === "execute";
}

export async function runInteractiveTerminal(
  options: InteractiveTerminalOptions,
): Promise<void> {
  const playAnimation = options.playAnimation ?? playStartupAnimation;
  let activeController: AbortController | undefined;
  let messages: readonly ModelMessage[] = [];
  let turns = 0;
  let totalUsage: ModelTokenUsage | undefined;
  let activityAnimation: ActivityAnimationHandle | undefined;
  let pendingToolCalls: readonly {
    readonly id: string;
    readonly name: string;
    readonly input: unknown;
  }[] = [];
  let pendingToolApproval:
    | {
        readonly toolCall: {
          readonly id: string;
          readonly name: string;
          readonly input: unknown;
        };
        readonly resolve: (decision: AgentToolAuthorizationDecision) => void;
      }
    | undefined;
  let state: WorkbenchState = {
    ...createWorkbenchState(),
    input: createInputEditor(),
  };
  let closed = false;
  let rawModeEnabled = false;
  let suppressMouseKeypress = false;
  let finish: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const themes = options.themes ?? interactiveThemes;

  const redraw = (): void => {
    if (closed) return;
    const runtime = runtimeStatus(options, turns, messages.length, totalUsage);
    options.output.write(
      `\u001b[2J\u001b[H${renderWorkbench(state, {
        columns: terminalColumns(options.output),
        rows: terminalRows(options.output),
        color: options.color,
        tools: options.tools?.() ?? [],
        themes,
        theme: options.theme?.() ?? getInteractiveTheme(undefined),
        ...(options.sessionInfo === undefined
          ? {}
          : { sessionInfo: options.sessionInfo(runtime) }),
      })}`,
    );
  };
  const stopActivityAnimation = (): void => {
    activityAnimation?.stop();
    activityAnimation = undefined;
    state = setWorkbenchActivity(state, undefined);
  };

  const startActivity = (
    activity: Exclude<WorkbenchState["activity"], undefined>,
  ): void => {
    activityAnimation?.stop();
    activityAnimation = startActivityAnimation((frame) => {
      state = setWorkbenchActivity(state, { ...activity, frame });
      redraw();
    });
  };

  const settleToolApproval = (
    decision: AgentToolAuthorizationDecision,
    shouldRedraw = true,
  ): boolean => {
    const pending = pendingToolApproval;
    if (pending === undefined) return false;
    pendingToolApproval = undefined;
    state = updateToolApproval(
      state,
      pending.toolCall.id,
      decision === true
        ? "approved"
        : decision === "explain"
          ? "explain"
          : "denied",
    );
    state = setToolConfirmation(state, undefined);
    if (decision === true) {
      const detail = describeToolCall(
        pending.toolCall.name,
        pending.toolCall.input,
      );
      startActivity({
        kind: "tool",
        name: pending.toolCall.name,
        ...(detail === undefined ? {} : { detail }),
        frame: state.activity?.frame ?? 0,
      });
    }
    if (shouldRedraw && !closed) redraw();
    pending.resolve(decision);
    return true;
  };

  const requestToolApproval = (toolCall: {
    readonly id: string;
    readonly name: string;
    readonly input: unknown;
  }): Promise<AgentToolAuthorizationDecision> => {
    if (closed) return Promise.resolve(false);
    const detail = describeToolCall(toolCall.name, toolCall.input);
    return new Promise<AgentToolAuthorizationDecision>((resolve) => {
      pendingToolApproval = { toolCall, resolve };
      state = setToolConfirmation(state, {
        id: toolCall.id,
        name: toolCall.name,
        ...(detail === undefined ? {} : { detail }),
      });
      activityAnimation?.stop();
      activityAnimation = undefined;
      state = setWorkbenchActivity(state, {
        kind: "approval",
        name: toolCall.name,
        ...(detail === undefined ? {} : { detail }),
        frame: state.activity?.frame ?? 0,
      });
      redraw();
    });
  };

  const handleInterrupt = (): void => {
    if (pendingToolApproval !== undefined) {
      settleToolApproval(false);
      return;
    }
    if (activeController !== undefined) {
      activeController.abort();
      return;
    }
    state = appendNotice(state, "Use /exit to leave KFlow.");
    redraw();
  };
  const exit = (): void => {
    if (closed) return;
    settleToolApproval(false, false);
    activeController?.abort();
    closed = true;
    finish();
  };

  const clearSession = (): void => {
    messages = [];
    turns = 0;
    totalUsage = undefined;
    state = appendNotice(
      createWorkbenchState(),
      "已清除当前会话上下文和时间线。",
    );
  };

  const submit = async (): Promise<void> => {
    const input = state.input.value.trim();
    if (input === "") return;
    state = setWorkbenchInput(state, "");
    if (state.clearConfirmation) {
      if (input.toLowerCase() === "y") {
        clearSession();
      } else {
        state = appendNotice(
          setClearConfirmation(state, false),
          "已取消清除。",
        );
      }
      redraw();
      return;
    }
    if (input.startsWith("/")) {
      switch (input) {
        case "/help":
          state = appendNotice(state, commandHelp());
          redraw();
          return;
        case "/clear":
          state = setClearConfirmation(state, true);
          redraw();
          return;
        case "/status": {
          state = appendNotice(
            state,
            options.status(
              runtimeStatus(options, turns, messages.length, totalUsage),
            ),
          );
          redraw();
          return;
        }
        case "/tool":
          state = setToolMenu(state, true);
          redraw();
          return;
        case "/themes": {
          const current = options.theme?.() ?? getInteractiveTheme(undefined);
          const selected = Math.max(
            0,
            themes.findIndex((theme) => theme.name === current.name),
          );
          state = setThemeMenu(state, true, selected);
          redraw();
          return;
        }
        case "/exit":
          exit();
          return;
        default:
          state = appendNotice(state, `Unknown command: ${input}`, "Error");
          redraw();
          return;
      }
    }

    const requestMessages: readonly ModelMessage[] = [
      ...messages,
      { role: "user", content: input },
    ];
    state = setWorkbenchStatus(appendUserEvent(state, input), "Working");
    pendingToolCalls = [];
    startActivity({ kind: "thinking", frame: 0 });
    let receivedText = false;
    let workspaceChange: ToolWorkspaceChange = "unchanged";
    const completedTools: string[] = [];
    const failedTools: string[] = [];
    const recoveryNotes: string[] = [];
    activeController = new AbortController();
    try {
      const result = await options.runTurn(
        requestMessages,
        {
          onText(delta) {
            if (closed) return;
            receivedText = true;
            if (state.activity?.kind === "tool") {
              state = setWorkbenchActivity(state, {
                kind: "thinking",
                frame: state.activity.frame,
              });
            }
            state = appendAssistantText(state, delta);
            redraw();
          },
          onToolCall(toolCall) {
            if (closed) return;
            const detail = describeToolCall(toolCall.name, toolCall.input);
            const requiresConfirmation = requiresToolConfirmation(
              options,
              toolCall.name,
            );
            state = appendToolEvent(
              state,
              toolCall.name,
              detail,
              toolCall.id,
              requiresConfirmation ? "pending" : "approved",
            );
            pendingToolCalls = [...pendingToolCalls, toolCall];
            if (state.activity?.kind !== "tool") {
              startActivity({
                kind: "tool",
                name: toolCall.name,
                ...(detail === undefined ? {} : { detail }),
                frame: state.activity?.frame ?? 0,
              });
            }
            redraw();
          },
          authorizeToolCall(toolCall) {
            return requiresToolConfirmation(options, toolCall.name)
              ? requestToolApproval(toolCall)
              : Promise.resolve(true);
          },
          onToolResult(event) {
            if (closed) return;
            const summary = summarizeToolResult(
              event.toolCall.name,
              event.result,
              event.durationMs,
            );
            const inspection = inspectToolResult(
              event.toolCall.name,
              event.result,
            );
            workspaceChange = mergeWorkspaceChange(
              workspaceChange,
              inspection.workspaceChange,
            );
            (event.result.isError ? failedTools : completedTools).push(
              event.toolCall.name,
            );
            if (inspection.recovery !== undefined) {
              recoveryNotes.push(inspection.recovery);
            }
            state = appendToolResult(
              state,
              event.toolCall.name,
              summary,
              event.result.isError,
            );
            pendingToolCalls = pendingToolCalls.filter(
              (toolCall) => toolCall.id !== event.toolCall.id,
            );
            const nextToolCall = pendingToolCalls[0];
            if (nextToolCall === undefined) {
              startActivity({
                kind: "thinking",
                frame: state.activity?.frame ?? 0,
              });
            } else {
              const detail = describeToolCall(
                nextToolCall.name,
                nextToolCall.input,
              );
              startActivity({
                kind: "tool",
                name: nextToolCall.name,
                ...(detail === undefined ? {} : { detail }),
                frame: state.activity?.frame ?? 0,
              });
            }
            redraw();
          },
        },
        activeController.signal,
      );
      messages = result.messages;
      turns += 1;
      totalUsage = addUsage(totalUsage, result.usage);
      if (!receivedText && result.finalText !== "") {
        state = appendAssistantText(state, result.finalText);
      }
      state = setWorkbenchStatus(state, "Ready");
    } catch (error) {
      if (closed) return;
      const presentation = formatErrorForCli(error);
      const recovery = turnRecoveryNotice(
        completedTools,
        failedTools,
        workspaceChange,
        recoveryNotes,
      );
      state = appendNotice(
        state,
        [interactiveErrorText(error), recovery]
          .filter((part): part is string => part !== undefined)
          .join("\n"),
        presentation.exitCode === 130 ? "Cancelled" : "Error",
      );
    } finally {
      settleToolApproval(false, false);
      activeController = undefined;
      pendingToolCalls = [];
      stopActivityAnimation();
      redraw();
    }
  };
  const handleMouseData = (chunk: unknown): void => {
    const text = Buffer.isBuffer(chunk)
      ? chunk.toString("utf8")
      : typeof chunk === "string"
        ? chunk
        : "";
    if (!text.includes(SGR_MOUSE_PREFIX)) return;
    suppressMouseKeypress = true;
    queueMicrotask(() => {
      suppressMouseKeypress = false;
    });
  };
  const handleKeypress = (value: unknown, key: unknown): void => {
    if (closed) return;
    if (suppressMouseKeypress) return;
    const normalizedKey =
      typeof key === "object" && key !== null
        ? (key as { name?: string; ctrl?: boolean; meta?: boolean })
        : {};
    if (
      normalizedKey.name === "escape" ||
      (normalizedKey.ctrl === true && normalizedKey.name === "c")
    ) {
      if (pendingToolApproval !== undefined) {
        settleToolApproval(false);
        return;
      }
      if (state.toolMenu !== undefined && activeController === undefined) {
        state = setToolMenu(state, false);
        redraw();
        return;
      }
      if (state.themeMenu !== undefined && activeController === undefined) {
        state = setThemeMenu(state, false);
        redraw();
        return;
      }
      if (state.clearConfirmation && activeController === undefined) {
        state = appendNotice(
          setClearConfirmation(state, false),
          "已取消清除。",
        );
        redraw();
        return;
      }
      handleInterrupt();
      return;
    }
    if (state.toolMenu !== undefined) {
      const tools = options.tools?.() ?? [];
      if (normalizedKey.name === "up") {
        state = moveToolMenu(state, -1, tools.length);
        redraw();
        return;
      }
      if (normalizedKey.name === "down") {
        state = moveToolMenu(state, 1, tools.length);
        redraw();
        return;
      }
      if (normalizedKey.name === "return") {
        state = setToolMenu(state, false);
        redraw();
        return;
      }
      if (value === " " || normalizedKey.name === "space") {
        const selected = state.toolMenu.selected;
        const tool = tools[selected];
        if (tool !== undefined) options.toggleTool?.(tool.name);
        redraw();
        return;
      }
      return;
    }
    if (state.themeMenu !== undefined) {
      if (normalizedKey.name === "up") {
        state = moveThemeMenu(state, -1, themes.length);
        const selected = selectedThemeIndex(state);
        const theme = selected === undefined ? undefined : themes[selected];
        if (theme !== undefined) {
          const pending = options.setTheme?.(theme.name);
          void Promise.resolve(pending).catch((error: unknown) => {
            state = appendNotice(
              state,
              formatErrorForCli(error).text.split("\n", 1)[0] ?? "主题保存失败",
              "Error",
            );
            redraw();
          });
        }
        redraw();
        return;
      }
      if (normalizedKey.name === "down") {
        state = moveThemeMenu(state, 1, themes.length);
        const selected = selectedThemeIndex(state);
        const theme = selected === undefined ? undefined : themes[selected];
        if (theme !== undefined) {
          const pending = options.setTheme?.(theme.name);
          void Promise.resolve(pending).catch((error: unknown) => {
            state = appendNotice(
              state,
              formatErrorForCli(error).text.split("\n", 1)[0] ?? "主题保存失败",
              "Error",
            );
            redraw();
          });
        }
        redraw();
        return;
      }
      if (normalizedKey.name === "return") {
        state = setThemeMenu(state, false);
        redraw();
        return;
      }
      return;
    }
    if (pendingToolApproval !== undefined) {
      if (normalizedKey.name === "up") {
        state = moveToolConfirmation(state, -1);
        redraw();
        return;
      }
      if (normalizedKey.name === "down") {
        state = moveToolConfirmation(state, 1);
        redraw();
        return;
      }
      if (normalizedKey.name === "return") {
        const selected = selectedToolConfirmation(state);
        settleToolApproval(
          selected === "Yes"
            ? true
            : selected === "Tell me why?"
              ? "explain"
              : false,
        );
        return;
      }
      return;
    }
    if (
      normalizedKey.ctrl === true &&
      normalizedKey.name === "d" &&
      state.input.value === ""
    ) {
      exit();
      return;
    }
    if (state.commandMenu !== undefined && normalizedKey.name === "up") {
      state = moveCommandMenu(state, -1);
      redraw();
      return;
    }
    if (state.commandMenu !== undefined && normalizedKey.name === "down") {
      state = moveCommandMenu(state, 1);
      redraw();
      return;
    }
    if (normalizedKey.name === "up") {
      state = moveWorkbenchScroll(state, 1);
      redraw();
      return;
    }
    if (normalizedKey.name === "down") {
      state = moveWorkbenchScroll(state, -1);
      redraw();
      return;
    }
    if (normalizedKey.name === "pageup") {
      state = moveWorkbenchScroll(state, 8);
      redraw();
      return;
    }
    if (normalizedKey.name === "pagedown") {
      state = moveWorkbenchScroll(state, -8);
      redraw();
      return;
    }
    if (normalizedKey.name === "return") {
      if (activeController !== undefined) return;
      if (
        state.commandMenu !== undefined &&
        !isKnownCommand(state.input.value)
      ) {
        const command = selectedCommand(state);
        if (command !== undefined) {
          state = setWorkbenchInput(setCommandMenu(state, false), command);
          redraw();
        }
        return;
      }
      void submit();
      return;
    }
    const inputKey = mapInputKey(value, normalizedKey);
    if (inputKey === undefined || activeController !== undefined) return;
    const input = applyInputKey(state.input, inputKey);
    state = {
      ...state,
      input,
      commandMenu: input.value.startsWith("/") ? { selected: 0 } : undefined,
    };
    redraw();
  };

  process.on("SIGINT", handleInterrupt);
  options.input.prependListener("data", handleMouseData);
  emitKeypressEvents(options.input);
  options.input.on("keypress", handleKeypress);
  options.output.on("resize", redraw);
  options.output.write(ENTER_ALTERNATE_SCREEN);
  try {
    await playAnimation({
      columns: terminalColumns(options.output),
      rows: terminalRows(options.output),
      color: options.color,
      write: (text) => options.output.write(text),
    });
    if (
      options.input.isTTY === true &&
      options.input.setRawMode !== undefined
    ) {
      options.input.setRawMode(true);
      rawModeEnabled = true;
    }
    redraw();
    await finished;
  } finally {
    process.removeListener("SIGINT", handleInterrupt);
    options.input.off("keypress", handleKeypress);
    options.input.off("data", handleMouseData);
    options.output.off("resize", redraw);
    if (rawModeEnabled) options.input.setRawMode?.(false);
    stopActivityAnimation();
    options.input.pause();
    options.output.write(LEAVE_ALTERNATE_SCREEN);
  }
}
