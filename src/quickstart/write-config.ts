import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

import { ConfigError } from "../config/config.js";
import {
  providerBaseUrlSchema,
  providerModelSchema,
  providerProtocolSchema,
  providerTimeoutSchema,
} from "../config/schema.js";
import { z } from "zod";

export const quickstartFileConfigSchema = z
  .object({
    provider: z
      .object({
        type: z.literal("openai-compatible"),
        protocol: providerProtocolSchema,
        baseUrl: providerBaseUrlSchema,
        model: providerModelSchema,
        timeoutMs: providerTimeoutSchema,
      })
      .strict(),
  })
  .strict();

export type QuickstartFileConfig = z.infer<typeof quickstartFileConfigSchema>;

export async function writeConfigAtomically(
  configPath: string,
  config: unknown,
): Promise<void> {
  const validated = quickstartFileConfigSchema.safeParse(config);
  if (!validated.success) {
    throw new ConfigError(
      "CONFIG_FILE_INVALID",
      "Quickstart configuration is invalid or contains unsupported fields",
    );
  }

  const directory = dirname(configPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    directory,
    `.${basename(configPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(validated.data, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
    await rename(temporaryPath, configPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
