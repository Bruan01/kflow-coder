import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceBoundary } from "../../../src/index.js";

const roots: string[] = [];

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("WorkspaceBoundary", () => {
  it("resolves canonical in-workspace targets and internal symlinks", async () => {
    const root = await tempRoot("kfc-workspace-");
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "src", "index.ts"), "export {};\n");
    await symlink("src/index.ts", resolve(root, "alias.ts"));
    const boundary = await WorkspaceBoundary.create(root);
    const canonicalFile = await realpath(resolve(root, "src", "index.ts"));

    await expect(boundary.resolveExisting(".")).resolves.toMatchObject({
      relativePath: ".",
    });
    await expect(boundary.resolveExisting("src/index.ts")).resolves.toEqual({
      absolutePath: canonicalFile,
      relativePath: "src/index.ts",
    });
    await expect(boundary.resolveExisting("alias.ts")).resolves.toEqual({
      absolutePath: canonicalFile,
      relativePath: "src/index.ts",
    });
  });

  it.each([
    ["absolute", "/etc/passwd", "WORKSPACE_PATH_INVALID"],
    ["parent traversal", "../outside", "WORKSPACE_PATH_INVALID"],
    ["nested traversal", "src/../secret", "WORKSPACE_PATH_INVALID"],
    ["backslash", "src\\index.ts", "WORKSPACE_PATH_INVALID"],
    ["NUL", "src/\0index.ts", "WORKSPACE_PATH_INVALID"],
    ["git internals", ".git/config", "WORKSPACE_PATH_INVALID"],
    ["missing", "missing.txt", "PATH_NOT_FOUND"],
  ])("rejects %s paths safely", async (_label, path, code) => {
    const root = await tempRoot("kfc-workspace-invalid-");
    const boundary = await WorkspaceBoundary.create(root);

    await expect(boundary.resolveExisting(path)).rejects.toMatchObject({
      code,
      path,
    });
  });

  it("rejects a symlink whose canonical target leaves the workspace", async () => {
    const root = await tempRoot("kfc-workspace-root-");
    const outside = await tempRoot("kfc-workspace-outside-");
    await writeFile(resolve(outside, "secret.txt"), "secret\n");
    await symlink(resolve(outside, "secret.txt"), resolve(root, "escape.txt"));
    const boundary = await WorkspaceBoundary.create(root);

    await expect(boundary.resolveExisting("escape.txt")).rejects.toMatchObject({
      code: "WORKSPACE_PATH_OUTSIDE",
      path: "escape.txt",
    });
  });
});
