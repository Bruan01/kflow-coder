import type { CredentialsFileData } from "../config/credentials.js";
import type { ProviderProtocol } from "../config/config.js";
import {
  providerBaseUrlSchema,
  providerModelSchema,
  providerProtocolSchema,
  providerTimeoutSchema,
} from "../config/schema.js";
import type { DoctorReport } from "../doctor/doctor.js";
import {
  formatConfigPathForDisplay,
  formatDoctorReport,
} from "../doctor/doctor.js";
import type { QuickstartFileConfig } from "./write-config.js";

export interface QuickstartPrompt {
  readonly isInteractive: boolean;
  ask(label: string, defaultValue?: string): Promise<string>;
  askSecret(label: string): Promise<string>;
  confirm(label: string, defaultValue?: boolean): Promise<boolean>;
  write(text: string): void;
  close(): void;
}

export interface QuickstartResult {
  exitCode: number;
  text: string;
}

export interface QuickstartDependencies {
  prompt: QuickstartPrompt;
  configPath: string;
  credentialsPath: string;
  homeDirectory: string;
  configFileExists(path: string): Promise<boolean>;
  credentialsFileExists(path: string): Promise<boolean>;
  writeConfig(config: QuickstartFileConfig): Promise<void>;
  writeCredentials(credentials: CredentialsFileData): Promise<void>;
  runDoctor(): Promise<DoctorReport>;
}

async function askProtocol(
  prompt: QuickstartPrompt,
): Promise<ProviderProtocol> {
  while (true) {
    const answer = await prompt.ask(
      "Protocol (openai-chat-completions or openai-responses)",
      "openai-chat-completions",
    );
    const result = providerProtocolSchema.safeParse(answer);
    if (result.success) return result.data;
    prompt.write(
      "✗ Protocol must be openai-chat-completions or openai-responses.\n",
    );
  }
}

async function askBaseUrl(prompt: QuickstartPrompt): Promise<string> {
  while (true) {
    const answer = await prompt.ask("Base URL");
    const result = providerBaseUrlSchema.safeParse(answer);
    if (result.success) return result.data;
    prompt.write(
      "✗ Base URL must use http:// or https:// and be a valid URL.\n",
    );
  }
}

async function askModel(prompt: QuickstartPrompt): Promise<string> {
  while (true) {
    const answer = await prompt.ask("Model");
    const result = providerModelSchema.safeParse(answer);
    if (result.success) return result.data;
    prompt.write("✗ Model is required.\n");
  }
}

async function askTimeout(prompt: QuickstartPrompt): Promise<number> {
  while (true) {
    const answer = (
      await prompt.ask("Timeout in milliseconds", "60000")
    ).trim();
    const result = providerTimeoutSchema.safeParse(Number(answer || "60000"));
    if (result.success) return result.data;
    prompt.write("✗ Timeout must be between 1000 and 300000 ms.\n");
  }
}

async function askApiKey(prompt: QuickstartPrompt): Promise<string> {
  while (true) {
    const apiKey = (await prompt.askSecret("Provider API Key")).trim();
    if (apiKey) return apiKey;
    prompt.write("✗ API Key is required.\n");
  }
}

export async function runQuickstart(
  dependencies: QuickstartDependencies,
): Promise<QuickstartResult> {
  const { prompt } = dependencies;
  try {
    if (!prompt.isInteractive) {
      return {
        exitCode: 1,
        text: "Error: Quickstart requires an interactive terminal.\n",
      };
    }

    const displayConfigPath = formatConfigPathForDisplay(
      dependencies.configPath,
      dependencies.homeDirectory,
    );
    const displayCredentialsPath = formatConfigPathForDisplay(
      dependencies.credentialsPath,
      dependencies.homeDirectory,
    );
    prompt.write(
      `KFC Quickstart\n\nProvider type: openai-compatible\nConfig path: ${displayConfigPath}\nCredentials path: ${displayCredentialsPath}\n\n`,
    );

    const [configExists, credentialsExist] = await Promise.all([
      dependencies.configFileExists(dependencies.configPath),
      dependencies.credentialsFileExists(dependencies.credentialsPath),
    ]);
    if (configExists || credentialsExist) {
      const overwrite = await prompt.confirm(
        "Existing config or credentials found. Overwrite setup files?",
        false,
      );
      if (!overwrite) {
        return { exitCode: 130, text: "Quickstart cancelled.\n" };
      }
    }

    const config: QuickstartFileConfig = {
      provider: {
        type: "openai-compatible",
        protocol: await askProtocol(prompt),
        baseUrl: await askBaseUrl(prompt),
        model: await askModel(prompt),
        timeoutMs: await askTimeout(prompt),
      },
    };

    prompt.write(
      `\nConfiguration preview:\n${JSON.stringify(config, null, 2)}\n\n` +
        `API Key will be stored as plaintext in ${displayCredentialsPath} with mode 0600.\n`,
    );
    if (
      !(await prompt.confirm(
        "Write configuration and plaintext credentials?",
        false,
      ))
    ) {
      return { exitCode: 130, text: "Quickstart cancelled.\n" };
    }

    const apiKey = await askApiKey(prompt);
    const credentials: CredentialsFileData = {
      provider: {
        baseUrl: config.provider.baseUrl,
        apiKey,
      },
    };

    await dependencies.writeConfig(config);
    await dependencies.writeCredentials(credentials);
    const report = await dependencies.runDoctor();
    return {
      exitCode: report.exitCode,
      text:
        `✓ Provider configuration saved to ${displayConfigPath}\n` +
        `✓ Provider credentials saved to ${displayCredentialsPath}\n\n` +
        formatDoctorReport(report),
    };
  } finally {
    prompt.close();
  }
}
