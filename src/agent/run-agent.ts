import { ProviderError } from "../errors/provider-error.js";
import { UserInterruptedError } from "../errors/user-interrupted-error.js";
import type {
  ModelFinishReason,
  ModelMessage,
  ModelProvider,
  ModelStreamOptions,
  ModelToolDefinition,
  ModelTokenUsage,
  ModelToolCall,
} from "../provider/model-provider.js";
import { AgentError } from "./agent-error.js";

export { DEFAULT_AGENT_MAX_STEPS } from "../config/runtime-settings.js";

export interface AgentToolResult {
  readonly toolCallId: string;
  readonly content: string;
  readonly isError: boolean;
}

export interface AgentToolExecutor {
  execute(
    toolCall: ModelToolCall,
    options?: ModelStreamOptions,
  ): Promise<AgentToolResult>;
}

export type AgentToolAuthorizationDecision = boolean | "explain";

export interface AgentRunRequest {
  readonly messages: readonly ModelMessage[];
  readonly maxSteps: number;
  readonly tools?: readonly ModelToolDefinition[];
}

export interface AgentRunResult {
  readonly messages: readonly ModelMessage[];
  readonly steps: number;
  readonly finalText: string;
  readonly finishReason: Exclude<ModelFinishReason, "tool-call">;
  readonly usage?: ModelTokenUsage;
}

export interface AgentRunDependencies {
  readonly provider: ModelProvider;
  readonly toolExecutor: AgentToolExecutor;
  readonly onText?: (delta: string) => void;
  readonly onToolCall?: (toolCall: ModelToolCall) => void;
  /**
   * Optional authorization boundary for interactive callers. Returning false
   * must not execute the tool; the denial is fed back to the model as a
   * structured Tool Result so the loop remains deterministic. `"explain"`
   * requests that the model explain the action without executing it.
   */
  readonly authorizeToolCall?: (
    toolCall: ModelToolCall,
  ) => Promise<AgentToolAuthorizationDecision>;
  readonly onToolResult?: (event: AgentToolResultEvent) => void;
}

export interface AgentToolResultEvent {
  readonly toolCall: ModelToolCall;
  readonly result: AgentToolResult;
  readonly durationMs: number;
}

interface ModelTurn {
  readonly text: string;
  readonly toolCalls: readonly ModelToolCall[];
  readonly finishReason: ModelFinishReason;
  readonly usage?: ModelTokenUsage;
}

function invalidProviderResponse(): ProviderError {
  return new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Provider returned an invalid agent turn",
  );
}

function isValidUsage(usage: ModelTokenUsage): boolean {
  return (
    Number.isInteger(usage.inputTokens) &&
    usage.inputTokens >= 0 &&
    Number.isInteger(usage.outputTokens) &&
    usage.outputTokens >= 0 &&
    Number.isInteger(usage.totalTokens) &&
    usage.totalTokens === usage.inputTokens + usage.outputTokens
  );
}

function isValidToolCall(toolCall: ModelToolCall): boolean {
  return (
    typeof toolCall.id === "string" &&
    toolCall.id.trim() !== "" &&
    typeof toolCall.name === "string" &&
    toolCall.name.trim() !== ""
  );
}

async function collectModelTurn(
  provider: ModelProvider,
  messages: readonly ModelMessage[],
  tools: readonly ModelToolDefinition[] | undefined,
  options: ModelStreamOptions,
  onText: ((delta: string) => void) | undefined,
  onToolCall: ((toolCall: ModelToolCall) => void) | undefined,
): Promise<ModelTurn> {
  let started = false;
  let usageSeen = false;
  let usage: ModelTokenUsage | undefined;
  let finishReason: ModelFinishReason | undefined;
  let text = "";
  const toolCalls: ModelToolCall[] = [];

  for await (const event of provider.stream(
    {
      messages: [...messages],
      ...(tools === undefined ? {} : { tools }),
    },
    options,
  )) {
    if (finishReason !== undefined) throw invalidProviderResponse();

    if (event.type === "start") {
      if (started) throw invalidProviderResponse();
      started = true;
      continue;
    }
    if (!started) throw invalidProviderResponse();

    if (event.type === "text-delta") {
      text += event.delta;
      onText?.(event.delta);
    } else if (event.type === "tool-call") {
      toolCalls.push(event.toolCall);
      onToolCall?.(event.toolCall);
    } else if (event.type === "usage") {
      if (usageSeen || !isValidUsage(event.usage)) {
        throw invalidProviderResponse();
      }
      usageSeen = true;
      usage = event.usage;
    } else if (event.type === "finish") {
      finishReason = event.reason;
    } else {
      throw invalidProviderResponse();
    }
  }

  if (!started || finishReason === undefined) throw invalidProviderResponse();
  if (toolCalls.length > 0 !== (finishReason === "tool-call")) {
    throw invalidProviderResponse();
  }
  return {
    text,
    toolCalls,
    finishReason,
    ...(usage === undefined ? {} : { usage }),
  };
}

