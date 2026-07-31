import { describe, expect, it, type Mock, vi } from "vitest";

import type { DoctorReport } from "../../src/doctor/doctor.js";
import {
  runQuickstart,
  type QuickstartPrompt,
} from "../../src/quickstart/quickstart.js";

function createPrompt({
  answers = [],
  secrets = [],
  confirmations = [],
  isInteractive = true,
}: {
  answers?: string[];
  secrets?: string[];
  confirmations?: boolean[];
  isInteractive?: boolean;
} = {}): QuickstartPrompt & {
  output: string[];
  close: Mock<() => void>;
} {
  const output: string[] = [];
  const answerQueue = [...answers];
  const secretQueue = [...secrets];
  const confirmationQueue = [...confirmations];
  return {
    isInteractive,
    output,
    ask: vi.fn(async (_label: string, defaultValue?: string) => {
      const answer = answerQueue.shift() ?? "";
      return answer || defaultValue || "";
    }),
    askSecret: vi.fn(async () => secretQueue.shift() ?? ""),
    confirm: vi.fn(async () => confirmationQueue.shift() ?? false),
    write: (text: string) => output.push(text),
    close: vi.fn<() => void>(),
  };
}

const passingDoctor: DoctorReport = {
  exitCode: 0,
  checks: [
    { status: "pass", label: "Node.js", detail: "v24.14.0" },
    {
      status: "pass",
      label: "Config file",
      detail: "~/.config/kfc/config.json",
    },
    {
      status: "pass",
      label: "Credentials",
      detail: "~/.config/kfc/credentials.json",
    },
    { status: "pass", label: "Base URL", detail: "https://custom.example/v1" },
    { status: "pass", label: "Model", detail: "custom-model" },
    { status: "pass", label: "API Key", detail: "present" },
  ],
};

function baseDependencies(prompt: QuickstartPrompt) {
  return {
    prompt,
    configPath: "/home/learner/.config/kfc/config.json",
    credentialsPath: "/home/learner/.config/kfc/credentials.json",
    homeDirectory: "/home/learner",
    configFileExists: vi.fn(async () => false),
    credentialsFileExists: vi.fn(async () => false),
    writeConfig: vi.fn<(config: unknown) => Promise<void>>(async () => {}),
    writeCredentials: vi.fn<(credentials: unknown) => Promise<void>>(
      async () => {},
    ),
    runDoctor: vi.fn(async () => passingDoctor),
  };
}

