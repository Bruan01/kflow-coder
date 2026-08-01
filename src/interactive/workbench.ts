import type { InputEditorState } from "./input-editor.js";
import { createInputEditor } from "./input-editor.js";
import { sanitizeTerminalText } from "./sanitize-terminal-text.js";
import { interactiveCommands, type InteractiveCommandItem } from "./catalog.js";
import type { ThemeName } from "../config/runtime-settings.js";
import { getInteractiveTheme, type WorkbenchTheme } from "./themes.js";

export type WorkbenchEvent =
  | { readonly type: "user"; readonly text: string }
  | { readonly type: "assistant"; readonly text: string }
  | { readonly type: "tool"; readonly name: string }
  | {
      readonly type: "notice";
      readonly text: string;
      readonly tone: "info" | "warning" | "error";
    };

export type CommandMenuItem = InteractiveCommandItem;

export interface InteractiveToolStatus {
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
}

export interface InteractiveSessionInfo {
  readonly model: string;
  readonly cwd: string;
  readonly protocol: string;
  readonly theme: ThemeName;
  readonly turns: number;
  readonly enabledToolCount: number;
  readonly totalToolCount: number;
}

const commandMenuItems = interactiveCommands;

export interface WorkbenchState {
  readonly events: readonly WorkbenchEvent[];
  readonly input: InputEditorState;
  readonly status: "Ready" | "Working" | "Cancelled" | "Error";
  readonly commandMenu: { readonly selected: number } | undefined;
  readonly toolMenu: { readonly selected: number } | undefined;
  readonly themeMenu: { readonly selected: number } | undefined;
  readonly scrollOffset: number;
  readonly clearConfirmation: boolean;
}

export interface WorkbenchRenderOptions {
  readonly columns: number;
  readonly rows: number;
  readonly color: boolean;
  readonly tools?: readonly InteractiveToolStatus[];
  readonly themes?: readonly WorkbenchTheme[];
  readonly theme?: WorkbenchTheme;
  readonly sessionInfo?: InteractiveSessionInfo;
}

function sanitizeDisplayText(text: string): string {
  return sanitizeTerminalText(text);
}

function truncate(text: string, columns: number): string {
  if (columns < 2 || text.length <= columns) return text;
  return `${text.slice(0, columns - 1)}…`;
}

function eventLines(
  event: WorkbenchEvent,
  columns: number,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  const width = Math.max(1, columns - 6);
  if (event.type === "tool")
    return [
      colored(`  ✓ Tool  ${truncate(event.name, width)}`, palette.tool, color),
    ];
  if (event.type === "notice") {
    const code =
      event.tone === "error"
        ? palette.error
        : event.tone === "warning"
          ? palette.warning
          : palette.info;
    return sanitizeDisplayText(event.text)
      .split("\n")
      .map((line) => colored(`  ! ${truncate(line, width)}`, code, color));
  }
  if (event.type === "user") {
    return sanitizeDisplayText(event.text)
      .split("\n")
      .map((line, index) =>
        colored(
          `${index === 0 ? "you › " : "      "}${truncate(line, width)}`,
          palette.user,
          color,
        ),
      );
  }
  const lines = sanitizeDisplayText(event.text).split("\n");
  return lines.map((line, index) =>
    colored(
      `${index === 0 ? "KFC › " : "      "}${truncate(line, width)}`,
      palette.assistant,
      color,
    ),
  );
}

