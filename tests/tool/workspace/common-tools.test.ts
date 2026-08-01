import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ToolRegistry, createWorkspaceTools } from "../../../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function createRegistry(): Promise<{
  readonly root: string;
  readonly registry: ToolRegistry;
}> {
  const root = await mkdtemp(resolve(tmpdir(), "kfc-common-tools-"));
  roots.push(root);
  const registry = new ToolRegistry(
    await createWorkspaceTools({ workspaceRoot: root }),
  );
  return { root, registry };
}

describe("common workspace tools", () => {
  it("registers the common surface with read-only tools enabled by default", async () => {
    const { registry } = await createRegistry();

    expect(registry.listToolStatuses()).toEqual([
      {
        name: "list_directory",
        description: "List one directory level inside the workspace",
        capability: "read",
        enabled: true,
      },
      {
        name: "find_files",
        description: "Find workspace files using a bounded glob pattern",
        capability: "read",
        enabled: true,
      },
      {
        name: "read_file",
        description: "Read a UTF-8 text file inside the workspace",
        capability: "read",
        enabled: true,
      },
      {
        name: "grep",
        description: "Search for a fixed string in workspace text files",
        capability: "read",
        enabled: true,
      },
      {
        name: "git_diff",
        description:
          "Inspect safe Git workspace changes with file summaries, line counts, and session baseline information without returning full diff content",
        capability: "read",
        enabled: true,
      },
      {
        name: "apply_patch",
        description:
          "Apply one exact text replacement inside an existing workspace file",
        capability: "edit",
        enabled: false,
      },
      {
        name: "write_file",
        description:
          "Create a new UTF-8 text file inside the workspace without overwriting",
        capability: "edit",
        enabled: false,
      },
      {
        name: "shell",
        description:
          "Run one shell command from a workspace directory with bounded output and timeout",
        capability: "execute",
        enabled: false,
      },
    ]);
    expect(registry.listModelDefinitions().map((tool) => tool.name)).toEqual([
      "list_directory",
      "find_files",
      "read_file",
      "grep",
      "git_diff",
    ]);
  });

  it("finds files by glob while skipping dependency and git directories", async () => {
    const { root, registry } = await createRegistry();
    await mkdir(resolve(root, "src"));
    await mkdir(resolve(root, "node_modules"));
    await mkdir(resolve(root, ".git"));
    await writeFile(resolve(root, "src", "index.ts"), "export {};");
    await writeFile(resolve(root, "src", "index.test.ts"), "test");
    await writeFile(resolve(root, "node_modules", "ignored.ts"), "ignored");
    await writeFile(resolve(root, ".git", "ignored.ts"), "ignored");

    const result = await registry.execute({
      id: "find",
      name: "find_files",
      input: { pattern: "**/*.ts" },
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content).files).toEqual([
      "src/index.test.ts",
      "src/index.ts",
    ]);
  });

  it("requires explicit edit enablement and applies unique patches safely", async () => {
    const { root, registry } = await createRegistry();
    const path = resolve(root, "file.txt");
    await writeFile(path, "before\n");

    await expect(
      registry.execute({
        id: "disabled",
        name: "apply_patch",
        input: { path: "file.txt", oldText: "before", newText: "after" },
      }),
    ).resolves.toMatchObject({ isError: true });
    registry.setEnabled("apply_patch", true);

    await expect(
      registry.execute({
        id: "patch",
        name: "apply_patch",
        input: { path: "file.txt", oldText: "before", newText: "after" },
      }),
    ).resolves.toMatchObject({ isError: false });
    await expect(readFile(path, "utf8")).resolves.toBe("after\n");

    const ambiguous = await registry.execute({
      id: "ambiguous",
      name: "apply_patch",
      input: { path: "file.txt", oldText: "after", newText: "after\nafter" },
    });
    const missing = await registry.execute({
      id: "missing",
      name: "apply_patch",
      input: { path: "file.txt", oldText: "missing", newText: "changed" },
    });
    expect(JSON.parse(missing.content)).toMatchObject({
      error: { code: "PATCH_NOT_FOUND", path: "file.txt" },
      workspaceChange: "unchanged",
    });
    expect(ambiguous.isError).toBe(false);
  });

  it("creates files without allowing overwrite and runs bounded shell output only when enabled", async () => {
    const { root, registry } = await createRegistry();
    const disabled = await registry.execute({
      id: "write-disabled",
      name: "write_file",
      input: { path: "new.txt", content: "hello" },
    });
    expect(JSON.parse(disabled.content).error.code).toBe("TOOL_DISABLED");

    registry.setEnabled("write_file", true);
    await expect(
      registry.execute({
        id: "write",
        name: "write_file",
        input: { path: "new.txt", content: "hello" },
      }),
    ).resolves.toMatchObject({ isError: false });
    await expect(readFile(resolve(root, "new.txt"), "utf8")).resolves.toBe(
      "hello",
    );

    const overwrite = await registry.execute({
      id: "overwrite",
      name: "write_file",
      input: { path: "new.txt", content: "changed" },
    });
    expect(JSON.parse(overwrite.content)).toMatchObject({
      error: { code: "PATH_ALREADY_EXISTS", path: "new.txt" },
      workspaceChange: "unchanged",
    });

    registry.setEnabled("shell", true);
    const shell = await registry.execute({
      id: "shell",
      name: "shell",
      input: { command: "printf 123456", maxOutputChars: 3 },
    });
    expect(shell.isError).toBe(true);
    expect(JSON.parse(shell.content)).toMatchObject({
      stdout: "123",
      truncated: true,
      exitCode: 0,
    });
  });
});
