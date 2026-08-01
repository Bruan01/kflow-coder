export type ModelMessageRole = "system" | "user" | "assistant" | "tool";

export interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface ModelTextMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface ModelAssistantMessage {
  readonly role: "assistant";
  readonly content: string;
  readonly toolCalls?: readonly ModelToolCall[];
}

export interface ModelToolResultMessage {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly content: string;
  readonly isError: boolean;
}

export type ModelMessage =
  ModelTextMessage | ModelAssistantMessage | ModelToolResultMessage;

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
}

export interface ModelStreamOptions {
  readonly signal?: AbortSignal;
}

export type ModelFinishReason =
  "stop" | "length" | "content-filter" | "unknown" | "tool-call";

export interface ModelTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export type ModelStreamEvent =
  | { readonly type: "start" }
  | { readonly type: "text-delta"; readonly delta: string }
  | { readonly type: "tool-call"; readonly toolCall: ModelToolCall }
  | { readonly type: "usage"; readonly usage: ModelTokenUsage }
  | { readonly type: "finish"; readonly reason: ModelFinishReason };

export interface ModelProvider {
  stream(
    request: ModelRequest,
    options?: ModelStreamOptions,
  ): AsyncIterable<ModelStreamEvent>;
}
