// 导入 Zod 验证库
import { z } from "zod";

// 导入运行时设置（用于主题枚举值）
import { runtimeSettings } from "./runtime-settings.js";

// providerTimeoutSchema：超时时间验证 — 整数，范围 1000ms ~ 300000ms（5分钟）
export const providerTimeoutSchema = z.number().int().min(1000).max(300000);

// providerBaseUrlSchema：Base URL 验证 — 先去空白，再验证是合法 URL，最后确认协议是 http 或 https
export const providerBaseUrlSchema = z
  .string()
  .trim() // 去除首尾空白
  .url() // 验证是否为合法 URL 格式
  .refine((value) => {
    // 自定义精炼：检查协议
    try {
      const protocol = new URL(value).protocol; // 解析 URL 获取协议
      return protocol === "http:" || protocol === "https:"; // 只允许 http 或 https
    } catch {
      return false; // URL 解析失败，拒绝
    }
  });

// providerModelSchema：模型名称验证 — 非空去空白字符串
export const providerModelSchema = z.string().trim().min(1);

// providerProtocolSchema：协议枚举验证 — 只允许两种值
export const providerProtocolSchema = z.enum([
  "openai-chat-completions",
  "openai-responses",
]);

// themeNameSchema：主题名称枚举验证 — 从运行时设置中提取可用的主题列表
export const themeNameSchema = z.enum(runtimeSettings.ui.theme.options);

// configFileSchema：配置文件内容的 Zod schema（所有字段可选，因为可以来自环境变量）
export const configFileSchema = z
  .object({
    provider: z // provider 字段（可选）
      .object({
        type: z.literal("openai-compatible").optional(), // type 固定为 "openai-compatible"，可选
        protocol: providerProtocolSchema.optional(), // 协议，可选
        baseUrl: providerBaseUrlSchema.optional(), // Base URL，可选
        model: providerModelSchema.optional(), // 模型名称，可选
        timeoutMs: providerTimeoutSchema.optional(), // 超时时间，可选
      })
      .strict() // provider 对象不允许额外字段
      .optional(), // provider 整体可选
    ui: z // ui 字段（可选）
      .object({
        theme: themeNameSchema.optional(), // 主题名称，可选
      })
      .strict() // ui 对象不允许额外字段
      .optional(), // ui 整体可选
  })
  .strict(); // 顶层对象不允许额外字段

// finalConfigSchema：最终合并后的配置 schema（所有字段必填，因为已由 loadConfig 补全）
export const finalConfigSchema = z.object({
  provider: z.object({
    // provider 必填
    type: z.literal("openai-compatible"), // type 固定为 "openai-compatible"
    protocol: providerProtocolSchema, // 协议，必填
    baseUrl: providerBaseUrlSchema, // Base URL，必填
    model: providerModelSchema, // 模型名称，必填
    apiKey: z.string().trim().min(1), // API Key，必填，非空
    timeoutMs: providerTimeoutSchema, // 超时时间，必填
  }),
  ui: z // ui 可选
    .object({
      theme: themeNameSchema, // 主题名称
    })
    .optional(),
});

// ConfigFileData：从 configFileSchema 推导出的 TypeScript 类型（所有字段可选）
export type ConfigFileData = z.infer<typeof configFileSchema>;
