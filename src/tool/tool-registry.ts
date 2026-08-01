import type { AgentToolExecutor, AgentToolResult } from "../agent/run-agent.js";
import { UserInterruptedError } from "../errors/user-interrupted-error.js";
import type {
  ModelToolCall,
  ModelToolDefinition,
} from "../provider/model-provider.js";
import type {
  ToolDefinition,
  ToolExecutionOptions,
  ToolExecutionOutput,
} from "./define-tool.js";
import { ToolRegistryError } from "./tool-registry-error.js";

export interface ToolMetadata {
  readonly name: string;
  readonly description: string;
}

export interface ToolStatus extends ToolMetadata {
  readonly enabled: boolean;
}

function isValidDefinition(tool: unknown): tool is ToolDefinition {
  if (typeof tool !== "object" || tool === null) return false;
  const candidate = tool as Readonly<Record<string, unknown>>;
  const inputSchema = candidate.inputSchema;
  return (
    typeof candidate.name === "string" &&
    candidate.name !== "" &&
    candidate.name === candidate.name.trim() &&
    typeof candidate.description === "string" &&
    candidate.description !== "" &&
    candidate.description === candidate.description.trim() &&
    (candidate.parameters === undefined ||
      (typeof candidate.parameters === "object" &&
        candidate.parameters !== null &&
        !Array.isArray(candidate.parameters))) &&
    typeof inputSchema === "object" &&
    inputSchema !== null &&
    "safeParseAsync" in inputSchema &&
    typeof inputSchema.safeParseAsync === "function" &&
    typeof candidate.execute === "function"
  );
}

type ToolResultErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_DISABLED"
  | "TOOL_INPUT_INVALID"
  | "TOOL_EXECUTION_FAILED";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new UserInterruptedError();
}

function issuePaths(
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): readonly string[] {
  return [
    ...new Set(
      issues.map((issue) =>
        issue.path.length === 0 ? "$" : issue.path.map(String).join("."),
      ),
    ),
  ];
}

function errorResult(
  toolCall: ModelToolCall,
  code: ToolResultErrorCode,
  paths?: readonly string[],
): AgentToolResult {
  return {
    toolCallId: toolCall.id,
    content: JSON.stringify({
      error: {
        code,
        tool: toolCall.name.slice(0, 128),
        ...(paths === undefined ? {} : { paths }),
      },
    }),
    isError: true,
  };
}

function isValidOutput(output: ToolExecutionOutput): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    typeof output.content === "string" &&
    typeof output.isError === "boolean"
  );
}

export class ToolRegistry implements AgentToolExecutor {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly enabledTools = new Set<string>();

  constructor(tools: readonly ToolDefinition[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: ToolDefinition): void {
    if (!isValidDefinition(tool)) {
      throw new ToolRegistryError(
        "TOOL_DEFINITION_INVALID",
        "Tool definition is invalid",
      );
    }
    if (this.tools.has(tool.name)) {
      throw new ToolRegistryError(
        "TOOL_NAME_DUPLICATE",
        "Tool name is already registered",
      );
    }
    this.tools.set(tool.name, tool);
    this.enabledTools.add(tool.name);
  }

  list(): readonly ToolMetadata[] {
    return [...this.tools.values()].map(({ name, description }) => ({
      name,
      description,
    }));
  }

  listToolStatuses(): readonly ToolStatus[] {
    return [...this.tools.values()].map(({ name, description }) => ({
      name,
      description,
      enabled: this.enabledTools.has(name),
    }));
  }

  setEnabled(name: string, enabled: boolean): boolean {
    if (!this.tools.has(name)) return false;
    if (enabled) this.enabledTools.add(name);
    else this.enabledTools.delete(name);
    return true;
  }

  listModelDefinitions(): readonly ModelToolDefinition[] {
    return [...this.tools.values()]
      .filter(({ name }) => this.enabledTools.has(name))
      .map(({ name, description, parameters }) => ({
        name,
        description,
        parameters: parameters ?? { type: "object", properties: {} },
      }));
  }

  async execute(
    toolCall: ModelToolCall,
    options: ToolExecutionOptions = {},
  ): Promise<AgentToolResult> {
    throwIfAborted(options.signal);
    const tool = this.tools.get(toolCall.name);
    if (tool === undefined) {
      return errorResult(toolCall, "TOOL_NOT_FOUND");
    }
    if (!this.enabledTools.has(toolCall.name)) {
      return errorResult(toolCall, "TOOL_DISABLED");
    }

    try {
      const parsed = await tool.inputSchema.safeParseAsync(toolCall.input);
      throwIfAborted(options.signal);
      if (!parsed.success) {
        return errorResult(
          toolCall,
          "TOOL_INPUT_INVALID",
          issuePaths(parsed.error.issues),
        );
      }

      const output = await tool.execute(parsed.data, options);
      throwIfAborted(options.signal);
      if (!isValidOutput(output)) {
        return errorResult(toolCall, "TOOL_EXECUTION_FAILED");
      }
      return {
        toolCallId: toolCall.id,
        content: output.content,
        isError: output.isError,
      };
    } catch (error) {
      if (error instanceof UserInterruptedError) throw error;
      if (options.signal?.aborted === true) throw new UserInterruptedError();
      return errorResult(toolCall, "TOOL_EXECUTION_FAILED");
    }
  }
}
