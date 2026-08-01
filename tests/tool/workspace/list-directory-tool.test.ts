import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ToolRegistry,
  WorkspaceBoundary,
  createListDirectoryTool,
} from "../../../src/index.js";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function setup() {
  const root = await mkdtemp(resolve(tmpdir(), "kfc-list-"));
  roots.push(root);
  await writeFile(resolve(root, "b.txt"), "b");
  await writeFile(resolve(root, "a.txt"), "a");
  await mkdir(resolve(root, "dir"));
  await mkdir(resolve(root, ".git"));
  await symlink("a.txt", resolve(root, "link"));
  const boundary = await WorkspaceBoundary.create(root);
  return {
    root,
    registry: new ToolRegistry([createListDirectoryTool(boundary)]),
  };
}

describe("list_directory", () => {
  it("returns sorted typed entries, hides .git, and reports truncation", async () => {
    const { registry } = await setup();
    const result = await registry.execute({
      id: "call",
      name: "list_directory",
      input: { path: ".", limit: 3 },
    });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content)).toEqual({
      path: ".",
      entries: [
        { name: "a.txt", type: "file" },
        { name: "b.txt", type: "file" },
        { name: "dir", type: "directory" },
      ],
      truncated: true,
    });
  });

  it("returns a safe error for a non-directory", async () => {
    const { registry } = await setup();
    const result = await registry.execute({
      id: "call",
      name: "list_directory",
      input: { path: "a.txt" },
    });
    expect(JSON.parse(result.content)).toEqual({
      error: { code: "NOT_A_DIRECTORY", path: "a.txt" },
    });
  });
});
