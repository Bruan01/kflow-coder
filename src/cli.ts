#!/usr/bin/env node

// 声明这是一个 Node.js 可执行脚本（Unix shebang），可直接用 ./cli.js 运行

// 从 Node.js os 模块导入获取用户主目录的函数
import { homedir } from "node:os";

// 导入各个功能模块
import { readPackageVersion } from "./cli/package-version.js"; // 读取 package.json 版本号
import { runCli } from "./cli/run-cli.js"; // CLI 主运行函数
import { resolveAgentMaxSteps } from "./cli/agent-settings.js"; // 解析 Agent 最大步数
import { runAsk } from "./ask/run-ask.js"; // 运行 ask 模式
import { runAgent } from "./agent/run-agent.js"; // 运行 agent 模式
import { ConfigError } from "./config/config.js"; // 配置错误类
import { resolveConfigPath } from "./config/config-path.js"; // 解析配置文件路径
import { loadConfig } from "./config/load-config.js"; // 加载配置
import { writeThemeAtomically } from "./config/write-theme.js"; // 持久化终端主题
import { createDoctorDependencies } from "./doctor/create-doctor-dependencies.js"; // 创建诊断依赖
import { runDoctor } from "./doctor/doctor.js"; // 运行诊断
import { createQuickstartDependencies } from "./quickstart/create-quickstart-dependencies.js"; // 创建快速入门依赖
import { runQuickstart } from "./quickstart/quickstart.js"; // 运行快速入门
import { createModelProvider } from "./provider/create-model-provider.js"; // 创建模型提供者
import { ToolRegistry, createWorkspaceTools } from "./tool/index.js"; // 工具注册表和分层工作区工具
import { runInteractiveTerminal } from "./interactive/run-interactive-terminal.js"; // 运行交互终端
import { interactiveToolDescription } from "./interactive/catalog.js"; // 交互式工具描述
import { getInteractiveTheme } from "./interactive/themes.js"; // 解析交互式主题

// displayConfigPath：将配置路径显示为紧凑形式（用 ~ 替代主目录）
function displayConfigPath(path: string): string {
  const home = homedir(); // 获取当前用户的主目录（如 /home/user）
  // 如果路径等于主目录或以 "主目录/" 开头，用 ~ 替换
  return path === home || path.startsWith(`${home}/`)
    ? `~${path.slice(home.length)}` // 例如 "/home/user/.config/kfc" → "~/.config/kfc"
    : path; // 否则原样返回
}

