#!/usr/bin/env node

import { homedir } from "node:os";

import { readPackageVersion } from "./cli/package-version.js";
import { runCli } from "./cli/run-cli.js";
import { resolveAgentMaxSteps } from "./cli/agent-settings.js";
import { runAsk } from "./ask/run-ask.js";
import { runAgent } from "./agent/run-agent.js";
import { ConfigError } from "./config/config.js";
import { resolveConfigPath } from "./config/config-path.js";
import { loadConfig } from "./config/load-config.js";
import { createDoctorDependencies } from "./doctor/create-doctor-dependencies.js";
import { runDoctor } from "./doctor/doctor.js";
import { createQuickstartDependencies } from "./quickstart/create-quickstart-dependencies.js";
import { runQuickstart } from "./quickstart/quickstart.js";
import { createModelProvider } from "./provider/create-model-provider.js";
import { ToolRegistry, createReadOnlyWorkspaceTools } from "./tool/index.js";
import { runInteractiveTerminal } from "./interactive/run-interactive-terminal.js";
import { interactiveToolDescription } from "./interactive/catalog.js";

function displayConfigPath(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`)
    ? `~${path.slice(home.length)}`
    : path;
}

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    version: readPackageVersion(),
    runDoctor: () => runDoctor(createDoctorDependencies()),
    runQuickstart: () => runQuickstart(createQuickstartDependencies()),
    runAsk: async (prompt, onText) => {
      const controller = new AbortController();
      const handleInterrupt = (): void => controller.abort();
      process.once("SIGINT", handleInterrupt);
      try {
        const config = await loadConfig();
        return await runAsk(
          prompt,
          {
            provider: createModelProvider(config.provider),
            onText,
          },
          { signal: controller.signal },
        );
      } finally {
        process.removeListener("SIGINT", handleInterrupt);
      }
    },
    runAgent: async (prompt, onText) => {
      const controller = new AbortController();
      const handleInterrupt = (): void => controller.abort();
      process.once("SIGINT", handleInterrupt);
      try {
        const config = await loadConfig();
        if (config.provider.protocol !== "openai-chat-completions") {
          throw new ConfigError("CONFIG_INVALID", "Agent mode is unavailable", [
            {
              path: "provider.protocol",
              message: "Agent mode requires openai-chat-completions",
            },
          ]);
        }
        const registry = new ToolRegistry(
          await createReadOnlyWorkspaceTools({ workspaceRoot: process.cwd() }),
        );
        const maxSteps = resolveAgentMaxSteps();
        return await runAgent(
          {
            messages: [{ role: "user", content: prompt }],
            maxSteps,
            tools: registry.listModelDefinitions(),
          },
          {
            provider: createModelProvider(config.provider),
            toolExecutor: registry,
            onText,
          },
          { signal: controller.signal },
        );
      } finally {
        process.removeListener("SIGINT", handleInterrupt);
      }
    },
    isInteractiveTerminal: () =>
      process.stdin.isTTY === true && process.stdout.isTTY === true,
    runInteractive: async () => {
      const config = await loadConfig();
      if (config.provider.protocol !== "openai-chat-completions") {
        throw new ConfigError(
          "CONFIG_INVALID",
          "Interactive mode is unavailable",
          [
            {
              path: "provider.protocol",
              message: "Interactive mode requires openai-chat-completions",
            },
          ],
        );
      }
      const registry = new ToolRegistry(
        await createReadOnlyWorkspaceTools({ workspaceRoot: process.cwd() }),
      );
      const provider = createModelProvider(config.provider);
      const maxSteps = resolveAgentMaxSteps();
      await runInteractiveTerminal({
        input: process.stdin,
        output: process.stdout,
        color: process.env.NO_COLOR === undefined,
        status: (runtime) => {
          const usage = runtime.usage;
          const tokenText =
            usage === undefined
              ? "n/a（Provider 未返回 usage）"
              : `${usage.inputTokens} / ${usage.outputTokens} / ${usage.totalTokens}`;
          return [
            "当前配置",
            `配置文件: ${displayConfigPath(resolveConfigPath())}`,
            `协议: ${config.provider.protocol}`,
            `Base URL: ${config.provider.baseUrl}`,
            `模型: ${config.provider.model}`,
            `请求超时: ${config.provider.timeoutMs}ms`,
            "API Key: 已配置（已隐藏）",
            "上下文窗口: 未知（当前 Provider 未返回）",
            `Agent 最大步数: ${runtime.maxSteps}`,
            `已启用工具: ${runtime.enabledToolCount}/${runtime.totalToolCount}`,
            "",
            "当前会话",
            `完成轮数: ${runtime.turns}`,
            `上下文消息: ${runtime.messageCount}`,
            `累计 Token（输入 / 输出 / 总计）: ${tokenText}`,
          ].join("\n");
        },
        maxSteps,
        tools: () =>
          registry.listToolStatuses().map((tool) => ({
            ...tool,
            description: interactiveToolDescription(
              tool.name,
              tool.description,
            ),
          })),
        toggleTool: (name) => {
          const tool = registry
            .listToolStatuses()
            .find((candidate) => candidate.name === name);
          if (tool !== undefined) registry.setEnabled(name, !tool.enabled);
        },
        runTurn: (messages, handlers, signal) =>
          runAgent(
            {
              messages,
              maxSteps,
              tools: registry.listModelDefinitions(),
            },
            {
              provider,
              toolExecutor: registry,
              onText: handlers.onText,
              onToolCall: handlers.onToolCall,
            },
            { signal },
          ),
      });
    },
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  });
} catch {
  process.stderr.write("Error: Unable to initialize KFC.\n");
  process.exitCode = 1;
}
