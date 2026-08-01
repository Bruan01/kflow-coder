import { sanitizeTerminalText } from "./sanitize-terminal-text.js";

const DETAIL_LIMIT = 96;

function recordValue(
  input: unknown,
  key: string,
): string | number | boolean | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : undefined;
}

function compact(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = sanitizeTerminalText(String(value)).replace(/\s+/g, " ").trim();
  if (text === "") return undefined;
  return text.length > DETAIL_LIMIT
    ? `${text.slice(0, DETAIL_LIMIT - 1)}…`
    : text;
}

function redactShellSecrets(command: string): string {
  return command.replace(
    /((?:--?)?(?:api[-_]?key|token|password|secret|authorization)\s*(?:=|:|\s+)\s*)([^\s]+)/gi,
    "$1[redacted]",
  );
}

function pathDetail(input: unknown, label: string): string | undefined {
  const path = compact(recordValue(input, "path")) ?? ".";
  return `${label}: ${path}`;
}

export function describeToolCall(
  name: string,
  input: unknown,
): string | undefined {
  switch (name) {
    case "list_directory":
      return pathDetail(input, "目录");
    case "find_files": {
      const pattern = compact(recordValue(input, "pattern"));
      const path = compact(recordValue(input, "path"));
      if (pattern === undefined && path === undefined) return undefined;
      return [
        pattern === undefined ? undefined : `匹配: ${pattern}`,
        path === undefined ? undefined : `目录: ${path}`,
      ]
        .filter((part): part is string => part !== undefined)
        .join(" · ");
    }
    case "read_file":
      return pathDetail(input, "文件");
    case "git_diff":
      return pathDetail(input, "范围");
    case "grep": {
      const query = compact(recordValue(input, "query"));
      const path = compact(recordValue(input, "path")) ?? ".";
      if (query === undefined) return `目录: ${path}`;
      return `搜索: ${query} · 位置: ${path}`;
    }
    case "apply_patch":
      return pathDetail(input, "文件");
    case "write_file":
      return pathDetail(input, "文件");
    case "shell": {
      const command = compact(recordValue(input, "command"));
      const cwd = compact(recordValue(input, "cwd"));
      if (command === undefined && cwd === undefined) return undefined;
      return [
        command === undefined
          ? undefined
          : `命令: ${redactShellSecrets(command)}`,
        cwd === undefined ? undefined : `目录: ${cwd}`,
      ]
        .filter((part): part is string => part !== undefined)
        .join(" · ");
    }
    default:
      return undefined;
  }
}
