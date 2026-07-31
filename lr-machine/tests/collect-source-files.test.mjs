import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectSourceFiles,
  MAX_SOURCE_LINES,
} from "../lib/collect-source-files.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function createRoot() {
  const root = await mkdtemp(resolve(tmpdir(), "lr-machine-source-"));
  temporaryRoots.push(root);
  await mkdir(resolve(root, "src", "cli"), { recursive: true });
  return root;
}

describe("collectSourceFiles", () => {
  it("collects only TypeScript source files using relative paths", async () => {
    const root = await createRoot();
    await writeFile(
      resolve(root, "src", "cli.ts"),
      "export const cli = true;\n",
    );
    await writeFile(
      resolve(root, "src", "ignored.js"),
      "export const ignored = true;\n",
    );
    await writeFile(resolve(root, "secret.txt"), "secret");
    await symlink(
      resolve(root, "secret.txt"),
      resolve(root, "src", "secret.ts"),
    );

    const result = await collectSourceFiles(root);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      path: "src/cli.ts",
      group: "CLI 执行链",
      truncated: false,
    });
    expect(result[0].content).toContain("export const cli");
    expect(JSON.stringify(result)).not.toContain(root);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("truncates oversized files and reports the original line count", async () => {
    const root = await createRoot();
    const lines = Array.from(
      { length: MAX_SOURCE_LINES + 20 },
      (_, index) => `export const line${index} = ${index};`,
    );
    await writeFile(resolve(root, "src", "large.ts"), lines.join("\n"));

    const [result] = await collectSourceFiles(root);

    expect(result.truncated).toBe(true);
    expect(result.shownLineCount).toBe(MAX_SOURCE_LINES);
    expect(result.lineCount).toBe(MAX_SOURCE_LINES + 20);
  });
});