function colored(text: string, code: string, color: boolean): string {
  return color ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function renderInput(
  input: InputEditorState,
  columns: number,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  const safe = sanitizeDisplayText(input.value);
  const cursor = Math.min(safe.length, Math.max(0, input.cursor));
  const before = safe.slice(0, cursor);
  const selected = safe.slice(cursor, cursor + 1) || " ";
  const after = safe.slice(cursor + 1);
  const highlighted = color
    ? `\u001b[${palette.selection}m${selected}\u001b[0m`
    : `[${selected}]`;
  const inputLines = `${before}${highlighted}${after}`.split("\n");
  const visible = inputLines
    .slice(-2)
    .map(
      (line, index) =>
        `${index === 0 ? "› " : "  "}${truncate(line, Math.max(1, columns - 2))}`,
    );
  return visible.length === 0 ? ["› "] : visible;
}

function filteredCommands(input: string): readonly CommandMenuItem[] {
  const query = input.startsWith("/") ? input.slice(1).toLowerCase() : "";
  const filtered = commandMenuItems.filter((item) =>
    item.command.slice(1).startsWith(query),
  );
  return filtered.length > 0 ? filtered : commandMenuItems;
}

function renderCommandMenu(
  state: WorkbenchState,
  columns: number,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  if (state.commandMenu === undefined) return [];
  const commands = filteredCommands(state.input.value);
  const selected = Math.min(state.commandMenu.selected, commands.length - 1);
  return commands.map((item, index) => {
    const text = `  ${item.command.padEnd(8)} ${item.label}`;
    const line = truncate(text, columns);
    if (index === selected) return colored(line, palette.selection, color);
    return colored(line, palette.info, color);
  });
}

function renderToolMenu(
  state: WorkbenchState,
  tools: readonly InteractiveToolStatus[],
  columns: number,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  if (state.toolMenu === undefined) return [];
  const selected =
    tools.length === 0
      ? -1
      : Math.min(state.toolMenu.selected, tools.length - 1);
  const lines = [colored("  工具管理", palette.header, color)];
  if (tools.length === 0) {
    lines.push(colored("  当前没有可用工具", palette.info, color));
  } else {
    lines.push(
      ...tools.map((tool, index) => {
        const marker = tool.enabled ? "✓" : "○";
        const text = `  ${marker} ${tool.name}  ${tool.description}`;
        const line = truncate(text, columns);
        return index === selected
          ? colored(line, palette.selection, color)
          : line;
      }),
    );
  }
  lines.push(
    colored(
      "  ↑↓ 选择 · Space 启用/关闭 · Enter/Esc 返回",
      palette.info,
      color,
    ),
  );
  return lines;
}

function renderThemeMenu(
  state: WorkbenchState,
  themes: readonly WorkbenchTheme[],
  currentThemeName: ThemeName,
  columns: number,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  if (state.themeMenu === undefined) return [];
  const selected =
    themes.length === 0
      ? -1
      : Math.min(state.themeMenu.selected, themes.length - 1);
  const lines = [
    colored("  主题管理（上下键实时预览）", palette.header, color),
  ];
  if (themes.length === 0) {
    lines.push(colored("  当前没有可用主题", palette.info, color));
  } else {
    lines.push(
      ...themes.map((theme, index) => {
        const marker = theme.name === currentThemeName ? "●" : "○";
        const text = `  ${marker} ${theme.label}  ${theme.description}`;
        const line = truncate(text, columns);
        return index === selected
          ? colored(line, palette.selection, color)
          : colored(line, palette.info, color);
      }),
    );
  }
  lines.push(
    colored("  ↑↓ 选择并实时切换 · Enter/Esc 返回", palette.info, color),
  );
  return lines;
}

function statusCode(
  status: WorkbenchState["status"],
  palette: WorkbenchTheme["palette"],
): string {
  if (status === "Working") return palette.statusWorking;
  if (status === "Cancelled") return palette.statusCancelled;
  if (status === "Error") return palette.statusError;
  return palette.statusReady;
}

function confirmationLines(
  state: WorkbenchState,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  if (!state.clearConfirmation) return [];
  return [
    colored("  确认清除当前会话上下文和时间线？", palette.warning, color),
    colored("  输入 y 确认，其他任意内容取消", palette.warning, color),
  ];
}

function sessionInfoLines(
  info: InteractiveSessionInfo | undefined,
  columns: number,
  color: boolean,
  palette: WorkbenchTheme["palette"],
): readonly string[] {
  if (info === undefined) return [];
  return [
    colored(
      truncate(
        `  模型: ${info.model} · 协议: ${info.protocol} · 主题: ${info.theme}`,
        columns,
      ),
      palette.meta,
      color,
    ),
    colored(
      truncate(
        `  目录: ${info.cwd} · 会话: ${info.turns} 轮 · 工具: ${info.enabledToolCount}/${info.totalToolCount}`,
        columns,
      ),
      palette.meta,
      color,
    ),
  ];
}

export function createWorkbenchState(): WorkbenchState {
  return {
    events: [],
    input: createInputEditor(),
    status: "Ready",
    commandMenu: undefined,
    toolMenu: undefined,
    themeMenu: undefined,
    scrollOffset: 0,
    clearConfirmation: false,
  };
}

export function appendAssistantText(
  state: WorkbenchState,
  text: string,
): WorkbenchState {
  const last = state.events.at(-1);
  const events =
    last?.type === "assistant"
      ? [
          ...state.events.slice(0, -1),
          { type: "assistant" as const, text: `${last.text}${text}` },
        ]
      : [...state.events, { type: "assistant" as const, text }];
  return { ...state, events, status: "Working", scrollOffset: 0 };
}

export function appendUserEvent(
  state: WorkbenchState,
  text: string,
): WorkbenchState {
  return {
    ...state,
    events: [
      ...state.events,
      { type: "user", text: sanitizeDisplayText(text) },
    ],
    status: "Working",
    scrollOffset: 0,
  };
}

export function appendToolEvent(
  state: WorkbenchState,
  name: string,
): WorkbenchState {
  return {
    ...state,
    events: [
      ...state.events,
      { type: "tool", name: sanitizeDisplayText(name) },
    ],
    status: "Working",
    scrollOffset: 0,
  };
}

export function appendNotice(
  state: WorkbenchState,
  text: string,
  status: WorkbenchState["status"] = "Ready",
  tone?: WorkbenchEvent extends {
    readonly type: "notice";
    readonly tone: infer Tone;
  }
    ? Tone
    : never,
): WorkbenchState {
  return {
    ...state,
    events: [
      ...state.events,
      {
        type: "notice",
        text: sanitizeDisplayText(text),
        tone:
          tone ??
          (status === "Error"
            ? "error"
            : status === "Cancelled"
              ? "warning"
              : "info"),
      },
    ],
    status,
    scrollOffset: 0,
  };
}

export function setWorkbenchInput(
  state: WorkbenchState,
  value: string,
  cursor = value.length,
): WorkbenchState {
  const safe = sanitizeDisplayText(value);
  return {
    ...state,
    input: { value: safe, cursor: Math.min(safe.length, Math.max(0, cursor)) },
  };
}

export function setWorkbenchStatus(
  state: WorkbenchState,
  status: WorkbenchState["status"],
): WorkbenchState {
  return { ...state, status };
}

export function setCommandMenu(
  state: WorkbenchState,
  open: boolean,
): WorkbenchState {
  return {
    ...state,
    commandMenu: open ? { selected: 0 } : undefined,
    toolMenu: open ? undefined : state.toolMenu,
    themeMenu: open ? undefined : state.themeMenu,
  };
}

export function setToolMenu(
  state: WorkbenchState,
  open: boolean,
  selected = 0,
): WorkbenchState {
  return {
    ...state,
    toolMenu: open ? { selected: Math.max(0, selected) } : undefined,
    commandMenu: open ? undefined : state.commandMenu,
    themeMenu: open ? undefined : state.themeMenu,
  };
}

export function setThemeMenu(
  state: WorkbenchState,
  open: boolean,
  selected = 0,
): WorkbenchState {
  return {
    ...state,
    themeMenu: open ? { selected: Math.max(0, selected) } : undefined,
    commandMenu: open ? undefined : state.commandMenu,
    toolMenu: open ? undefined : state.toolMenu,
  };
}

export function setClearConfirmation(
  state: WorkbenchState,
  pending: boolean,
): WorkbenchState {
  return {
    ...state,
    clearConfirmation: pending,
    commandMenu: pending ? undefined : state.commandMenu,
    toolMenu: pending ? undefined : state.toolMenu,
    themeMenu: pending ? undefined : state.themeMenu,
  };
}

export function moveWorkbenchScroll(
  state: WorkbenchState,
  delta: number,
): WorkbenchState {
  const maximum = Math.max(0, state.events.length - 1);
  return {
    ...state,
    scrollOffset: Math.min(maximum, Math.max(0, state.scrollOffset + delta)),
  };
}

export function moveCommandMenu(
  state: WorkbenchState,
  delta: number,
): WorkbenchState {
  if (state.commandMenu === undefined) return state;
  const commands = filteredCommands(state.input.value);
  const selected =
    (state.commandMenu.selected + delta + commands.length) % commands.length;
  return { ...state, commandMenu: { selected } };
}

export function moveToolMenu(
  state: WorkbenchState,
  delta: number,
  toolCount: number,
): WorkbenchState {
  if (state.toolMenu === undefined || toolCount < 1) return state;
  const selected = (state.toolMenu.selected + delta + toolCount) % toolCount;
  return { ...state, toolMenu: { selected } };
}

export function moveThemeMenu(
  state: WorkbenchState,
  delta: number,
  themeCount: number,
): WorkbenchState {
  if (state.themeMenu === undefined || themeCount < 1) return state;
  const selected = (state.themeMenu.selected + delta + themeCount) % themeCount;
  return { ...state, themeMenu: { selected } };
}

export function selectedThemeIndex(state: WorkbenchState): number | undefined {
  return state.themeMenu?.selected;
}

export function selectedCommand(state: WorkbenchState): string | undefined {
  if (state.commandMenu === undefined) return undefined;
  const commands = filteredCommands(state.input.value);
  return commands[Math.min(state.commandMenu.selected, commands.length - 1)]
    ?.command;
}

export function isKnownCommand(input: string): boolean {
  return commandMenuItems.some((item) => item.command === input);
}

export function renderWorkbench(
  state: WorkbenchState,
  options: WorkbenchRenderOptions,
): string {
  const columns = Math.max(24, options.columns);
  const rows = Math.max(9, options.rows);
  const theme = options.theme ?? getInteractiveTheme(undefined);
  const palette = theme.palette;
  const divider = "─".repeat(columns);
  const header = `${colored("KFLOW", palette.header, options.color)}${truncate(
    "  ·  Read-only Agent  ·  session memory",
    Math.max(1, columns - 5),
  )}`;
  const input = renderInput(state.input, columns, options.color, palette);
  const commandMenu = renderCommandMenu(state, columns, options.color, palette);
  const toolMenu = renderToolMenu(
    state,
    options.tools ?? [],
    columns,
    options.color,
    palette,
  );
  const themeMenu = renderThemeMenu(
    state,
    options.themes ?? [],
    theme.name,
    columns,
    options.color,
    palette,
  );
  const confirmation = confirmationLines(state, options.color, palette);
  const sessionInfo = sessionInfoLines(
    options.sessionInfo,
    columns,
    options.color,
    palette,
  );
  const fixedRows =
    5 +
    input.length +
    commandMenu.length +
    toolMenu.length +
    themeMenu.length +
    confirmation.length +
    sessionInfo.length;
  const transcriptRows = Math.max(1, rows - fixedRows);
  const transcript = state.events.flatMap((event) =>
    eventLines(event, columns, options.color, palette),
  );
  const transcriptEnd = Math.max(0, transcript.length - state.scrollOffset);
  const visibleTranscript = transcript.slice(
    Math.max(0, transcriptEnd - transcriptRows),
    transcriptEnd,
  );
  const status = colored(
    `${state.status}  ·  Read-only  ·  ${state.events.length} events${state.scrollOffset > 0 ? `  ·  Scroll ${state.scrollOffset} lines` : ""}  ·  Esc cancel`,
    statusCode(state.status, palette),
    options.color,
  );

  return [
    header,
    divider,
    ...visibleTranscript,
    ...Array.from(
      { length: Math.max(0, transcriptRows - visibleTranscript.length) },
      () => "",
    ),
    divider,
    truncate(status, columns),
    divider,
    ...input,
    ...commandMenu,
    ...toolMenu,
    ...themeMenu,
    ...confirmation,
    ...sessionInfo,
    colored(
      truncate("  Enter send · Ctrl+J newline · /help · /themes", columns),
      palette.info,
      options.color,
    ),
  ].join("\n");
}
