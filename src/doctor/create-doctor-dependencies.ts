import { access } from "node:fs/promises";
import { homedir } from "node:os";

import { ConfigError } from "../config/config.js";
import {
  resolveConfigPath,
  resolveCredentialsPath,
} from "../config/config-path.js";
import { loadConfig } from "../config/load-config.js";
import type { DoctorDependencies } from "./doctor.js";

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw new ConfigError(
      "CONFIG_FILE_READ_FAILED",
      "Unable to access setup file",
    );
  }
}

export function createDoctorDependencies(
  env: NodeJS.ProcessEnv = process.env,
): DoctorDependencies {
  const configPath = resolveConfigPath(env);
  const credentialsPath = resolveCredentialsPath(env, configPath);
  return {
    nodeVersion: process.version,
    configPath,
    credentialsPath,
    homeDirectory: homedir(),
    configFileExists: fileExists,
    credentialsFileExists: fileExists,
    loadConfig: () => loadConfig({ env, configPath, credentialsPath }),
  };
}
