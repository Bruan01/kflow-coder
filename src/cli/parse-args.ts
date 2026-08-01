// 导入 Node.js 内置的命令行参数解析工具
import { parseArgs } from "node:util";

// CliCommand 是 CLI 解析结果的联合类型，每个分支代表一种用户意图
export type CliCommand =
  | { type: "help" } // 显示帮助
  | { type: "version" } // 显示版本号
  | { type: "doctor" } // 运行诊断
  | { type: "quickstart" } // 运行快速入门向导
  | { type: "ask"; prompt: string } // 单次提问（含提问内容）
  | { type: "agent"; prompt: string } // Agent 模式（含提问内容）
  | { type: "error"; message: string }; // 解析错误（含错误消息）

// normalizeParseError：将 Node.js parseArgs 抛出的原始错误转为用户友好的消息
function normalizeParseError(error: unknown): string {
  // 如果不是 Error 实例，返回通用错误消息
  if (!(error instanceof Error)) {
    return "Unable to parse command-line arguments";
  }

  // 尝试从错误消息中提取未知选项名称（如 "Unknown option '--foo'"）
  const unknownOption = error.message.match(/Unknown option ['"]([^'"]+)['"]/i);
  if (unknownOption?.[1]) {
    return `Unknown option: ${unknownOption[1]}`;
  }

  // 移除 TypeError 前缀，只保留有意义的错误内容
  return error.message.replace(/^TypeError \[[^\]]+\]:\s*/, "");
}

// parseCliArgs：解析命令行参数，返回结构化的 CliCommand 对象
export function parseCliArgs(args: readonly string[]): CliCommand {
  try {
    // 使用 Node.js 内置 parseArgs 进行解析
    const { values, positionals } = parseArgs({
      args: [...args], // 展开为可变数组以适配 parseArgs API
      options: {
        help: { type: "boolean", short: "h" }, // --help / -h（布尔型）
        version: { type: "boolean", short: "v" }, // --version / -v（布尔型）
        quickstart: { type: "boolean" }, // --quickstart（布尔型）
        qs: { type: "boolean" }, // --qs（--quickstart 的别名）
      },
      allowPositionals: true, // 允许位置参数（如 "ask hello" 中的 "hello"）
      strict: true, // 严格模式：遇到未知选项时抛出错误
    });

    // 优先级1：如果设置了 --help，返回 help 命令
    if (values.help) return { type: "help" };
    // 优先级2：如果设置了 --version，返回 version 命令
    if (values.version) return { type: "version" };
    // 优先级3：如果设置了 --quickstart 或 --qs
    if (values.quickstart || values.qs) {
      // quickstart 不接受额外的位置参数
      if (positionals.length > 0) {
        return {
          type: "error",
          message: `Unexpected argument: ${positionals[0]}`,
        };
      }
      return { type: "quickstart" };
    }
    // 优先级4：没有位置参数时默认显示帮助
    if (positionals.length === 0) return { type: "help" };
    // 优先级5：位置参数为 "doctor" 时运行诊断
    if (positionals.length === 1 && positionals[0] === "doctor") {
      return { type: "doctor" };
    }
    // 优先级6：位置参数以 "ask" 或 "agent" 开头
    if (positionals[0] === "ask" || positionals[0] === "agent") {
      // 将剩余的位置参数用空格拼接为 prompt
      const prompt = positionals.slice(1).join(" ");
      // prompt 不能为空
      if (prompt.trim() === "") {
        return {
          type: "error",
          message: `${positionals[0] === "ask" ? "Ask" : "Agent"} prompt is required`,
        };
      }
      // 返回 ask 或 agent 命令（type 直接使用 positionals[0] 的值）
      return { type: positionals[0], prompt };
    }
    // 优先级7：无法识别的参数，返回错误
    return {
      type: "error",
      message: `Unexpected argument: ${positionals[0]}`,
    };
  } catch (error) {
    // 捕获 parseArgs 的解析异常，转为统一错误命令
    return { type: "error", message: normalizeParseError(error) };
  }
}
