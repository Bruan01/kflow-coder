export type ModelMessageRole = "system" | "user" | "assistant";

export interface ModelMessage {
  readonly role: ModelMessageRole;
  readonly content: string;
}

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
}

export interface ModelStreamOptions {
  readonly signal?: AbortSignal;
}

export type ModelFinishReason =
  "stop" | "length" | "content-filter" | "unknown";

export interface ModelTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export type ModelStreamEvent =
  | { readonly type: "start" }
  | { readonly type: "text-delta"; readonly delta: string }
  | { readonly type: "usage"; readonly usage: ModelTokenUsage }
  | { readonly type: "finish"; readonly reason: ModelFinishReason };

export interface ModelProvider {
  stream(
    request: ModelRequest,
    options?: ModelStreamOptions,
  ): AsyncIterable<ModelStreamEvent>;
}
