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
import { mapHttpError, mapStreamError } from "./error-mapping.js";
import { createProviderRequestLifecycle } from "./request-lifecycle.js";
import {
  type ResponsesStreamEvent,
  responsesStreamEventSchema,
} from "./responses-schema.js";
import { decodeSseData } from "./sse.js";

export interface OpenAiResponsesDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

function invalidResponse(): ProviderError {
  return new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Provider returned an invalid response",
  );
}

function parseEvent(data: string): ResponsesStreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw invalidResponse();
  }

  const parsed = responsesStreamEventSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
}

function isEventStream(response: Response): boolean {
  const contentType = response.headers.get("content-type");
  return (
    contentType?.split(";", 1)[0]?.trim().toLowerCase() === "text/event-stream"
  );
}

function mapUsage(usage: {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
}): ModelTokenUsage {
  if (usage.total_tokens !== usage.input_tokens + usage.output_tokens) {
    throw invalidResponse();
  }
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}

function mapIncompleteReason(reason: string | undefined): ModelFinishReason {
  if (reason === "max_output_tokens") return "length";
  if (reason === "content_filter") return "content-filter";
  return "unknown";
}

function visiblePosition(
  event: Extract<
    ResponsesStreamEvent,
    {
      type:
        | "response.output_text.delta"
        | "response.output_text.done"
        | "response.refusal.delta"
        | "response.refusal.done";
    }
  >,
): string {
  return [
    event.type.startsWith("response.output_text") ? "output-text" : "refusal",
    event.item_id,
    event.output_index,
    event.content_index,
  ].join("\u0000");
}

export class OpenAiResponsesProvider implements ModelProvider {
  private readonly fetch: typeof globalThis.fetch;

  constructor(
    private readonly config: ProviderConfig,
    dependencies: OpenAiResponsesDependencies = {},
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
        `${this.config.baseUrl.replace(/\/+$/, "")}/responses`,
        {
          method: "POST",
          headers: {
            accept: "text/event-stream",
            authorization: `Bearer ${this.config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            input: request.messages,
            stream: true,
            store: false,
          }),
          signal: lifecycle.signal,
        },
      );

      if (!response.ok) throw await mapHttpError(response);
      if (!isEventStream(response) || response.body === null) {
        throw invalidResponse();
      }

      yield { type: "start" };
      let lastSequenceNumber: number | undefined;
      let selectedPosition: string | undefined;
      let selectedPositionDone = false;

      for await (const data of decodeSseData(response.body)) {
        const event = parseEvent(data);
        if (
          lastSequenceNumber !== undefined &&
          event.sequence_number <= lastSequenceNumber
        ) {
          throw invalidResponse();
        }
        lastSequenceNumber = event.sequence_number;

        if (
          event.type === "response.output_item.added" ||
          event.type === "response.output_item.done"
        ) {
          if (
            event.item.type !== "message" &&
            event.item.type !== "reasoning"
          ) {
            throw invalidResponse();
          }
          continue;
        }

        if (
          event.type === "response.content_part.added" ||
          event.type === "response.content_part.done"
        ) {
          if (
            event.part.type !== "output_text" &&
            event.part.type !== "refusal"
          ) {
            throw invalidResponse();
          }
          continue;
        }

        if (
          event.type === "response.output_text.delta" ||
          event.type === "response.output_text.done" ||
          event.type === "response.refusal.delta" ||
          event.type === "response.refusal.done"
        ) {
          const position = visiblePosition(event);
          if (selectedPosition !== undefined && selectedPosition !== position) {
            throw invalidResponse();
          }
          selectedPosition = position;

          if (
            event.type === "response.output_text.done" ||
            event.type === "response.refusal.done"
          ) {
            if (selectedPositionDone) throw invalidResponse();
            selectedPositionDone = true;
          } else {
            if (selectedPositionDone) throw invalidResponse();
            if (event.delta !== "") {
              yield { type: "text-delta", delta: event.delta };
            }
          }
          continue;
        }

        if (
          event.type === "response.completed" ||
          event.type === "response.incomplete"
        ) {
          if (
            event.response.usage !== null &&
            event.response.usage !== undefined
          ) {
            yield { type: "usage", usage: mapUsage(event.response.usage) };
          }
          yield {
            type: "finish",
            reason:
              event.type === "response.completed"
                ? "stop"
                : mapIncompleteReason(
                    event.response.incomplete_details?.reason,
                  ),
          };
          return;
        }

        if (event.type === "response.failed") {
          throw mapStreamError(event.response.error.code);
        }
        if (event.type === "error") {
          throw mapStreamError(event.code);
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
