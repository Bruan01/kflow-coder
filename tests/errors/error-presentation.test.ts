import { describe, expect, it } from "vitest";

import { ConfigError } from "../../src/config/config.js";
import {
  formatErrorForCli,
  normalizeUnknownError,
} from "../../src/errors/error-presentation.js";
import { KfcError } from "../../src/errors/kfc-error.js";

describe("formatErrorForCli", () => {
  it("shows safe config issues without debug internals", () => {
    const error = new ConfigError(
      "CONFIG_INVALID",
      "Configuration is incomplete or invalid",
      [{ path: "provider.apiKey", message: "KFC_API_KEY is required" }],
    );

    expect(formatErrorForCli(error)).toEqual({
      exitCode: 2,
      text:
        "Error [CONFIG_INVALID]: Configuration is incomplete or invalid\n" +
        "  - provider.apiKey: KFC_API_KEY is required\n",
    });
  });

  it("redacts sensitive debug keys while retaining safe diagnostics", () => {
    const error = new KfcError({
      category: "provider",
      code: "PROVIDER_TIMEOUT",
      message: "Provider request timed out",
      exitCode: 3,
      retryable: true,
      debugDetails: {
        requestId: "req-123",
        apiKey: "secret-api-key",
        nested: {
          authorization: "Bearer secret-token",
          attempt: 2,
        },
      },
    });

    const presentation = formatErrorForCli(error, { debug: true });

    expect(presentation.exitCode).toBe(3);
    expect(presentation.text).toContain("requestId");
    expect(presentation.text).toContain("req-123");
    expect(presentation.text).toContain("[REDACTED]");
    expect(presentation.text).not.toContain("secret-api-key");
    expect(presentation.text).not.toContain("secret-token");
  });

  it("normalizes unknown errors without exposing their message or stack", () => {
    const normalized = normalizeUnknownError(
      new Error("Authorization: Bearer secret-unknown-value"),
    );
    const presentation = formatErrorForCli(normalized, { debug: true });

    expect(normalized).toMatchObject({
      code: "INTERNAL_ERROR",
      category: "internal",
      exitCode: 1,
    });
    expect(presentation.text).toContain("Unexpected internal error");
    expect(presentation.text).not.toContain("secret-unknown-value");
    expect(presentation.text).not.toContain("at ");
  });
});
