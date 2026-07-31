import { describe, expect, it } from "vitest";

import { ProviderError } from "../../src/errors/provider-error.js";

const cases = [
  ["PROVIDER_AUTHENTICATION_FAILED", false],
  ["PROVIDER_QUOTA_EXCEEDED", false],
  ["PROVIDER_RATE_LIMITED", true],
  ["PROVIDER_TIMEOUT", true],
  ["PROVIDER_CONTEXT_LIMIT", false],
  ["PROVIDER_SERVICE_UNAVAILABLE", true],
  ["PROVIDER_INVALID_RESPONSE", false],
] as const;

describe("ProviderError", () => {
  it.each(cases)("maps %s to retryable=%s", (code, retryable) => {
    const error = new ProviderError(code, "Safe provider failure");

    expect(error).toMatchObject({
      category: "provider",
      code,
      exitCode: 3,
      retryable,
    });
  });
});
