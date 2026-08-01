import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeThemeAtomically } from "../../src/config/write-theme.js";

describe("writeThemeAtomically", () => {
  it("updates ui.theme without replacing the provider configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kfc-theme-test-"));
    const configPath = join(directory, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        provider: {
          protocol: "openai-chat-completions",
          baseUrl: "https://example.test/v1",
          model: "fixture-model",
          timeoutMs: 60000,
        },
      }),
    );

    await writeThemeAtomically(configPath, "nord");

    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      provider: {
        protocol: "openai-chat-completions",
        baseUrl: "https://example.test/v1",
        model: "fixture-model",
        timeoutMs: 60000,
      },
      ui: { theme: "nord" },
    });
  });
});
