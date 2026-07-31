import { z } from "zod";

import { providerBaseUrlSchema } from "./schema.js";

export const credentialsFileSchema = z
  .object({
    provider: z
      .object({
        baseUrl: providerBaseUrlSchema,
        apiKey: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export type CredentialsFileData = z.infer<typeof credentialsFileSchema>;
