import {
  DEFAULT_THEME,
  runtimeSettings,
  type ThemeName,
} from "../config/runtime-settings.js";

export interface ThemePalette {
  readonly header: string;
  readonly divider: string;
  readonly assistant: string;
  readonly user: string;
  readonly tool: string;
  readonly info: string;
  readonly warning: string;
  readonly error: string;
  readonly statusReady: string;
  readonly statusWorking: string;
  readonly statusCancelled: string;
  readonly statusError: string;
  readonly meta: string;
  readonly selection: string;
  readonly input: string;
}

export interface WorkbenchTheme {
  readonly name: ThemeName;
  readonly label: string;
  readonly description: string;
  readonly palette: ThemePalette;
}

const palettes: Record<ThemeName, ThemePalette> = {
  "kflow-dark": {
    header: "1;36",
    divider: "2;36",
    assistant: "37",
    user: "36",
    tool: "32",
    info: "2;37",
    warning: "33",
    error: "31",
    statusReady: "2;37",
    statusWorking: "36",
    statusCancelled: "33",
    statusError: "31",
    meta: "2;36",
    selection: "7",
    input: "1;37",
  },
  nord: {
    header: "1;96",
    divider: "2;94",
    assistant: "97",
    user: "96",
    tool: "92",
    info: "2;97",
    warning: "93",
    error: "91",
    statusReady: "2;97",
    statusWorking: "96",
    statusCancelled: "93",
    statusError: "91",
    meta: "2;96",
    selection: "7;94",
    input: "1;97",
  },
  dracula: {
    header: "1;95",
    divider: "2;35",
    assistant: "97",
    user: "95",
    tool: "92",
    info: "2;97",
    warning: "93",
    error: "91",
    statusReady: "2;37",
    statusWorking: "95",
    statusCancelled: "93",
    statusError: "91",
    meta: "2;95",
    selection: "7;95",
    input: "1;97",
  },
  gruvbox: {
    header: "1;33",
    divider: "2;33",
    assistant: "37",
    user: "33",
    tool: "32",
    info: "2;37",
    warning: "1;33",
    error: "31",
    statusReady: "2;37",
    statusWorking: "33",
    statusCancelled: "1;33",
    statusError: "31",
    meta: "2;33",
    selection: "7;33",
    input: "1;37",
  },
  light: {
    header: "1;34",
    divider: "2;34",
    assistant: "30",
    user: "34",
    tool: "32",
    info: "2;30",
    warning: "33",
    error: "31",
    statusReady: "2;30",
    statusWorking: "34",
    statusCancelled: "33",
    statusError: "31",
    meta: "2;34",
    selection: "7;34",
    input: "1;30",
  },
  "high-contrast": {
    header: "1;97",
    divider: "1;97",
    assistant: "97",
    user: "1;93",
    tool: "1;92",
    info: "97",
    warning: "1;93",
    error: "1;91",
    statusReady: "1;97",
    statusWorking: "1;96",
    statusCancelled: "1;93",
    statusError: "1;91",
    meta: "1;96",
    selection: "7;97",
    input: "1;97",
  },
};

const themeDescriptions: Record<ThemeName, [string, string]> = {
  "kflow-dark": ["KFlow 深色", "默认的青色深色主题"],
  nord: ["Nord", "冷色、低对比度的北欧风格"],
  dracula: ["Dracula", "紫色高亮的深色主题"],
  gruvbox: ["Gruvbox", "暖色复古终端风格"],
  light: ["Light", "适合浅色终端背景"],
  "high-contrast": ["High Contrast", "高对比度和可读性优先"],
};

export const interactiveThemes: readonly WorkbenchTheme[] =
  runtimeSettings.ui.theme.options.map((name) => {
    const [label, description] = themeDescriptions[name];
    return { name, label, description, palette: palettes[name] };
  });

export function getInteractiveTheme(name: string | undefined): WorkbenchTheme {
  return (
    interactiveThemes.find((theme) => theme.name === name) ??
    interactiveThemes.find((theme) => theme.name === DEFAULT_THEME) ??
    interactiveThemes[0]!
  );
}
