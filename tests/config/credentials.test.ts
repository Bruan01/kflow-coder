import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";

const configJson = JSON.stringify({
  provider: {
    type: "openai-compatible",
    baseUrl: "https://custom.example/v1",
    model: "custom-model",
    timeoutMs: 60000,
  },
});

const credentialsJson = JSON.stringify({
  provider: {
    baseUrl: "https://custom.example/v1",
    apiKey: "stored-credential-secret",
  },
});

describe("credentials loading", () => {
  it("loads API Key from credentials.json when the environment is empty", async () => {
    const config = await loadConfig({
      env: {},
      configPath: "/virtual/config.json",
      credentialsPath: "/virtual/credentials.json",
      readTextFile: async () => configJson,
      readCredentialsTextFile: async () => credentialsJson,
    });

    expect(config.provider.apiKey).toBe("stored-credential-secret");
  });

  it("lets KFC_API_KEY override credentials.json without reading the file", async () => {
    const readCredentialsTextFile = vi.fn(async () => credentialsJson);
    const config = await loadConfig({
      env: { KFC_API_KEY: "environment-secret" },
      configPath: "/virtual/config.json",
      credentialsPath: "/virtual/credentials.json",
      readTextFile: async () => configJson,
      readCredentialsTextFile,
    });

    expect(config.provider.apiKey).toBe("environment-secret");
    expect(readCredentialsTextFile).not.toHaveBeenCalled();
  });

  it("rejects credentials bound to a different Provider Base URL", async () => {
    await expect(
      loadConfig({
        env: {},
        configPath: "/virtual/config.json",
        credentialsPath: "/virtual/credentials.json",
        readTextFile: async () => configJson,
        readCredentialsTextFile: async () =>
          JSON.stringify({
            provider: {
              baseUrl: "https://other.example/v1",
              apiKey: "wrong-provider-secret",
            },
          }),
      }),
    ).rejects.toMatchObject({
      code: "CONFIG_INVALID",
      issues: [
        {
          path: "provider.apiKey",
          message: "Stored credentials do not match Provider base URL",
        },
      ],
    });
  });

  it("rejects malformed credentials without leaking the stored value", async () => {
    const secret = "credential-must-not-leak";
    try {
      await loadConfig({
        env: {},
        configPath: "/virtual/config.json",
        credentialsPath: "/virtual/credentials.json",
        readTextFile: async () => configJson,
        readCredentialsTextFile: async () =>
          JSON.stringify({ provider: { apiKey: secret } }),
      });
      throw new Error("Expected credentials loading to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "CREDENTIALS_FILE_INVALID" });
      expect(JSON.stringify(error)).not.toContain(secret);
      expect(String(error)).not.toContain(secret);
    }
  });
});
