import { describe, expect, it, vi } from "vitest";

import { ConfigError, type KfcConfig } from "../../src/config/config.js";
import {
  formatConfigPathForDisplay,
  formatDoctorReport,
  runDoctor,
} from "../../src/doctor/doctor.js";

const validConfig: KfcConfig = {
  provider: {
    type: "openai-compatible",
    protocol: "openai-chat-completions",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKey: "doctor-test-secret",
    timeoutMs: 60000,
  },
};

function createDependencies(overrides = {}) {
  return {
    nodeVersion: "v24.14.0",
    configPath: "/home/learner/.config/kfc/config.json",
    credentialsPath: "/home/learner/.config/kfc/credentials.json",
    homeDirectory: "/home/learner",
    configFileExists: vi.fn(async () => false),
    credentialsFileExists: vi.fn(async () => false),
    loadConfig: vi.fn(async () => validConfig),
    ...overrides,
  };
}

describe("runDoctor", () => {
  it("passes with environment-only DeepSeek configuration", async () => {
    const dependencies = createDependencies();

    const report = await runDoctor(dependencies);

    expect(report.exitCode).toBe(0);
    expect(report.checks).toEqual([
      { status: "pass", label: "Node.js", detail: "v24.14.0" },
      {
        status: "warn",
        label: "Config file",
        detail:
          "~/.config/kfc/config.json not found; using environment/defaults",
      },
      {
        status: "warn",
        label: "Credentials",
        detail: "~/.config/kfc/credentials.json not found; using environment",
      },
      { status: "pass", label: "Base URL", detail: "https://api.deepseek.com" },
      { status: "pass", label: "Model", detail: "deepseek-v4-flash" },
      { status: "pass", label: "API Key", detail: "present" },
    ]);
    expect(JSON.stringify(report)).not.toContain("doctor-test-secret");
  });

  it("reports each missing configuration field without throwing", async () => {
    const dependencies = createDependencies({
      loadConfig: vi.fn(async () => {
        throw new ConfigError(
          "CONFIG_INVALID",
          "Configuration is incomplete or invalid",
          [
            { path: "provider.apiKey", message: "KFC_API_KEY is required" },
            {
              path: "provider.baseUrl",
              message: "Provider base URL is required",
            },
            { path: "provider.model", message: "Provider model is required" },
          ],
        );
      }),
    });

    const report = await runDoctor(dependencies);
    const text = formatDoctorReport(report);

    expect(report.exitCode).toBe(2);
    expect(text).toContain("✗ Base URL");
    expect(text).toContain("✗ Model");
    expect(text).toContain("✗ API Key");
    expect(text).not.toContain("doctor-test-secret");
  });

  it("fails an unsupported Node.js major version", async () => {
    const report = await runDoctor(
      createDependencies({ nodeVersion: "v20.19.0" }),
    );

    expect(report.exitCode).toBe(1);
    expect(report.checks[0]).toEqual({
      status: "fail",
      label: "Node.js",
      detail: "v20.19.0; requires Node.js 22 or newer",
    });
  });

  it("marks an existing credentials file without showing its contents", async () => {
    const report = await runDoctor(
      createDependencies({ credentialsFileExists: vi.fn(async () => true) }),
    );

    expect(report.checks[2]).toEqual({
      status: "pass",
      label: "Credentials",
      detail: "~/.config/kfc/credentials.json",
    });
    expect(JSON.stringify(report)).not.toContain("doctor-test-secret");
  });
  it("marks an existing config file without exposing the full home path", async () => {
    const report = await runDoctor(
      createDependencies({ configFileExists: vi.fn(async () => true) }),
    );

    expect(report.checks[1]).toEqual({
      status: "pass",
      label: "Config file",
      detail: "~/.config/kfc/config.json",
    });
  });
});

describe("formatConfigPathForDisplay", () => {
  it("collapses the home directory and leaves unrelated paths unchanged", () => {
    expect(
      formatConfigPathForDisplay(
        "/home/learner/.config/kfc/config.json",
        "/home/learner",
      ),
    ).toBe("~/.config/kfc/config.json");
    expect(
      formatConfigPathForDisplay("/workspace/config.json", "/home/learner"),
    ).toBe("/workspace/config.json");
  });
});
