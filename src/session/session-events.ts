import { z } from "zod";

import type {
  AgentRunMetrics,
  AgentRunResult,
  AgentToolResult,
} from "../agent/run-agent.js";
import type {
  ModelFinishReason,
  ModelMessage,
  ModelToolCall,
  ModelTokenUsage,
} from "../provider/model-provider.js";

export const SESSION_EVENT_VERSION = 1 as const;

export interface SessionEventBase {
  readonly version: typeof SESSION_EVENT_VERSION;
  readonly sessionId: string;
  readonly timestamp: string;
}

export interface SessionStartedEvent extends SessionEventBase {
  readonly type: "session.started";
  readonly cwd: string;
  readonly model: string;
  readonly protocol: string;
}

export interface TurnStartedEvent extends SessionEventBase {
  readonly type: "turn.started";
  readonly turn: number;
  readonly messages: readonly ModelMessage[];
}

export interface ToolCallEvent extends SessionEventBase {
  readonly type: "tool.call";
  readonly turn: number;
  readonly toolCall: ModelToolCall;
}

export interface ToolResultEvent extends SessionEventBase {
  readonly type: "tool.result";
  readonly turn: number;
  readonly toolCall: ModelToolCall;
  readonly result: AgentToolResult;
  readonly durationMs: number;
}

export interface TurnCompletedEvent extends SessionEventBase {
  readonly type: "turn.completed";
  readonly turn: number;
  readonly messages: readonly ModelMessage[];
  readonly finalText: string;
  readonly steps: number;
  readonly finishReason: Exclude<ModelFinishReason, "tool-call">;
  readonly usage?: ModelTokenUsage;
  readonly metrics?: AgentRunMetrics;
}

export interface TurnFailedEvent extends SessionEventBase {
  readonly type: "turn.failed";
  readonly turn: number;
  readonly code: string;
  readonly message: string;
}

export interface SessionClearedEvent extends SessionEventBase {
  readonly type: "session.cleared";
  readonly reason: "user-request";
}

export interface SessionEndedEvent extends SessionEventBase {
  readonly type: "session.ended";
  readonly reason: "user-exit" | "stdin-closed";
}

export type SessionEvent =
  | SessionStartedEvent
  | TurnStartedEvent
  | ToolCallEvent
  | ToolResultEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | SessionClearedEvent
  | SessionEndedEvent;

const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

const toolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.unknown(),
});

const toolResultSchema = z.object({
  toolCallId: z.string().min(1),
  content: z.string(),
  isError: z.boolean(),
});

const modelMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("system"), content: z.string() }),
  z.object({ role: z.literal("user"), content: z.string() }),
  z.object({
    role: z.literal("assistant"),
    content: z.string(),
    toolCalls: z.array(toolCallSchema).optional(),
  }),
  z.object({
    role: z.literal("tool"),
    toolCallId: z.string().min(1),
    content: z.string(),
    isError: z.boolean(),
  }),
]);

const metricsSchema = z.object({
  modelTurns: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  failedToolCalls: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  timeToFirstTextMs: z.number().nonnegative().nullable(),
  peakInputTokens: z.number().int().nonnegative().nullable(),
  usage: usageSchema.optional(),
});

const eventBaseSchema = z.object({
  version: z.literal(SESSION_EVENT_VERSION),
  sessionId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
});

export const sessionEventSchema = z.discriminatedUnion("type", [
  eventBaseSchema.extend({
    type: z.literal("session.started"),
    cwd: z.string(),
    model: z.string(),
    protocol: z.string(),
  }),
  eventBaseSchema.extend({
    type: z.literal("turn.started"),
    turn: z.number().int().positive(),
    messages: z.array(modelMessageSchema),
  }),
  eventBaseSchema.extend({
    type: z.literal("tool.call"),
    turn: z.number().int().positive(),
    toolCall: toolCallSchema,
  }),
  eventBaseSchema.extend({
    type: z.literal("tool.result"),
    turn: z.number().int().positive(),
    toolCall: toolCallSchema,
    result: toolResultSchema,
    durationMs: z.number().nonnegative(),
  }),
  eventBaseSchema.extend({
    type: z.literal("turn.completed"),
    turn: z.number().int().positive(),
    messages: z.array(modelMessageSchema),
    finalText: z.string(),
    steps: z.number().int().positive(),
    finishReason: z.enum(["stop", "length", "content-filter", "unknown"]),
    usage: usageSchema.optional(),
    metrics: metricsSchema.optional(),
  }),
  eventBaseSchema.extend({
    type: z.literal("turn.failed"),
    turn: z.number().int().positive(),
    code: z.string().min(1),
    message: z.string(),
  }),
  eventBaseSchema.extend({
    type: z.literal("session.cleared"),
    reason: z.literal("user-request"),
  }),
  eventBaseSchema.extend({
    type: z.literal("session.ended"),
    reason: z.enum(["user-exit", "stdin-closed"]),
  }),
]);

export function isSessionEvent(value: unknown): value is SessionEvent {
  return sessionEventSchema.safeParse(value).success;
}

export function sessionEventFromJson(value: unknown): SessionEvent | undefined {
  const result = sessionEventSchema.safeParse(value);
  // Zod represents optional object keys as `T | undefined`; the domain event
  // types use exact optional properties, so a successful parse is narrowed
  // here after runtime validation rather than leaking that implementation
  // detail through the public type.
  return result.success ? (result.data as unknown as SessionEvent) : undefined;
}

export function sessionEventFromAgentResult(
  base: SessionEventBase,
  turn: number,
  result: AgentRunResult,
): TurnCompletedEvent {
  return {
    ...base,
    type: "turn.completed",
    turn,
    messages: result.messages,
    finalText: result.finalText,
    steps: result.steps,
    finishReason: result.finishReason,
    ...(result.usage === undefined ? {} : { usage: result.usage }),
    ...(result.metrics === undefined ? {} : { metrics: result.metrics }),
  };
}
