import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  ToolRegistry,
  UserInterruptedError,
  createReadOnlyWorkspaceTools,
} from "../../../src/index.js";
const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
it("creates three registry-compatible tools in stable order and preserves cancellation", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "kfc-tools-"));
  roots.push(root);
  const tools = await createReadOnlyWorkspaceTools({ workspaceRoot: root });
  const registry = new ToolRegistry(tools);
  expect(registry.list().map((tool) => tool.name)).toEqual([
    "list_directory",
    "read_file",
    "grep",
  ]);
  expect(registry.listModelDefinitions().map((tool) => tool.name)).toEqual([
    "list_directory",
    "read_file",
    "grep",
  ]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    registry.execute(
      { id: "c", name: "list_directory", input: {} },
      { signal: controller.signal },
    ),
  ).rejects.toBeInstanceOf(UserInterruptedError);
});
