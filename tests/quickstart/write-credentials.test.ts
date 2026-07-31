import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeCredentialsAtomically } from "../../src/quickstart/write-credentials.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("writeCredentialsAtomically", () => {
  it("writes a Base-URL-bound API Key with mode 0600", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "kfc-credentials-"));
    roots.push(root);
    const path = resolve(root, "nested", "credentials.json");

    await writeCredentialsAtomically(path, {
      provider: {
        baseUrl: "https://custom.example/v1",
        apiKey: "plaintext-test-secret",
      },
    });

    const content = await readFile(path, "utf8");
    expect(JSON.parse(content)).toEqual({
      provider: {
        baseUrl: "https://custom.example/v1",
        apiKey: "plaintext-test-secret",
      },
    });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(
      (await readdir(resolve(root, "nested"))).filter((name) =>
        name.endsWith(".tmp"),
      ),
    ).toEqual([]);
  });
});
