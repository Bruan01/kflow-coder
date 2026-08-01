// 从 Node.js fs/promises 导入异步读取文件的函数
import { readFile } from "node:fs/promises";

// 导入配置相关的类型和错误类
import { type ConfigIssue, ConfigError, type KfcConfig } from "./config.js";
// 导入凭证文件相关的类型和 schema
import {
  type CredentialsFileData,
  credentialsFileSchema,
} from "./credentials.js";
// 导入路径解析函数
import { resolveConfigPath, resolveCredentialsPath } from "./config-path.js";
// 导入配置文件 schema 和最终配置 schema
import {
  type ConfigFileData,
  configFileSchema,
  finalConfigSchema,
} from "./schema.js";
// 导入运行时设置
import { runtimeSettings } from "./runtime-settings.js";

// LoadConfigOptions：加载配置时的可选参数（支持依赖注入，便于测试）
export interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv; // 自定义环境变量对象
  configPath?: string; // 自定义配置文件路径
  credentialsPath?: string; // 自定义凭证文件路径
  readTextFile?: (path: string) => Promise<string>; // 自定义文件读取函数（用于注入 mock）
  readCredentialsTextFile?: (path: string) => Promise<string>; // 自定义凭证文件读取函数
}

// envText：从环境变量中安全地获取非空字符串值
function envText(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim(); // 读取环境变量并去空白
  return value ? value : undefined; // 空字符串视为未设置
}

// errorCode：从 Node.js 错误对象中提取错误码（如 "ENOENT"）
function errorCode(error: unknown): string | undefined {
  // 检查是否为具有 code 属性的对象（Node.js 系统错误的特征）
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

// fileIssues：将 Zod 解析错误的 issues 数组转换为 ConfigIssue 数组
function fileIssues(error: {
  issues: readonly { path: PropertyKey[]; message: string }[]; // Zod 的 issues 格式
}): ConfigIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "config", // 将路径数组拼接为 "a.b.c" 格式
    message: issue.message, // 保留原始消息
  }));
}

// finalIssueMessage：根据配置路径返回人类可读的错误消息
function finalIssueMessage(path: string): string {
  // 预定义每个路径对应的友好错误消息
  const messages: Record<string, string> = {
    "provider.apiKey": "Provider API Key is required",
    "provider.baseUrl": "Provider base URL is required",
    "provider.model": "Provider model is required",
    "provider.protocol":
      "Provider protocol must be openai-chat-completions or openai-responses",
    "provider.timeoutMs": "Provider timeout must be between 1000 and 300000 ms",
    "ui.theme": "UI theme is not supported",
  };
  return messages[path] ?? "Configuration value is invalid"; // 未匹配时返回通用消息
}

// finalIssues：将最终配置验证的 Zod 错误转换为 ConfigIssue 数组（含特殊处理）
function finalIssues(error: {
  issues: readonly { path: PropertyKey[]; code: string }[]; // Zod 最终验证的 issues，含 code 字段
}): ConfigIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".") || "config"; // 拼接路径
    let message = finalIssueMessage(path); // 获取预定义消息
    // 特殊处理：如果 baseUrl 不是 invalid_type 错误但验证失败，说明 URL 格式不正确
    if (path === "provider.baseUrl" && issue.code !== "invalid_type") {
      message = "Provider base URL must be a valid URL";
    }
    return { path, message };
  });
}

// readOptionalJson：通用的"读取 JSON 文件并验证"函数，文件不存在时返回 null
async function readOptionalJson<T>(
  path: string, // 文件路径
  readTextFile: (path: string) => Promise<string>, // 文件读取函数
  options: {
    // 配置选项
    readErrorCode: "CONFIG_FILE_READ_FAILED" | "CREDENTIALS_FILE_READ_FAILED"; // 读取失败的错误码
    invalidErrorCode: "CONFIG_FILE_INVALID" | "CREDENTIALS_FILE_INVALID"; // 内容无效的错误码
    readMessage: string; // 读取失败的消息
    invalidJsonMessage: string; // JSON 解析失败的消息
    invalidSchemaMessage: string; // Schema 验证失败的消息
    parse(value: unknown):
      // Zod parse 函数（safeParse）
      | { success: true; data: T }
      | {
          success: false;
          error: {
            issues: readonly { path: PropertyKey[]; message: string }[];
          };
        };
  },
): Promise<T | null> {
  let content: string;
  try {
    content = await readTextFile(path); // 尝试读取文件内容
  } catch (error) {
    // 如果文件不存在（ENOENT），返回 null 表示可选文件缺失
    if (errorCode(error) === "ENOENT") return null;
    // 其他读取错误（如权限问题）抛出 ConfigError
    throw new ConfigError(options.readErrorCode, options.readMessage);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content); // 尝试解析 JSON
  } catch {
    // JSON 解析失败
    throw new ConfigError(options.invalidErrorCode, options.invalidJsonMessage);
  }

  // 使用 Zod schema 验证解析后的数据
  const result = options.parse(parsed);
  if (!result.success) {
    // Schema 验证失败，抛出带 issues 详情的 ConfigError
    throw new ConfigError(
      options.invalidErrorCode,
      options.invalidSchemaMessage,
      fileIssues(result.error),
    );
  }
  return result.data; // 返回验证通过的数据
}

