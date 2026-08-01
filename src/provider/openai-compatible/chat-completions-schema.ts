import { z } from "zod";

const nonNegativeTokenCount = z.number().int().nonnegative();

const chatCompletionToolCallDeltaSchema = z.object({
  index: z.number().int().nonnegative(),
  id: z.string().min(1).optional(),
  type: z.literal("function").optional(),
  function: z
    .object({
      name: z.string().min(1).optional(),
      arguments: z.string().optional(),
    })
    .optional(),
});

export const chatCompletionUsageSchema = z.object({
  prompt_tokens: nonNegativeTokenCount,
  completion_tokens: nonNegativeTokenCount,
  total_tokens: nonNegativeTokenCount,
});

const chatCompletionChoiceSchema = z.object({
  index: z.number().int().nonnegative(),
  delta: z.object({
    content: z.string().nullable().optional(),
    tool_calls: z.array(chatCompletionToolCallDeltaSchema).optional(),
  }),
  finish_reason: z.string().nullable().optional(),
});

export const chatCompletionChunkSchema = z.object({
  choices: z.array(chatCompletionChoiceSchema),
  usage: chatCompletionUsageSchema.nullable().optional(),
});

const providerErrorCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .or(z.number().finite());

export const providerErrorResponseSchema = z.object({
  error: z.object({
    code: providerErrorCodeSchema.nullable().optional(),
  }),
});

export type ChatCompletionChunk = z.infer<typeof chatCompletionChunkSchema>;
