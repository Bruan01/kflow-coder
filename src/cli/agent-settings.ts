import { ConfigError } from "../config/config.js";
import {
  DEFAULT_AGENT_MAX_STEPS,
  runtimeSettings,
} from "../config/runtime-settings.js";

export const MAX_AGENT_MAX_STEPS = runtimeSettings.agent.maxSteps.maximum;

export function resolveAgentMaxSteps(
  rawValue = process.env[runtimeSettings.agent.maxSteps.envVar],
): number {
  if (rawValue === undefined) return DEFAULT_AGENT_MAX_STEPS;
  const value = Number(rawValue.trim());
  if (
    rawValue.trim() === "" ||
    !Number.isInteger(value) ||
    value < runtimeSettings.agent.maxSteps.minimum ||
    value > MAX_AGENT_MAX_STEPS
  ) {
    throw new ConfigError("CONFIG_INVALID", "Invalid Agent step limit", [
      {
        path: "KFC_AGENT_MAX_STEPS",
        message: `Must be an integer between 1 and ${MAX_AGENT_MAX_STEPS}`,
      },
    ]);
  }
  return value;
}
