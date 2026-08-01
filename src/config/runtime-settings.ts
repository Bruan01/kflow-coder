export const runtimeSettings = {
  agent: {
    maxSteps: {
      envVar: "KFC_AGENT_MAX_STEPS",
      defaultValue: 8,
      minimum: 1,
      maximum: 64,
    },
  },
} as const;

export const DEFAULT_AGENT_MAX_STEPS =
  runtimeSettings.agent.maxSteps.defaultValue;

export const MAX_AGENT_MAX_STEPS = runtimeSettings.agent.maxSteps.maximum;
