import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface ConfigPathOptions {
  homeDirectory?: string;
  currentDirectory?: string;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveOptionalPath(
  value: string | undefined,
  currentDirectory: string,
): string | undefined {
  const path = nonEmpty(value);
  if (!path) return undefined;
  return isAbsolute(path) ? path : resolve(currentDirectory, path);
}

export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  options: ConfigPathOptions = {},
): string {
  const homeDirectory = options.homeDirectory ?? homedir();
  const currentDirectory = options.currentDirectory ?? process.cwd();
  const explicitPath = resolveOptionalPath(
    env.KFC_CONFIG_PATH,
    currentDirectory,
  );
  if (explicitPath) return explicitPath;

  const configHome =
    nonEmpty(env.XDG_CONFIG_HOME) ?? join(homeDirectory, ".config");
  return join(configHome, "kfc", "config.json");
}

export function resolveCredentialsPath(
  env: NodeJS.ProcessEnv = process.env,
  configPath = resolveConfigPath(env),
  options: ConfigPathOptions = {},
): string {
  const currentDirectory = options.currentDirectory ?? process.cwd();
  const explicitPath = resolveOptionalPath(
    env.KFC_CREDENTIALS_PATH,
    currentDirectory,
  );
  return explicitPath ?? join(dirname(configPath), "credentials.json");
}
