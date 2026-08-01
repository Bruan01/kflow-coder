export type InteractiveCommandName =
  "/help" | "/clear" | "/status" | "/tool" | "/themes" | "/exit";

export interface InteractiveCommandItem {
  readonly command: InteractiveCommandName;
  readonly label: string;
  readonly description: string;
}

export const interactiveCommands: readonly InteractiveCommandItem[] = [
  {
    command: "/help",
    label: "查看命令与快捷键帮助",
    description: "显示帮助和快捷键",
  },
  {
    command: "/clear",
    label: "清除当前会话上下文和时间线",
    description: "清除上下文和时间线（需要 y 确认）",
  },
  {
    command: "/status",
    label: "查看当前配置与会话用量",
    description: "查看配置、模型、工具和 Token 用量",
  },
  {
    command: "/tool",
    label: "启用或关闭当前可用工具",
    description: "管理工具开关（↑↓ 选择，Space 启用/关闭）",
  },
  {
    command: "/themes",
    label: "切换 KFlow 颜色主题",
    description: "实时切换界面主题",
  },
  {
    command: "/exit",
    label: "退出 KFlow 并恢复终端",
    description: "退出并恢复终端",
  },
];

export const interactiveToolLabels: Readonly<Record<string, string>> = {
  list_directory: "列出工作区目录",
  read_file: "读取工作区文本文件",
  grep: "搜索工作区文本内容",
};

export function interactiveToolDescription(
  name: string,
  fallback: string,
): string {
  return interactiveToolLabels[name] ?? fallback;
}
