import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  type CredentialsFileData,
  credentialsFileSchema,
} from "../config/credentials.js";
import { ConfigError } from "../config/config.js";

export async function writeCredentialsAtomically(
  credentialsPath: string,
  credentials: unknown,
): Promise<void> {
  const validated = credentialsFileSchema.safeParse(credentials);
  if (!validated.success) {
    throw new ConfigError(
      "CREDENTIALS_FILE_INVALID",
      "Quickstart credentials are invalid",
    );
  }

  const directory = dirname(credentialsPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    directory,
    `.${basename(credentialsPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(validated.data satisfies CredentialsFileData, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    await rename(temporaryPath, credentialsPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
