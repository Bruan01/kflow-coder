import type { AgentToolResult } from "../agent/run-agent.js";

interface JsonRecord {
  readonly [key: string]: unknown;
}

function parseRecord(content: string): JsonRecord | undefined {
  try {
    const value: unknown = JSON.parse(content);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as JsonRecord)
      : undefined;
  } catch {
    return undefined;
  }
}

function recordValue(record: JsonRecord | undefined, key: string): unknown {
  return record?.[key];
}

function integerValue(
  record: JsonRecord | undefined,
  key: string,
): number | undefined {
  const value = recordValue(record, key);
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function arrayLength(
  record: JsonRecord | undefined,
  key: string,
): number | undefined {
  const value = recordValue(record, key);
  return Array.isArray(value) ? value.length : undefined;
}

function wasTruncated(record: JsonRecord | undefined): boolean {
  return recordValue(record, "truncated") === true;
}

function durationText(durationMs: number): string {
  return `${Math.max(0, Math.round(durationMs))}ms`;
}

function successSummary(name: string, record: JsonRecord | undefined): string {
  const suffix = wasTruncated(record) ? " · 结果已截断" : "";
  switch (name) {
    case "read_file": {
      const lines = arrayLength(record, "lines");
      return `${lines === undefined ? "读取完成" : `读取 ${lines} 行`}${suffix}`;
    }
    case "list_directory": {
      const entries = arrayLength(record, "entries");
      return `${entries === undefined ? "列出完成" : `列出 ${entries} 项`}${suffix}`;
    }
    case "find_files": {
      const files = arrayLength(record, "files");
      return `${files === undefined ? "搜索完成" : `找到 ${files} 个文件`}${suffix}`;
    }
    case "grep": {
      const matches = arrayLength(record, "matches");
      return `${matches === undefined ? "搜索完成" : `命中 ${matches} 条`}${suffix}`;
    }
    case "apply_patch": {
      const replacements = integerValue(record, "replacements");
      const bytes = integerValue(record, "bytesWritten");
      return [
        replacements === undefined ? "修改完成" : `替换 ${replacements} 处`,
        bytes === undefined ? undefined : `写入 ${bytes} 字节`,
      ]
        .filter((part): part is string => part !== undefined)
        .join(" · ");
    }
    case "write_file": {
      const bytes = integerValue(record, "bytesWritten");
      return bytes === undefined ? "创建完成" : `写入 ${bytes} 字节`;
    }
    case "shell": {
      const exitCode = recordValue(record, "exitCode");
      const timedOut = recordValue(record, "timedOut") === true;
      const outputTruncated = recordValue(record, "truncated") === true;
      return [
        `exit ${typeof exitCode === "number" ? exitCode : "?"}`,
        timedOut ? "已超时" : undefined,
        outputTruncated ? "输出已截断" : undefined,
      ]
        .filter((part): part is string => part !== undefined)
        .join(" · ");
    }
    default:
      return "完成";
  }
}

function errorSummary(record: JsonRecord | undefined): string {
  const error = recordValue(record, "error");
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return "执行失败";
  }
  const code = (error as JsonRecord).code;
  return typeof code === "string" && code !== "" ? `失败: ${code}` : "执行失败";
}

export function summarizeToolResult(
  name: string,
  result: AgentToolResult,
  durationMs: number,
): string {
  const record = parseRecord(result.content);
  const summary = result.isError
    ? errorSummary(record)
    : successSummary(name, record);
  return `${summary} · ${durationText(durationMs)}`;
}
