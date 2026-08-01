// runtimeSettings：运行时设置常量对象，使用 as const 确保所有值被推断为字面量类型
export const runtimeSettings = {
  ui: {
    // UI 相关设置
    theme: {
      //   主题设置
      envVar: "KFC_THEME", // 控制主题的环境变量名
      defaultValue: "kflow-dark", // 默认主题：kflow-dark
      options: [
        // 支持的主题选项（as const 确保字面量类型）
        "kflow-dark",
        "nord",
        "dracula",
        "gruvbox",
        "light",
        "high-contrast",
      ] as const,
    },
  },
} as const;

// ThemeName：主题名称类型（从 options 数组中提取的联合类型）
// (typeof runtimeSettings.ui.theme.options)[number] 表示取数组元素的联合类型
export type ThemeName = (typeof runtimeSettings.ui.theme.options)[number];

// DEFAULT_THEME：默认主题常量，显式断言为 ThemeName 类型
export const DEFAULT_THEME = runtimeSettings.ui.theme.defaultValue as ThemeName;
