import { parseArgs } from "node:util";

export type CliCommand =
  | { type: "help" }
  | { type: "version" }
  | { type: "doctor" }
  | { type: "quickstart" }
  | { type: "ask"; prompt: string }
  | { type: "agent"; prompt: string }
  | { type: "error"; message: string };

function normalizeParseError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to parse command-line arguments";
  }

  const unknownOption = error.message.match(/Unknown option ['"]([^'"]+)['"]/i);
  if (unknownOption?.[1]) {
    return `Unknown option: ${unknownOption[1]}`;
  }

  return error.message.replace(/^TypeError \[[^\]]+\]:\s*/, "");
}

export function parseCliArgs(args: readonly string[]): CliCommand {
  try {
    const { values, positionals } = parseArgs({
      args: [...args],
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        quickstart: { type: "boolean" },
        qs: { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    });

    if (values.help) return { type: "help" };
    if (values.version) return { type: "version" };
    if (values.quickstart || values.qs) {
      if (positionals.length > 0) {
        return {
          type: "error",
          message: `Unexpected argument: ${positionals[0]}`,
        };
      }
      return { type: "quickstart" };
    }
    if (positionals.length === 0) return { type: "help" };
    if (positionals.length === 1 && positionals[0] === "doctor") {
      return { type: "doctor" };
    }
    if (positionals[0] === "ask" || positionals[0] === "agent") {
      const prompt = positionals.slice(1).join(" ");
      if (prompt.trim() === "") {
        return {
          type: "error",
          message: `${positionals[0] === "ask" ? "Ask" : "Agent"} prompt is required`,
        };
      }
      return { type: positionals[0], prompt };
    }
    return {
      type: "error",
      message: `Unexpected argument: ${positionals[0]}`,
    };
  } catch (error) {
    return { type: "error", message: normalizeParseError(error) };
  }
}
