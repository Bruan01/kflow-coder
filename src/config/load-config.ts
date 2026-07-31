import { readFile } from "node:fs/promises";

import { type ConfigIssue, ConfigError, type KfcConfig } from "./config.js";
import {
  type CredentialsFileData,
  credentialsFileSchema,
} from "./credentials.js";
import { resolveConfigPath, resolveCredentialsPath } from "./config-path.js";
import {
  type ConfigFileData,
  configFileSchema,
  finalConfigSchema,
} from "./schema.js";

export interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  credentialsPath?: string;
  readTextFile?: (path: string) => Promise<string>;
  readCredentialsTextFile?: (path: string) => Promise<string>;
}

function envText(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

function fileIssues(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}): ConfigIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "config",
    message: issue.message,
  }));
}

function finalIssueMessage(path: string): string {
  const messages: Record<string, string> = {
    "provider.apiKey": "Provider API Key is required",
    "provider.baseUrl": "Provider base URL is required",
    "provider.model": "Provider model is required",
    "provider.protocol":
      "Provider protocol must be openai-chat-completions or openai-responses",
    "provider.timeoutMs": "Provider timeout must be between 1000 and 300000 ms",
  };
  return messages[path] ?? "Configuration value is invalid";
}

function finalIssues(error: {
  issues: readonly { path: PropertyKey[]; code: string }[];
}): ConfigIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".") || "config";
    let message = finalIssueMessage(path);
    if (path === "provider.baseUrl" && issue.code !== "invalid_type") {
      message = "Provider base URL must be a valid URL";
    }
    return { path, message };
  });
}

async function readOptionalJson<T>(
  path: string,
  readTextFile: (path: string) => Promise<string>,
  options: {
    readErrorCode: "CONFIG_FILE_READ_FAILED" | "CREDENTIALS_FILE_READ_FAILED";
    invalidErrorCode: "CONFIG_FILE_INVALID" | "CREDENTIALS_FILE_INVALID";
    readMessage: string;
    invalidJsonMessage: string;
    invalidSchemaMessage: string;
    parse(value: unknown):
      | { success: true; data: T }
      | {
          success: false;
          error: {
            issues: readonly { path: PropertyKey[]; message: string }[];
          };
        };
  },
): Promise<T | null> {
  let content: string;
  try {
    content = await readTextFile(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw new ConfigError(options.readErrorCode, options.readMessage);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ConfigError(options.invalidErrorCode, options.invalidJsonMessage);
  }

  const result = options.parse(parsed);
  if (!result.success) {
    throw new ConfigError(
      options.invalidErrorCode,
      options.invalidSchemaMessage,
      fileIssues(result.error),
    );
  }
  return result.data;
}

async function readConfigFile(
  path: string,
  reader: (path: string) => Promise<string>,
): Promise<ConfigFileData> {
  return (
    (await readOptionalJson(path, reader, {
      readErrorCode: "CONFIG_FILE_READ_FAILED",
      invalidErrorCode: "CONFIG_FILE_INVALID",
      readMessage: "Unable to read configuration file",
      invalidJsonMessage: "Configuration file contains invalid JSON",
      invalidSchemaMessage:
        "Configuration file does not match the expected schema",
      parse: (value) => configFileSchema.safeParse(value),
    })) ?? {}
  );
}

async function readCredentialsFile(
  path: string,
  reader: (path: string) => Promise<string>,
): Promise<CredentialsFileData | null> {
  return readOptionalJson(path, reader, {
    readErrorCode: "CREDENTIALS_FILE_READ_FAILED",
    invalidErrorCode: "CREDENTIALS_FILE_INVALID",
    readMessage: "Unable to read credentials file",
    invalidJsonMessage: "Credentials file contains invalid JSON",
    invalidSchemaMessage: "Credentials file does not match the expected schema",
    parse: (value) => credentialsFileSchema.safeParse(value),
  });
}

export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<KfcConfig> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? resolveConfigPath(env);
  const credentialsPath =
    options.credentialsPath ?? resolveCredentialsPath(env, configPath);
  const readConfigText =
    options.readTextFile ?? ((path: string) => readFile(path, "utf8"));
  const readCredentialsText =
    options.readCredentialsTextFile ??
    ((path: string) => readFile(path, "utf8"));
  const file = await readConfigFile(configPath, readConfigText);
  const timeoutText = envText(env, "KFC_TIMEOUT_MS");
  const baseUrl = envText(env, "KFC_BASE_URL") ?? file.provider?.baseUrl;
  const environmentApiKey = envText(env, "KFC_API_KEY");
  const credentials = environmentApiKey
    ? null
    : await readCredentialsFile(credentialsPath, readCredentialsText);

  if (credentials && baseUrl && credentials.provider.baseUrl !== baseUrl) {
    throw new ConfigError(
      "CONFIG_INVALID",
      "Stored credentials do not match the active Provider",
      [
        {
          path: "provider.apiKey",
          message: "Stored credentials do not match Provider base URL",
        },
      ],
    );
  }

  const candidate = {
    provider: {
      type: "openai-compatible" as const,
      protocol:
        envText(env, "KFC_PROTOCOL") ??
        file.provider?.protocol ??
        "openai-chat-completions",
      baseUrl,
      model: envText(env, "KFC_MODEL") ?? file.provider?.model,
      apiKey: environmentApiKey ?? credentials?.provider.apiKey,
      timeoutMs:
        timeoutText === undefined
          ? (file.provider?.timeoutMs ?? 60000)
          : Number(timeoutText),
    },
  };

  const result = finalConfigSchema.safeParse(candidate);
  if (!result.success) {
    throw new ConfigError(
      "CONFIG_INVALID",
      "Configuration is incomplete or invalid",
      finalIssues(result.error),
    );
  }

  return result.data;
}