function addUsage(
  current: ModelTokenUsage | undefined,
  next: ModelTokenUsage | undefined,
): ModelTokenUsage | undefined {
  if (next === undefined) return current;
  if (current === undefined) return next;
  return {
    inputTokens: current.inputTokens + next.inputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new UserInterruptedError();
}

function deniedToolResult(toolCall: ModelToolCall): AgentToolResult {
  return {
    toolCallId: toolCall.id,
    content: JSON.stringify({
      error: {
        code: "TOOL_CALL_DENIED",
        tool: toolCall.name.slice(0, 128),
      },
    }),
    isError: true,
  };
}

function explanationRequestedToolResult(
  toolCall: ModelToolCall,
): AgentToolResult {
  return {
    toolCallId: toolCall.id,
    content: JSON.stringify({
      error: {
        code: "TOOL_CALL_EXPLANATION_REQUESTED",
        tool: toolCall.name.slice(0, 128),
      },
    }),
    isError: true,
  };
}

export async function runAgent(
  request: AgentRunRequest,
  dependencies: AgentRunDependencies,
  options: ModelStreamOptions = {},
): Promise<AgentRunResult> {
  if (!Number.isInteger(request.maxSteps) || request.maxSteps < 1) {
    throw new AgentError(
      "AGENT_INVALID_OPTIONS",
      "Agent maxSteps must be a positive integer",
    );
  }
  throwIfAborted(options.signal);

  const messages: ModelMessage[] = [...request.messages];
  let totalUsage: ModelTokenUsage | undefined;
  const seenToolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant" || message.toolCalls === undefined) {
      continue;
    }
    for (const toolCall of message.toolCalls) {
      if (!isValidToolCall(toolCall)) {
        throw new AgentError(
          "AGENT_INVALID_OPTIONS",
          "Initial messages contain an invalid Tool Call",
        );
      }
      if (seenToolCallIds.has(toolCall.id)) {
        throw new AgentError(
          "AGENT_INVALID_OPTIONS",
          "Initial messages contain duplicate Tool Call IDs",
        );
      }
      seenToolCallIds.add(toolCall.id);
    }
  }
  for (let step = 1; step <= request.maxSteps; step += 1) {
    throwIfAborted(options.signal);
    const turn = await collectModelTurn(
      dependencies.provider,
      messages,
      request.tools,
      options,
      dependencies.onText,
      dependencies.onToolCall,
    );
    totalUsage = addUsage(totalUsage, turn.usage);
    throwIfAborted(options.signal);
    if (turn.toolCalls.length > 0) {
      for (const toolCall of turn.toolCalls) {
        if (!isValidToolCall(toolCall) || seenToolCallIds.has(toolCall.id)) {
          throw invalidProviderResponse();
        }
        seenToolCallIds.add(toolCall.id);
      }
      messages.push({
        role: "assistant",
        content: turn.text,
        toolCalls: [...turn.toolCalls],
      });
      if (step === request.maxSteps) {
        throw new AgentError(
          "AGENT_MAX_STEPS_EXCEEDED",
          "Agent exceeded the maximum number of model steps",
        );
      }

      for (const toolCall of turn.toolCalls) {
        throwIfAborted(options.signal);
        const startedAt = Date.now();
        const authorized =
          dependencies.authorizeToolCall === undefined
            ? true
            : await dependencies.authorizeToolCall(toolCall);
        throwIfAborted(options.signal);
        const result =
          authorized === true
            ? await dependencies.toolExecutor.execute(toolCall, options)
            : authorized === "explain"
              ? explanationRequestedToolResult(toolCall)
              : deniedToolResult(toolCall);
        throwIfAborted(options.signal);
        if (result.toolCallId !== toolCall.id) {
          throw new AgentError(
            "AGENT_INVALID_TOOL_RESULT",
            "Tool result does not match the requested Tool Call",
          );
        }
        dependencies.onToolResult?.({
          toolCall,
          result,
          durationMs: Math.max(0, Date.now() - startedAt),
        });
        messages.push({
          role: "tool",
          toolCallId: result.toolCallId,
          content: result.content,
          isError: result.isError,
        });
      }
      continue;
    }

    const finishReason = turn.finishReason as Exclude<
      ModelFinishReason,
      "tool-call"
    >;
    messages.push({ role: "assistant", content: turn.text });
    return {
      messages,
      steps: step,
      finalText: turn.text,
      finishReason,
      ...(totalUsage === undefined ? {} : { usage: totalUsage }),
    };
  }

  throw new AgentError(
    "AGENT_MAX_STEPS_EXCEEDED",
    "Agent exceeded the maximum number of model steps",
  );
}
