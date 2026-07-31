import { z } from "zod";

const sequenceNumberSchema = z.number().int().nonnegative();
const indexSchema = z.number().int().nonnegative();
const tokenCountSchema = z.number().int().nonnegative();
const machineErrorCodeSchema = z.string().min(1).max(128);
const providerMessageSchema = z.string().max(16 * 1024);

const usageSchema = z.object({
  input_tokens: tokenCountSchema,
  output_tokens: tokenCountSchema,
  total_tokens: tokenCountSchema,
});

const outputTextDeltaSchema = z.object({
  type: z.literal("response.output_text.delta"),
  sequence_number: sequenceNumberSchema,
  item_id: z.string().min(1),
  output_index: indexSchema,
  content_index: indexSchema,
  delta: z.string(),
});

const outputTextDoneSchema = z.object({
  type: z.literal("response.output_text.done"),
  sequence_number: sequenceNumberSchema,
  item_id: z.string().min(1),
  output_index: indexSchema,
  content_index: indexSchema,
  text: z.string(),
});

const refusalDeltaSchema = z.object({
  type: z.literal("response.refusal.delta"),
  sequence_number: sequenceNumberSchema,
  item_id: z.string().min(1),
  output_index: indexSchema,
  content_index: indexSchema,
  delta: z.string(),
});

const refusalDoneSchema = z.object({
  type: z.literal("response.refusal.done"),
  sequence_number: sequenceNumberSchema,
  item_id: z.string().min(1),
  output_index: indexSchema,
  content_index: indexSchema,
  refusal: z.string(),
});

const lifecycleEventSchema = z.object({
  type: z.enum([
    "response.created",
    "response.queued",
    "response.in_progress",
    "response.reasoning_summary_part.added",
    "response.reasoning_summary_part.done",
    "response.reasoning_summary_text.delta",
    "response.reasoning_summary_text.done",
    "response.reasoning_text.delta",
    "response.reasoning_text.done",
  ]),
  sequence_number: sequenceNumberSchema,
});

const outputItemEventSchema = z.object({
  type: z.enum(["response.output_item.added", "response.output_item.done"]),
  sequence_number: sequenceNumberSchema,
  output_index: indexSchema,
  item: z.object({ type: z.string().min(1).max(64) }),
});

const contentPartEventSchema = z.object({
  type: z.enum(["response.content_part.added", "response.content_part.done"]),
  sequence_number: sequenceNumberSchema,
  item_id: z.string().min(1),
  output_index: indexSchema,
  content_index: indexSchema,
  part: z.object({ type: z.string().min(1).max(64) }),
});

const completedSchema = z.object({
  type: z.literal("response.completed"),
  sequence_number: sequenceNumberSchema,
  response: z.object({
    status: z.literal("completed"),
    usage: usageSchema.nullish(),
  }),
});

const incompleteSchema = z.object({
  type: z.literal("response.incomplete"),
  sequence_number: sequenceNumberSchema,
  response: z.object({
    status: z.literal("incomplete"),
    incomplete_details: z
      .object({ reason: z.string().min(1).max(128) })
      .nullish(),
    usage: usageSchema.nullish(),
  }),
});

const failedSchema = z.object({
  type: z.literal("response.failed"),
  sequence_number: sequenceNumberSchema,
  response: z.object({
    status: z.literal("failed"),
    error: z.object({
      code: machineErrorCodeSchema,
      message: providerMessageSchema.optional(),
    }),
  }),
});

const errorSchema = z.object({
  type: z.literal("error"),
  sequence_number: sequenceNumberSchema,
  code: machineErrorCodeSchema,
  message: providerMessageSchema.optional(),
  param: z.string().max(256).nullable().optional(),
});

export const responsesStreamEventSchema = z.discriminatedUnion("type", [
  outputTextDeltaSchema,
  outputTextDoneSchema,
  refusalDeltaSchema,
  refusalDoneSchema,
  completedSchema,
  incompleteSchema,
  failedSchema,
  errorSchema,
  lifecycleEventSchema,
  outputItemEventSchema,
  contentPartEventSchema,
]);

export type ResponsesStreamEvent = z.infer<typeof responsesStreamEventSchema>;