// 顶层 try-catch：应用程序的主入口点
try {
  // 将 runCli 的返回值赋值给 process.exitCode（Node.js 进程退出时的状态码）
  // process.argv.slice(2) 去掉 node 路径和脚本路径，只保留用户参数
  process.exitCode = await runCli(process.argv.slice(2), {
    // 第二个参数是 CliEnvironment 对象，注入所有功能依赖

    version: readPackageVersion(), // 从 package.json 读取版本号

    // runDoctor：运行诊断的工厂函数，创建依赖后执行
    runDoctor: () => runDoctor(createDoctorDependencies()),

    // runQuickstart：运行快速入门向导
    runQuickstart: () => runQuickstart(createQuickstartDependencies()),

    // runAsk：运行单次提问模式（async 函数）
    runAsk: async (prompt, onText) => {
      // 创建 AbortController 用于支持用户中断（Ctrl+C）
      const controller = new AbortController();
      // 中断处理函数：调用 controller.abort() 取消正在进行的请求
      const handleInterrupt = (): void => controller.abort();
      // 注册 SIGINT（Ctrl+C）的一次性监听器
      process.once("SIGINT", handleInterrupt);
      try {
        // 加载配置文件
        const config = await loadConfig();
        // 调用核心的 runAsk 函数
        return await runAsk(
          prompt, // 用户输入的提问
          {
            provider: createModelProvider(config.provider), // 根据配置创建模型提供者
            onText, // 文本增量回调（用于流式输出）
          },
          { signal: controller.signal }, // 传入 AbortSignal 用于取消
        );
      } finally {
        // 无论成功或失败，都移除 SIGINT 监听器，避免内存泄漏
        process.removeListener("SIGINT", handleInterrupt);
      }
    },

    // runAgent：运行 Agent 模式
    runAgent: async (prompt, onText) => {
      const controller = new AbortController();
      const handleInterrupt = (): void => controller.abort();
      process.once("SIGINT", handleInterrupt);
      try {
        // 加载配置
        const config = await loadConfig();
        // Agent 模式仅支持 openai-chat-completions 协议
        if (config.provider.protocol !== "openai-chat-completions") {
          throw new ConfigError("CONFIG_INVALID", "Agent mode is unavailable", [
            {
              path: "provider.protocol",
              message: "Agent mode requires openai-chat-completions",
            },
          ]);
        }
        // 创建工具注册表，并注册只读工作区工具
        const registry = new ToolRegistry(
          await createWorkspaceTools({ workspaceRoot: process.cwd() }),
        );
        // 解析 Agent 最大步数（从环境变量或默认值）
        const maxSteps = resolveAgentMaxSteps();
        // 调用核心 runAgent 函数
        return await runAgent(
          {
            messages: [{ role: "user", content: prompt }], // 构建消息列表（以用户消息开始）
            maxSteps, // 最大步数限制
            tools: registry.listModelDefinitions(), // 获取工具的模型定义列表
          },
          {
            provider: createModelProvider(config.provider), // 模型提供者
            toolExecutor: registry, // 工具执行器（就是注册表本身）
            onText, // 文本增量回调
          },
          { signal: controller.signal }, // 取消信号
        );
      } finally {
        process.removeListener("SIGINT", handleInterrupt);
      }
    },

    // isInteractiveTerminal：检测是否为交互式终端（stdin 和 stdout 都是 TTY）
    isInteractiveTerminal: () =>
      process.stdin.isTTY === true && process.stdout.isTTY === true,

    // runInteractive：启动交互式终端模式
    runInteractive: async () => {
      // 加载配置
      const config = await loadConfig();
      // 交互模式同样仅支持 openai-chat-completions 协议
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
      // 创建工具注册表
      const registry = new ToolRegistry(
        await createWorkspaceTools({ workspaceRoot: process.cwd() }),
      );
      // 创建模型提供者（复用，整个会话期间不重建）
      const provider = createModelProvider(config.provider);
      const maxSteps = resolveAgentMaxSteps();
      let currentTheme = getInteractiveTheme(config.ui?.theme);
      let themeRevision = 0;
      // 启动交互终端
      await runInteractiveTerminal({
        input: process.stdin, // 标准输入流
        output: process.stdout, // 标准输出流
        // color：如果未设置 NO_COLOR 环境变量，则启用颜色
        color: process.env.NO_COLOR === undefined,

        // theme：返回当前会话正在展示的主题，确保每次 redraw 都读取最新值
        theme: () => currentTheme,

        // setTheme：先同步更新内存主题实现实时预览，再原子持久化到配置文件
        setTheme: (name) => {
          const previousTheme = currentTheme;
          const revision = ++themeRevision;
          currentTheme = getInteractiveTheme(name);
          return writeThemeAtomically(resolveConfigPath(), name).catch(
            (error: unknown) => {
              // 旧请求失败时不能覆盖更新的主题预览
              if (revision === themeRevision) currentTheme = previousTheme;
              throw error;
            },
          );
        },

        // sessionInfo：固定投影到对话框底部，避免用户必须输入 /status 才能看到关键上下文
        sessionInfo: (runtime) => ({
          model: config.provider.model,
          cwd: process.cwd(),
          protocol: config.provider.protocol,
          theme: currentTheme.name,
          turns: runtime.turns,
          enabledToolCount: runtime.enabledToolCount,
          totalToolCount: runtime.totalToolCount,
        }),

        // status 回调：生成交互终端的状态面板文本
        status: (runtime) => {
          const usage = runtime.usage;
          // 格式化 Token 用量文本
          const tokenText =
            usage === undefined
              ? "n/a（Provider 未返回 usage）"
              : `${usage.inputTokens} / ${usage.outputTokens} / ${usage.totalTokens}`;
          // 返回多行状态文本，用换行符连接
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

        maxSteps, // Agent 最大步数

        // tools 回调：返回工具列表（含交互式描述）
        tools: () =>
          registry.listToolStatuses().map((tool) => ({
            ...tool, // 展开原始工具状态
            description: interactiveToolDescription(
              // 替换为交互式描述
              tool.name,
              tool.description,
            ),
          })),

        // toggleTool 回调：切换工具的启用/禁用状态
        toggleTool: (name) => {
          // 按名称查找工具
          const tool = registry
            .listToolStatuses()
            .find((candidate) => candidate.name === name);
          // 如果找到，翻转其启用状态
          if (tool !== undefined) registry.setEnabled(name, !tool.enabled);
        },

        // runTurn 回调：执行一轮 Agent 交互
        runTurn: (messages, handlers, signal) =>
          runAgent(
            {
              messages, // 当前消息历史
              maxSteps, // 最大步数
              tools: registry.listModelDefinitions(), // 工具定义列表
            },
            {
              provider, // 模型提供者
              toolExecutor: registry, // 工具执行器
              onText: handlers.onText, // 文本增量回调
              onToolCall: handlers.onToolCall, // 工具调用事件回调
            },
            { signal }, // 取消信号
          ),
      });
    },

    // writeStdout：向标准输出写入文本
    writeStdout: (text) => process.stdout.write(text),

    // writeStderr：向标准错误输出写入文本
    writeStderr: (text) => process.stderr.write(text),
  });
} catch {
  // 最外层的兜底异常处理：如果 runCli 本身抛了未捕获错误
  process.stderr.write("Error: Unable to initialize KFC.\n");
  process.exitCode = 1; // 退出码 1 表示通用错误
}
