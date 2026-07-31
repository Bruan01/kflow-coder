import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeConfigAtomically } from "../../src/quickstart/write-config.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("writeConfigAtomically", () => {
  it("creates parent directories and writes a private non-secret JSON file", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "kfc-quickstart-"));
    roots.push(root);
    const path = resolve(root, "nested", "config.json");

    await writeConfigAtomically(path, {
      provider: {
        type: "openai-compatible",
        protocol: "openai-chat-completions",
        baseUrl: "https://custom.example/v1",
        model: "custom-model",
        timeoutMs: 60000,
      },
    });

    const content = await readFile(path, "utf8");
    expect(JSON.parse(content)).toEqual({
      provider: {
        type: "openai-compatible",
        protocol: "openai-chat-completions",
        baseUrl: "https://custom.example/v1",
        model: "custom-model",
        timeoutMs: 60000,
      },
    });
    expect(content).not.toContain("apiKey");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(
      (await readdir(resolve(root, "nested"))).filter((name) =>
        name.endsWith(".tmp"),
      ),
    ).toEqual([]);
  });

  it("rejects API keys and does not create a file", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "kfc-quickstart-"));
    roots.push(root);
    const path = resolve(root, "config.json");

    await expect(
      writeConfigAtomically(path, {
        provider: {
          type: "openai-compatible",
          protocol: "openai-chat-completions",
          baseUrl: "https://custom.example/v1",
          model: "custom-model",
          timeoutMs: 60000,
          apiKey: "must-not-write",
        },
      }),
    ).rejects.toThrow();
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
