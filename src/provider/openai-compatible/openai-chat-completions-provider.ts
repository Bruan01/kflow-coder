import type { ProviderConfig } from "../../config/config.js";
import { ProviderError } from "../../errors/provider-error.js";
import type {
  ModelFinishReason,
  ModelProvider,
  ModelRequest,
  ModelStreamEvent,
  ModelStreamOptions,
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
  return "unknown";
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
            messages: request.messages,
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

      for await (const data of decodeSseData(response.body)) {
        if (data === "[DONE]") {
          if (pendingFinish === undefined) throw invalidResponse();
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
