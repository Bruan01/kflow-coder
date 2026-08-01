// 导入配置错误类和运行时设置
import { ConfigError } from "../config/config.js";
import {
  DEFAULT_AGENT_MAX_STEPS, // Agent 默认最大步数
  runtimeSettings, // 运行时设置对象
} from "../config/runtime-settings.js";

// 导出 Agent 允许的最大步数上限（来自运行时设置）
export const MAX_AGENT_MAX_STEPS = runtimeSettings.agent.maxSteps.maximum;

// resolveAgentMaxSteps：从环境变量解析 Agent 最大步数，带校验
export function resolveAgentMaxSteps(
  // 默认从运行时设置中指定的环境变量名读取值
  rawValue = process.env[runtimeSettings.agent.maxSteps.envVar],
): number {
  // 如果环境变量未设置，返回默认值
  if (rawValue === undefined) return DEFAULT_AGENT_MAX_STEPS;
  // 尝试将字符串转为数字（去除前后空白）
  const value = Number(rawValue.trim());
  // 校验：不能为空字符串、必须是整数、必须在最小值和最大值之间
  if (
    rawValue.trim() === "" ||
    !Number.isInteger(value) ||
    value < runtimeSettings.agent.maxSteps.minimum ||
    value > MAX_AGENT_MAX_STEPS
  ) {
    // 校验失败抛出配置错误
    throw new ConfigError("CONFIG_INVALID", "Invalid Agent step limit", [
      {
        path: "KFC_AGENT_MAX_STEPS",
        message: `Must be an integer between 1 and ${MAX_AGENT_MAX_STEPS}`,
      },
    ]);
  }
  // 返回解析并校验后的值
  return value;
}