describe("runQuickstart", () => {
  it("writes an explicitly selected OpenAI Responses protocol", async () => {
    const prompt = createPrompt({
      answers: [
        "openai-responses",
        "https://api.openai.com/v1",
        "responses-model",
        "60000",
      ],
      secrets: ["plaintext-test-secret"],
      confirmations: [true],
    });
    const dependencies = baseDependencies(prompt);

    await runQuickstart(dependencies);

    expect(dependencies.writeConfig).toHaveBeenCalledWith({
      provider: {
        type: "openai-compatible",
        protocol: "openai-responses",
        baseUrl: "https://api.openai.com/v1",
        model: "responses-model",
        timeoutMs: 60000,
      },
    });
    expect(prompt.output.join("")).toContain('"protocol": "openai-responses"');
    expect(prompt.output.join("")).not.toContain("plaintext-test-secret");
  });

  it("writes DIY config and plaintext credentials, then runs doctor", async () => {
    const prompt = createPrompt({
      answers: ["", "https://custom.example/v1", "custom-model", ""],
      secrets: ["plaintext-test-secret"],
      confirmations: [true],
    });
    const dependencies = baseDependencies(prompt);

    const result = await runQuickstart(dependencies);

    expect(dependencies.writeConfig).toHaveBeenCalledWith({
      provider: {
        type: "openai-compatible",
        protocol: "openai-chat-completions",
        baseUrl: "https://custom.example/v1",
        model: "custom-model",
        timeoutMs: 60000,
      },
    });
    expect(dependencies.writeCredentials).toHaveBeenCalledWith({
      provider: {
        baseUrl: "https://custom.example/v1",
        apiKey: "plaintext-test-secret",
      },
    });
    expect(JSON.stringify(dependencies.writeConfig.mock.calls)).not.toContain(
      "apiKey",
    );
    expect(prompt.output.join("")).not.toContain("plaintext-test-secret");
    expect(result.text).not.toContain("plaintext-test-secret");
    expect(result.text).toContain("Provider credentials saved");
    expect(result.exitCode).toBe(0);
    expect(prompt.close).toHaveBeenCalledOnce();
  });

  it("re-prompts invalid URL and timeout values", async () => {
    const prompt = createPrompt({
      answers: [
        "auto-detect",
        "openai-responses",
        "not-a-url",
        "https://custom.example/v1",
        "custom-model",
        "999",
        "45000",
      ],
      secrets: ["plaintext-test-secret"],
      confirmations: [true],
    });
    const dependencies = baseDependencies(prompt);

    await runQuickstart(dependencies);

    expect(prompt.output.join("")).toContain(
      "Protocol must be openai-chat-completions or openai-responses",
    );
    expect(prompt.output.join("")).toContain(
      "Base URL must use http:// or https://",
    );
    expect(prompt.output.join("")).toContain(
      "Timeout must be between 1000 and 300000 ms",
    );
    expect(dependencies.writeConfig.mock.calls[0]?.[0]).toMatchObject({
      provider: { protocol: "openai-responses", timeoutMs: 45000 },
    });
  });

  it("refuses to overwrite an existing config unless confirmed", async () => {
    const prompt = createPrompt({ confirmations: [false] });
    const dependencies = {
      ...baseDependencies(prompt),
      configFileExists: vi.fn(async () => true),
    };

    const result = await runQuickstart(dependencies);

    expect(result).toEqual({ exitCode: 130, text: "Quickstart cancelled.\n" });
    expect(dependencies.writeConfig).not.toHaveBeenCalled();
    expect(dependencies.writeCredentials).not.toHaveBeenCalled();
  });

  it("can cancel after preview without asking for a secret", async () => {
    const prompt = createPrompt({
      answers: ["", "https://custom.example/v1", "custom-model", "60000"],
      confirmations: [false],
    });
    const dependencies = baseDependencies(prompt);

    const result = await runQuickstart(dependencies);

    expect(result.exitCode).toBe(130);
    expect(prompt.askSecret).not.toHaveBeenCalled();
    expect(dependencies.writeConfig).not.toHaveBeenCalled();
  });

  it("requires an interactive terminal", async () => {
    const prompt = createPrompt({ isInteractive: false });
    const dependencies = baseDependencies(prompt);

    const result = await runQuickstart(dependencies);

    expect(result).toEqual({
      exitCode: 1,
      text: "Error: Quickstart requires an interactive terminal.\n",
    });
    expect(prompt.close).toHaveBeenCalledOnce();
  });

  it("re-prompts a blank API Key and keeps it out of normal config", async () => {
    const prompt = createPrompt({
      answers: ["", "https://custom.example/v1", "custom-model", "60000"],
      secrets: ["", "final-plaintext-secret"],
      confirmations: [true],
    });
    const dependencies = baseDependencies(prompt);

    const result = await runQuickstart(dependencies);

    expect(prompt.output.join("")).toContain("API Key is required");
    expect(JSON.stringify(dependencies.writeConfig.mock.calls)).not.toContain(
      "final-plaintext-secret",
    );
    expect(dependencies.writeCredentials).toHaveBeenCalledWith({
      provider: {
        baseUrl: "https://custom.example/v1",
        apiKey: "final-plaintext-secret",
      },
    });
    expect(result.text).not.toContain("final-plaintext-secret");
  });
});
