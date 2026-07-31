import { z } from "zod";

export const providerTimeoutSchema = z.number().int().min(1000).max(300000);

export const providerBaseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });

export const providerModelSchema = z.string().trim().min(1);

export const providerProtocolSchema = z.enum([
  "openai-chat-completions",
  "openai-responses",
]);

export const configFileSchema = z
  .object({
    provider: z
      .object({
        type: z.literal("openai-compatible").optional(),
        protocol: providerProtocolSchema.optional(),
        baseUrl: providerBaseUrlSchema.optional(),
        model: providerModelSchema.optional(),
        timeoutMs: providerTimeoutSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const finalConfigSchema = z.object({
  provider: z.object({
    type: z.literal("openai-compatible"),
    protocol: providerProtocolSchema,
    baseUrl: providerBaseUrlSchema,
    model: providerModelSchema,
    apiKey: z.string().trim().min(1),
    timeoutMs: providerTimeoutSchema,
  }),
});

export type ConfigFileData = z.infer<typeof configFileSchema>;
