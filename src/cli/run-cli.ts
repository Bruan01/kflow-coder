// 导入各模块返回的报告类型（仅类型导入，编译后不产生 JS 代码）
import type { AskReport } from "../ask/run-ask.js";
import type { AgentRunResult } from "../agent/run-agent.js";
import type { DoctorReport } from "../doctor/doctor.js";
// 导入医生报告的格式化函数
import { formatDoctorReport } from "../doctor/doctor.js";
// 导入错误格式化函数
import { formatErrorForCli } from "../errors/error-presentation.js";
// 导入快速入门向导的结果类型
import type { QuickstartResult } from "../quickstart/quickstart.js";
// 导入帮助文本生成函数
import { createHelpText } from "./help.js";
// 导入命令行参数解析函数
import { parseCliArgs } from "./parse-args.js";

// CliEnvironment 接口：定义了 CLI 运行所需的所有依赖（依赖注入模式）
export interface CliEnvironment {
  version: string; // 当前 KFC 版本号
  runDoctor(): Promise<DoctorReport>; // 运行诊断
  runQuickstart(): Promise<QuickstartResult>; // 运行快速入门向导
  // 运行 ask 模式：传入 prompt 和文本增量回调
  runAsk(prompt: string, onText: (delta: string) => void): Promise<AskReport>;
  // 运行 agent 模式：传入 prompt 和文本增量回调
  runAgent(
    prompt: string,
    onText: (delta: string) => void,
  ): Promise<AgentRunResult>;
  isInteractiveTerminal(): boolean; // 检测是否为交互式终端（TTY）
  runInteractive(): Promise<void>; // 启动交互式终端模式
  writeStdout(text: string): void; // 写入标准输出
  writeStderr(text: string): void; // 写入标准错误输出
}

// formatMilliseconds：将毫秒数格式化为 "Nms" 字符串，null 时返回 "n/a"
function formatMilliseconds(value: number | null): string {
  // Math.max(0, ...) 确保不会出现负值，Math.round 四舍五入
  return value === null ? "n/a" : `${Math.max(0, Math.round(value))}ms`;
}

// formatAskReport：格式化 ask 模式的统计报告（输出到 stderr）
function formatAskReport(report: AskReport): string {
  // 格式化 Token 用量：输入/输出/总计，或 "n/a"
  const tokens =
    report.usage === undefined
      ? "n/a"
      : `${report.usage.inputTokens}/${report.usage.outputTokens}/${report.usage.totalTokens}`;
  // 拼接报告字符串：[kfc] finish=... ttft=... total=... tokens=...
  return (
    `[kfc] finish=${report.finishReason}` +
    ` ttft=${formatMilliseconds(report.timeToFirstTokenMs)}` +
    ` total=${formatMilliseconds(report.totalDurationMs)}` +
    ` tokens=${tokens}\n`
  );
}

function formatAgentReport(result: AgentRunResult): string {
  const metrics = result.metrics;
  if (metrics === undefined) {
    return `[kfc] agent steps=${result.steps} finish=${result.finishReason}\n`;
  }
  const tokens =
    metrics.usage === undefined
      ? "n/a"
      : `${metrics.usage.inputTokens}/${metrics.usage.outputTokens}/${metrics.usage.totalTokens}`;
  return (
    `[kfc] agent steps=${result.steps}` +
    ` turns=${metrics.modelTurns}` +
    ` tools=${metrics.toolCalls}` +
    ` failed_tools=${metrics.failedToolCalls}` +
    ` finish=${result.finishReason}` +
    ` ttft=${formatMilliseconds(metrics.timeToFirstTextMs)}` +
    ` total=${formatMilliseconds(metrics.durationMs)}` +
    ` tokens=${tokens}\n`
  );
}

// runCli：CLI 主入口函数，接收命令行参数和环境依赖，返回退出码
export async function runCli(
  args: readonly string[], // 命令行参数（不含 node 和脚本名）
  environment: CliEnvironment, // 注入的环境依赖
): Promise<number> {
  // 如果没有参数且是交互式终端，进入交互模式
  if (args.length === 0 && environment.isInteractiveTerminal()) {
    try {
      await environment.runInteractive(); // 启动交互式终端
      return 0; // 正常退出
    } catch (error) {
      // 异常时格式化错误并写到 stderr
      const presentation = formatErrorForCli(error);
      environment.writeStderr(presentation.text);
      return presentation.exitCode;
    }
  }
  // 解析命令行参数为结构化命令
  const command = parseCliArgs(args);

  // 根据命令类型分发处理
  switch (command.type) {
    case "help":
      // 输出帮助文本到 stdout
      environment.writeStdout(createHelpText());
      return 0;
    case "version":
      // 输出版本号到 stdout
      environment.writeStdout(`${environment.version}\n`);
      return 0;
    case "doctor":
      try {
        // 运行诊断，格式化并输出报告
        const report = await environment.runDoctor();
        environment.writeStdout(formatDoctorReport(report));
        return report.exitCode;
      } catch (error) {
        // 错误时格式化并输出到 stderr
        const presentation = formatErrorForCli(error);
        environment.writeStderr(presentation.text);
        return presentation.exitCode;
      }
    case "quickstart":
      try {
        // 运行快速入门向导
        const result = await environment.runQuickstart();
        // 根据退出码选择输出目标：成功用 stdout，失败用 stderr
        const write =
          result.exitCode === 0
            ? environment.writeStdout
            : environment.writeStderr;
        write(result.text);
        return result.exitCode;
      } catch (error) {
        const presentation = formatErrorForCli(error);
        environment.writeStderr(presentation.text);
        return presentation.exitCode;
      }
    case "ask":
      try {
        // 运行 ask 模式：将每个文本增量直接写到 stdout
        const report = await environment.runAsk(command.prompt, (delta) =>
          environment.writeStdout(delta),
        );
        // 如果最终响应不是以换行符结尾，补一个换行
        if (!report.endedWithNewline) environment.writeStdout("\n");
        // 将统计信息写入 stderr（与正文输出分离）
        environment.writeStderr(formatAskReport(report));
        return 0;
      } catch (error) {
        const presentation = formatErrorForCli(error);
        environment.writeStderr(presentation.text);
        return presentation.exitCode;
      }
    case "agent":
      try {
        // 追踪最终输出是否以换行结尾
        let endedWithNewline = false;
        // 运行 agent 模式
        const result = await environment.runAgent(command.prompt, (delta) => {
          // 每次增量更新时检查是否以换行结尾
          endedWithNewline = delta.endsWith("\n");
          environment.writeStdout(delta);
        });
        // 如果最终文本不为空且没以换行结尾，补换行
        if (!endedWithNewline && result.finalText !== "") {
          environment.writeStdout("\n");
        }
        // 将 agent 统计信息写入 stderr
        environment.writeStderr(formatAgentReport(result));
        return 0;
      } catch (error) {
        const presentation = formatErrorForCli(error);
        environment.writeStderr(presentation.text);
        return presentation.exitCode;
      }
    case "error":
      // 解析错误：输出错误消息和使用提示
      environment.writeStderr(
        `Error: ${command.message}\nRun 'kfc --help' for usage.\n`,
      );
      return 1;
  }
}
