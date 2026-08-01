// 导入 Node.js 内置模块
import { homedir } from "node:os"; // 获取用户主目录
import { dirname, isAbsolute, join, resolve } from "node:path"; // 路径处理函数

// ConfigPathOptions：路径解析的可选配置
export interface ConfigPathOptions {
  homeDirectory?: string; // 自定义主目录（覆盖默认 homedir()）
  currentDirectory?: string; // 自定义当前目录（覆盖默认 process.cwd()）
}

// nonEmpty：过滤掉空字符串和纯空白字符串，返回 undefined
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim(); // 可选链 + trim 去除空白
  return trimmed ? trimmed : undefined; // 有内容则返回，否则返回 undefined
}

// resolveOptionalPath：解析可选的路径值，支持相对路径转绝对路径
function resolveOptionalPath(
  value: string | undefined,
  currentDirectory: string,
): string | undefined {
  const path = nonEmpty(value); // 先过滤空值
  if (!path) return undefined; // 空则直接返回 undefined
  return isAbsolute(path) ? path : resolve(currentDirectory, path); // 绝对路径原样返回，相对路径拼接为绝对路径
}

// resolveConfigPath：解析配置文件的最终路径（优先级：环境变量 > XDG 规范 > 默认位置）
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env, // 环境变量对象，默认 process.env
  options: ConfigPathOptions = {}, // 可选配置
): string {
  const homeDirectory = options.homeDirectory ?? homedir(); // 获取主目录
  const currentDirectory = options.currentDirectory ?? process.cwd(); // 获取当前工作目录
  // 第一优先级：检查 KFC_CONFIG_PATH 环境变量
  const explicitPath = resolveOptionalPath(
    env.KFC_CONFIG_PATH,
    currentDirectory,
  );
  if (explicitPath) return explicitPath; // 如果设置了且非空，直接使用

  // 第二优先级：遵循 XDG_CONFIG_HOME 规范，默认为 ~/.config
  const configHome =
    nonEmpty(env.XDG_CONFIG_HOME) ?? join(homeDirectory, ".config");
  // 返回默认路径：$XDG_CONFIG_HOME/kfc/config.json 或 ~/.config/kfc/config.json
  return join(configHome, "kfc", "config.json");
}

// resolveCredentialsPath：解析凭证文件的最终路径
export function resolveCredentialsPath(
  env: NodeJS.ProcessEnv = process.env, // 环境变量对象
  configPath = resolveConfigPath(env), // 默认使用 configPath 的同级目录
  options: ConfigPathOptions = {}, // 可选配置
): string {
  const currentDirectory = options.currentDirectory ?? process.cwd();
  // 第一优先级：检查 KFC_CREDENTIALS_PATH 环境变量
  const explicitPath = resolveOptionalPath(
    env.KFC_CREDENTIALS_PATH,
    currentDirectory,
  );
  // 如果未设置环境变量，默认放在 config.json 同目录下的 credentials.json
  return explicitPath ?? join(dirname(configPath), "credentials.json");
}

/** Resolve the private directory used for local JSONL session journals. */
export function resolveSessionsDirectory(
  env: NodeJS.ProcessEnv = process.env,
  options: ConfigPathOptions = {},
): string {
  return join(dirname(resolveConfigPath(env, options)), "sessions");
}
