import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

import { ConfigError } from "./config.js";
import {
  configFileSchema,
  type ConfigFileData,
  themeNameSchema,
} from "./schema.js";
import type { ThemeName } from "./runtime-settings.js";

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

function parseConfigFile(content: string): ConfigFileData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ConfigError(
      "CONFIG_FILE_INVALID",
      "Configuration file contains invalid JSON",
    );
  }
  const result = configFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(
      "CONFIG_FILE_INVALID",
      "Configuration file does not match the expected schema",
    );
  }
  return result.data;
}

async function readExistingConfig(configPath: string): Promise<ConfigFileData> {
  try {
    return parseConfigFile(await readFile(configPath, "utf8"));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return {};
    throw error;
  }
}

export async function writeThemeAtomically(
  configPath: string,
  theme: ThemeName,
): Promise<void> {
  if (!themeNameSchema.safeParse(theme).success) {
    throw new ConfigError("CONFIG_INVALID", "UI theme is not supported");
  }
  const current = await readExistingConfig(configPath);
  const next: ConfigFileData = {
    ...current,
    ui: {
      ...current.ui,
      theme,
    },
  };
  const directory = dirname(configPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    directory,
    `.${basename(configPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, configPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
