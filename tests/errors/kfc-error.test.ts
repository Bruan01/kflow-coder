import { describe, expect, it } from "vitest";

import { ConfigError } from "../../src/config/config.js";
import { KfcError } from "../../src/errors/kfc-error.js";
import { UserInterruptedError } from "../../src/errors/user-interrupted-error.js";

describe("KfcError", () => {
  it("serializes only public error information", () => {
    const error = new KfcError({
      category: "internal",
      code: "INTERNAL_ERROR",
      message: "Unexpected internal error",
      exitCode: 1,
      retryable: false,
      details: { operation: "test" },
      debugDetails: { apiKey: "must-not-leak", requestId: "req-1" },
      cause: new Error("private cause message"),
    });

    const serialized = JSON.stringify(error);

    expect(serialized).toContain("INTERNAL_ERROR");
    expect(serialized).toContain("operation");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("private cause message");
    expect(serialized).not.toContain("stack");
  });

  it("makes ConfigError part of the unified error hierarchy", () => {
    const error = new ConfigError(
      "CONFIG_INVALID",
      "Configuration is invalid",
      [{ path: "provider.model", message: "Provider model is required" }],
    );

    expect(error).toBeInstanceOf(KfcError);
    expect(error).toMatchObject({
      category: "config",
      exitCode: 2,
      retryable: false,
    });
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      details: {
        issues: [
          { path: "provider.model", message: "Provider model is required" },
        ],
      },
    });
  });

  it("uses the conventional interrupt exit code", () => {
    expect(new UserInterruptedError()).toMatchObject({
      category: "user_interrupted",
      code: "USER_INTERRUPTED",
      exitCode: 130,
      retryable: false,
    });
  });
});