// readConfigFile：读取并验证配置文件，文件不存在时返回空对象 {}
async function readConfigFile(
  path: string,
  reader: (path: string) => Promise<string>,
): Promise<ConfigFileData> {
  return (
    // 使用通用 readOptionalJson 读取，文件不存在时返回 null，然后用 ?? 替代为空对象
    (await readOptionalJson(path, reader, {
      readErrorCode: "CONFIG_FILE_READ_FAILED",
      invalidErrorCode: "CONFIG_FILE_INVALID",
      readMessage: "Unable to read configuration file",
      invalidJsonMessage: "Configuration file contains invalid JSON",
      invalidSchemaMessage:
        "Configuration file does not match the expected schema",
      parse: (value) => configFileSchema.safeParse(value), // 使用 configFileSchema 验证
    })) ?? {}
  );
}

// readCredentialsFile：读取并验证凭证文件，文件不存在时返回 null
async function readCredentialsFile(
  path: string,
  reader: (path: string) => Promise<string>,
): Promise<CredentialsFileData | null> {
  // 使用通用 readOptionalJson 读取，文件不存在时返回 null
  return readOptionalJson(path, reader, {
    readErrorCode: "CREDENTIALS_FILE_READ_FAILED",
    invalidErrorCode: "CREDENTIALS_FILE_INVALID",
    readMessage: "Unable to read credentials file",
    invalidJsonMessage: "Credentials file contains invalid JSON",
    invalidSchemaMessage: "Credentials file does not match the expected schema",
    parse: (value) => credentialsFileSchema.safeParse(value), // 使用 credentialsFileSchema 验证
  });
}

// loadConfig：主配置加载函数，按优先级合并环境变量、配置文件、凭证文件
export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<KfcConfig> {
  // 解析各项依赖，支持通过 options 注入自定义实现
  const env = options.env ?? process.env; // 环境变量对象
  const configPath = options.configPath ?? resolveConfigPath(env); // 配置文件路径
  const credentialsPath =
    options.credentialsPath ?? resolveCredentialsPath(env, configPath); // 凭证文件路径
  // 文件读取函数：优先使用注入的，否则使用 Node.js 默认的 readFile
  const readConfigText =
    options.readTextFile ?? ((path: string) => readFile(path, "utf8"));
  const readCredentialsText =
    options.readCredentialsTextFile ??
    ((path: string) => readFile(path, "utf8"));

  // 读取配置文件
  const file = await readConfigFile(configPath, readConfigText);

  // 从环境变量读取各项配置（环境变量优先级最高）
  const timeoutText = envText(env, "KFC_TIMEOUT_MS"); // 超时时间环境变量
  const baseUrl = envText(env, "KFC_BASE_URL") ?? file.provider?.baseUrl; // Base URL（环境变量 > 文件）
  const environmentApiKey = envText(env, "KFC_API_KEY"); // API Key 环境变量
  const theme = envText(env, runtimeSettings.ui.theme.envVar) ?? file.ui?.theme; // 主题（环境变量 > 文件）

  // 如果环境变量中已设置 API Key，则不再读取凭证文件；否则读取
  const credentials = environmentApiKey
    ? null
    : await readCredentialsFile(credentialsPath, readCredentialsText);

  // 安全检查：凭证中的 baseUrl 必须与当前活跃的 baseUrl 匹配
  if (credentials && baseUrl && credentials.provider.baseUrl !== baseUrl) {
    throw new ConfigError(
      "CONFIG_INVALID",
      "Stored credentials do not match the active Provider",
      [
        {
          path: "provider.apiKey",
          message: "Stored credentials do not match Provider base URL",
        },
      ],
    );
  }

  // 组装候选配置对象（合并所有来源的值）
  const candidate = {
    provider: {
      type: "openai-compatible" as const, // 类型固定
      protocol:
        envText(env, "KFC_PROTOCOL") ?? // 协议：环境变量 > 文件 > 默认值
        file.provider?.protocol ??
        "openai-chat-completions",
      baseUrl, // Base URL
      model: envText(env, "KFC_MODEL") ?? file.provider?.model, // 模型：环境变量 > 文件
      apiKey: environmentApiKey ?? credentials?.provider.apiKey, // API Key：环境变量 > 凭证文件
      timeoutMs:
        timeoutText === undefined // 超时：环境变量 > 文件 > 默认 60000ms
          ? (file.provider?.timeoutMs ?? 60000)
          : Number(timeoutText), // 环境变量是字符串，需要转数字
    },
    // 条件展开：只在 theme 已确定时才包含 ui 字段
    ...(theme === undefined ? {} : { ui: { theme } }),
  };

  // 使用 finalConfigSchema 对候选配置做最终验证
  const result = finalConfigSchema.safeParse(candidate);
  if (!result.success) {
    // 验证失败：抛出含详细问题的 ConfigError
    throw new ConfigError(
      "CONFIG_INVALID",
      "Configuration is incomplete or invalid",
      finalIssues(result.error),
    );
  }

  // 返回经过验证的最终配置
  return result.data;
}
