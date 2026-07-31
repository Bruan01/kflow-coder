import { access } from "node:fs/promises";
import { homedir } from "node:os";

import { ConfigError } from "../config/config.js";
import {
  resolveConfigPath,
  resolveCredentialsPath,
} from "../config/config-path.js";
import { createDoctorDependencies } from "../doctor/create-doctor-dependencies.js";
import { runDoctor } from "../doctor/doctor.js";
import type { QuickstartDependencies } from "./quickstart.js";
import { createTerminalPrompt } from "./terminal-prompt.js";
import { writeConfigAtomically } from "./write-config.js";
import { writeCredentialsAtomically } from "./write-credentials.js";

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

export function createQuickstartDependencies(
  env: NodeJS.ProcessEnv = process.env,
): QuickstartDependencies {
  const configPath = resolveConfigPath(env);
  const credentialsPath = resolveCredentialsPath(env, configPath);
  return {
    prompt: createTerminalPrompt(),
    configPath,
    credentialsPath,
    homeDirectory: homedir(),
    configFileExists: fileExists,
    credentialsFileExists: fileExists,
    writeConfig: (config) => writeConfigAtomically(configPath, config),
    writeCredentials: (credentials) =>
      writeCredentialsAtomically(credentialsPath, credentials),
    runDoctor: () => runDoctor(createDoctorDependencies(env)),
  };
}
