import type { ProviderConfig } from "../../config/config.js";
import { ProviderError } from "../../errors/provider-error.js";
import type {
  ModelFinishReason,
  ModelMessage,
  ModelProvider,
  ModelRequest,
  ModelStreamEvent,
  ModelStreamOptions,
  ModelToolCall,
  ModelTokenUsage,
} from "../model-provider.js";
import {
  type ChatCompletionChunk,
  chatCompletionChunkSchema,
} from "./chat-completions-schema.js";
import { mapHttpError } from "./error-mapping.js";
import { createProviderRequestLifecycle } from "./request-lifecycle.js";
import { decodeSseData } from "./sse.js";

export interface OpenAiChatCompletionsDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

function invalidResponse(): ProviderError {
  return new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Provider returned an invalid response",
  );
}

function parseChunk(data: string): ChatCompletionChunk {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw invalidResponse();
  }

  const parsed = chatCompletionChunkSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
}

function mapFinishReason(reason: string): ModelFinishReason {
  if (reason === "stop" || reason === "length") return reason;
  if (reason === "content_filter") return "content-filter";
  if (reason === "tool_calls") return "tool-call";
  return "unknown";
}

function encodeMessages(messages: readonly ModelMessage[]): readonly object[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content,
      };
    }
    if (message.role === "assistant" && message.toolCalls !== undefined) {
      return {
        role: "assistant",
        content: message.content,
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.input),
          },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

function appendFragment(current: string, fragment: string | undefined): string {
  return fragment === undefined ? current : `${current}${fragment}`;
}

function collectToolCallFragments(
  pending: Map<number, PendingToolCall>,
  deltas: NonNullable<
    NonNullable<ChatCompletionChunk["choices"][number]>["delta"]["tool_calls"]
  >,
): void {
  const indices = new Set<number>();
  for (const delta of deltas) {
    if (indices.has(delta.index)) throw invalidResponse();
    indices.add(delta.index);
    const current = pending.get(delta.index) ?? {
      id: "",
      name: "",
      arguments: "",
    };
    if (delta.type !== undefined && delta.type !== "function") {
      throw invalidResponse();
    }
    current.id = appendFragment(current.id, delta.id);
    current.name = appendFragment(current.name, delta.function?.name);
    current.arguments = appendFragment(
      current.arguments,
      delta.function?.arguments,
    );
    pending.set(delta.index, current);
  }
}

function completeToolCalls(
  pending: ReadonlyMap<number, PendingToolCall>,
): readonly ModelToolCall[] {
  if (pending.size === 0) throw invalidResponse();
  const ids = new Set<string>();
  return [...pending.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, toolCall]) => {
      if (
        toolCall.id.trim() === "" ||
        toolCall.name.trim() === "" ||
        ids.has(toolCall.id)
      ) {
        throw invalidResponse();
      }
      ids.add(toolCall.id);
      let input: unknown;
      try {
        input = JSON.parse(toolCall.arguments);
      } catch {
        throw invalidResponse();
      }
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw invalidResponse();
      }
      return { id: toolCall.id, name: toolCall.name, input };
    });
}

function mapUsage(
  usage: NonNullable<ChatCompletionChunk["usage"]>,
): ModelTokenUsage {
  if (usage.total_tokens !== usage.prompt_tokens + usage.completion_tokens) {
    throw invalidResponse();
  }
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function isEventStream(response: Response): boolean {
  const contentType = response.headers.get("content-type");
  return (
    contentType?.split(";", 1)[0]?.trim().toLowerCase() === "text/event-stream"
  );
}

export class OpenAiChatCompletionsProvider implements ModelProvider {
  private readonly fetch: typeof globalThis.fetch;

  constructor(
    private readonly config: ProviderConfig,
    dependencies: OpenAiChatCompletionsDependencies = {},
  ) {
    this.fetch = dependencies.fetch ?? globalThis.fetch;
  }

  async *stream(
    request: ModelRequest,
    options: ModelStreamOptions = {},
  ): AsyncIterable<ModelStreamEvent> {
    const lifecycle = createProviderRequestLifecycle(
      options.signal,
      this.config.timeoutMs,
    );

    try {
      const response = await this.fetch(
        `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            accept: "text/event-stream",
            authorization: `Bearer ${this.config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: encodeMessages(request.messages),
            ...(request.tools === undefined || request.tools.length === 0
              ? {}
              : {
                  tools: request.tools.map((tool) => ({
                    type: "function",
                    function: {
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.parameters,
                    },
                  })),
                  tool_choice: "auto",
                }),
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: lifecycle.signal,
        },
      );

      if (!response.ok) throw await mapHttpError(response);
      if (!isEventStream(response) || response.body === null) {
        throw invalidResponse();
      }

      yield { type: "start" };
      let pendingFinish: ModelFinishReason | undefined;
      let usageSeen = false;
      const pendingToolCalls = new Map<number, PendingToolCall>();

      for await (const data of decodeSseData(response.body)) {
        if (data === "[DONE]") {
          if (pendingFinish === undefined) throw invalidResponse();
          if (pendingFinish === "tool-call") {
            for (const toolCall of completeToolCalls(pendingToolCalls)) {
              yield { type: "tool-call", toolCall };
            }
          } else if (pendingToolCalls.size > 0) {
            throw invalidResponse();
          }
          yield { type: "finish", reason: pendingFinish };
          return;
        }

        const chunk = parseChunk(data);
        const indexZeroChoices = chunk.choices.filter(
          (choice) => choice.index === 0,
        );
        if (
          chunk.choices.length > 0 &&
          (indexZeroChoices.length !== 1 || chunk.choices.length !== 1)
        ) {
          throw invalidResponse();
        }

        const choice = indexZeroChoices[0];
        const content = choice?.delta.content;
        if (content !== undefined && content !== null && content !== "") {
          if (pendingFinish !== undefined || usageSeen) {
            throw invalidResponse();
          }
          yield { type: "text-delta", delta: content };
        }

        const toolCalls = choice?.delta.tool_calls;
        if (toolCalls !== undefined) {
          if (pendingFinish !== undefined || usageSeen) throw invalidResponse();
          collectToolCallFragments(pendingToolCalls, toolCalls);
        }

        const finishReason = choice?.finish_reason;
        if (finishReason !== undefined && finishReason !== null) {
          if (pendingFinish !== undefined) throw invalidResponse();
          pendingFinish = mapFinishReason(finishReason);
        }

        if (chunk.usage !== undefined && chunk.usage !== null) {
          if (usageSeen) throw invalidResponse();
          usageSeen = true;
          yield { type: "usage", usage: mapUsage(chunk.usage) };
        }
      }

      throw invalidResponse();
    } catch (error) {
      throw lifecycle.normalizeError(error);
    } finally {
      lifecycle.dispose();
    }
  }
}
