import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ToolRegistry,
  WorkspaceBoundary,
  createGrepTool,
} from "../../../src/index.js";
const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
describe("grep", () => {
  it("searches deterministically and skips node_modules and symlinks", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "kfc-grep-"));
    roots.push(root);
    await mkdir(resolve(root, "src"));
    await mkdir(resolve(root, "node_modules"));
    await writeFile(
      resolve(root, "src", "b.ts"),
      "LoadConfig\nloadConfig twice loadConfig\n",
    );
    await writeFile(resolve(root, "src", "a.ts"), "loadConfig\n");
    await writeFile(resolve(root, "node_modules", "x.js"), "loadConfig\n");
    await symlink("../node_modules", resolve(root, "src", "link"));
    const registry = new ToolRegistry([
      createGrepTool(await WorkspaceBoundary.create(root)),
    ]);
    const result = await registry.execute({
      id: "c",
      name: "grep",
      input: {
        query: "loadConfig",
        path: ".",
        caseSensitive: false,
        maxResults: 2,
      },
    });
    expect(JSON.parse(result.content)).toEqual({
      query: "loadConfig",
      path: ".",
      matches: [
        { path: "src/a.ts", line: 1, preview: "loadConfig" },
        { path: "src/b.ts", line: 1, preview: "LoadConfig" },
      ],
      scannedFiles: 2,
      skippedFiles: 0,
      truncated: true,
    });
  });
});

it("skips binary and oversized files and enforces the scan limit", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "kfc-grep-limit-"));
  roots.push(root);
  await writeFile(resolve(root, "a.txt"), "needle\n");
  await writeFile(resolve(root, "b.bin"), Buffer.from([65, 0, 66]));
  await writeFile(resolve(root, "c.txt"), "x".repeat(20));
  const boundary = await WorkspaceBoundary.create(root);
  const limits = {
    maxPathLength: 1024,
    defaultListEntries: 2,
    maxListEntries: 3,
    defaultReadLines: 2,
    maxReadLines: 3,
    maxFileBytes: 10,
    defaultSearchResults: 5,
    maxSearchResults: 5,
    maxSearchFiles: 3,
    maxPreviewLength: 20,
  };
  const registry = new ToolRegistry([createGrepTool(boundary, limits)]);
  const result = await registry.execute({
    id: "c",
    name: "grep",
    input: { query: "needle" },
  });
  expect(JSON.parse(result.content)).toMatchObject({
    scannedFiles: 3,
    skippedFiles: 2,
    truncated: false,
  });
  const limited = new ToolRegistry([
    createGrepTool(boundary, { ...limits, maxSearchFiles: 1 }),
  ]);
  expect(
    JSON.parse(
      (
        await limited.execute({
          id: "c",
          name: "grep",
          input: { query: "needle" },
        })
      ).content,
    ).error.code,
  ).toBe("SEARCH_FILE_LIMIT_REACHED");
});
