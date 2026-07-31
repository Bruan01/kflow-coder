import { describe, expect, it } from "vitest";

import { ConfigError } from "../../src/config/config.js";
import { loadConfig } from "../../src/config/load-config.js";

function missingFile(): Promise<string> {
  return Promise.reject(
    Object.assign(new Error("missing"), { code: "ENOENT" }),
  );
}

describe("loadConfig", () => {
  it("loads a complete configuration from environment variables", async () => {
    const config = await loadConfig({
      env: {
        KFC_API_KEY: "test-secret",
        KFC_BASE_URL: "https://provider.example/v1",
        KFC_MODEL: "model-env",
        KFC_TIMEOUT_MS: "45000",
      },
      configPath: "/virtual/config.json",
      readTextFile: missingFile,
    });

    expect(config).toEqual({
      provider: {
        type: "openai-compatible",
        protocol: "openai-chat-completions",
        apiKey: "test-secret",
        baseUrl: "https://provider.example/v1",
        model: "model-env",
        timeoutMs: 45000,
      },
    });
  });

  it("merges a config file and lets environment variables override it", async () => {
    const config = await loadConfig({
      env: {
        KFC_API_KEY: "test-secret",
        KFC_MODEL: "model-env",
      },
      configPath: "/virtual/config.json",
      readTextFile: async () =>
        JSON.stringify({
          provider: {
            type: "openai-compatible",
            baseUrl: "https://provider.example/v1",
            model: "model-file",
            timeoutMs: 30000,
          },
        }),
    });

    expect(config.provider).toMatchObject({
      protocol: "openai-chat-completions",
      model: "model-env",
      baseUrl: "https://provider.example/v1",
      timeoutMs: 30000,
    });
  });

  it("uses the default timeout when no source provides one", async () => {
    const config = await loadConfig({
      env: {
        KFC_API_KEY: "test-secret",
        KFC_BASE_URL: "https://provider.example/v1",
        KFC_MODEL: "model-env",
      },
      configPath: "/virtual/config.json",
      readTextFile: missingFile,
    });

    expect(config.provider.timeoutMs).toBe(60000);
    expect(config.provider.protocol).toBe("openai-chat-completions");
  });

  it("accepts openai-responses as an explicit environment protocol", async () => {
    const config = await loadConfig({
      env: {
        KFC_API_KEY: "test-secret",
        KFC_PROTOCOL: "openai-responses",
        KFC_BASE_URL: "https://api.openai.com/v1",
        KFC_MODEL: "responses-model",
      },
      configPath: "/virtual/config.json",
      readTextFile: missingFile,
    });

    expect(config.provider).toMatchObject({
      protocol: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
      model: "responses-model",
    });
  });

  it("rejects unsupported explicit protocols", async () => {
    await expect(
      loadConfig({
        env: {
          KFC_API_KEY: "test-secret",
          KFC_BASE_URL: "https://provider.example/v1",
          KFC_MODEL: "model-env",
          KFC_PROTOCOL: "auto-detect",
        },
        configPath: "/virtual/config.json",
        readTextFile: missingFile,
      }),
    ).rejects.toMatchObject({
      code: "CONFIG_INVALID",
      issues: [
        {
          path: "provider.protocol",
          message:
            "Provider protocol must be openai-chat-completions or openai-responses",
        },
      ],
    });
  });

  it("returns structured issues when required values are missing", async () => {
    await expect(
      loadConfig({
        env: {},
        configPath: "/virtual/config.json",
        readTextFile: missingFile,
      }),
    ).rejects.toMatchObject({
      name: "ConfigError",
      code: "CONFIG_INVALID",
      issues: expect.arrayContaining([
        { path: "provider.apiKey", message: "Provider API Key is required" },
        { path: "provider.baseUrl", message: "Provider base URL is required" },
        { path: "provider.model", message: "Provider model is required" },
      ]),
    });
  });

  it("rejects invalid URLs and timeout values", async () => {
    await expect(
      loadConfig({
        env: {
          KFC_API_KEY: "test-secret",
          KFC_BASE_URL: "not-a-url",
          KFC_MODEL: "model-env",
          KFC_TIMEOUT_MS: "0",
        },
        configPath: "/virtual/config.json",
        readTextFile: missingFile,
      }),
    ).rejects.toMatchObject({
      code: "CONFIG_INVALID",
      issues: expect.arrayContaining([
        {
          path: "provider.baseUrl",
          message: "Provider base URL must be a valid URL",
        },
        {
          path: "provider.timeoutMs",
          message: "Provider timeout must be between 1000 and 300000 ms",
        },
      ]),
    });
  });

  it("rejects API keys stored in the config file without leaking their value", async () => {
    const storedSecret = "must-not-appear";

    try {
      await loadConfig({
        env: { KFC_API_KEY: "test-secret" },
        configPath: "/virtual/config.json",
        readTextFile: async () =>
          JSON.stringify({
            provider: {
              apiKey: storedSecret,
              baseUrl: "https://provider.example/v1",
              model: "model-file",
            },
          }),
      });
      throw new Error("Expected loadConfig to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect(error).toMatchObject({ code: "CONFIG_FILE_INVALID" });
      expect(JSON.stringify(error)).not.toContain(storedSecret);
      expect(String(error)).not.toContain(storedSecret);
    }
  });

  it("reports malformed JSON without including file contents", async () => {
    const malformed = '{"provider": "secret-fragment"';

    await expect(
      loadConfig({
        env: {},
        configPath: "/virtual/config.json",
        readTextFile: async () => malformed,
      }),
    ).rejects.toMatchObject({
      code: "CONFIG_FILE_INVALID",
      message: "Configuration file contains invalid JSON",
    });
  });
});
