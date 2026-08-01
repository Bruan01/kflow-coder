import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  ToolRegistry,
  createGitDiffTool,
  createWorkspaceTools,
  WorkspaceBoundary,
} from "../../../src/index.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function git(root: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", [...args], { cwd: root });
}

async function committedRepository(): Promise<string> {
  const root = await mkdtemp(`${tmpdir()}/kfc-git-diff-`);
  roots.push(root);
  await git(root, ["init", "-q"]);
  await writeFile(`${root}/tracked.txt`, "before\n");
  await git(root, ["add", "tracked.txt"]);
  await git(root, [
    "-c",
    "user.name=KFC Test",
    "-c",
    "user.email=kfc@example.test",
    "commit",
    "-qm",
    "initial",
  ]);
  return root;
}

describe("git_diff", () => {
  it("reports tracked, untracked, and pre-existing changes without full content", async () => {
    const root = await committedRepository();
    await writeFile(`${root}/preexisting.txt`, "keep\n");
    const registry = new ToolRegistry(
      await createWorkspaceTools({ workspaceRoot: root }),
    );

    await writeFile(`${root}/tracked.txt`, "before\nafter\n");
    await writeFile(`${root}/new.txt`, "new line\n");

    const result = await registry.execute({
      id: "diff",
      name: "git_diff",
      input: {},
    });
    expect(result.isError).toBe(false);
    const content = JSON.parse(result.content) as {
      readonly clean: boolean;
      readonly summary: {
        readonly files: number;
        readonly additions: number;
        readonly deletions: number;
        readonly untrackedFiles: number;
        readonly preexistingFiles: number;
        readonly sessionFiles: number;
      };
      readonly files: readonly {
        readonly path: string;
        readonly status: string;
        readonly preexisting: boolean;
        readonly newSinceSession: boolean;
      }[];
    };

    expect(content.clean).toBe(false);
    expect(content.summary).toMatchObject({
      files: 3,
      additions: 3,
      deletions: 0,
      untrackedFiles: 2,
      preexistingFiles: 1,
      sessionFiles: 2,
    });
    expect(content.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "tracked.txt",
          status: "modified",
          preexisting: false,
          newSinceSession: true,
        }),
        expect.objectContaining({
          path: "preexisting.txt",
          status: "untracked",
          preexisting: true,
          newSinceSession: false,
        }),
        expect.objectContaining({
          path: "new.txt",
          status: "untracked",
          preexisting: false,
          newSinceSession: true,
        }),
      ]),
    );
    expect(result.content).not.toContain("before\\nafter");
  });

  it("returns a safe explanation outside a Git repository", async () => {
    const root = await mkdtemp(`${tmpdir()}/kfc-no-git-`);
    roots.push(root);
    const tool = await createGitDiffTool(await WorkspaceBoundary.create(root));
    const result = await new ToolRegistry([tool]).execute({
      id: "diff",
      name: "git_diff",
      input: {},
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content)).toMatchObject({
      error: { code: "GIT_REPOSITORY_NOT_FOUND" },
      workspaceChange: "unchanged",
    });
  });
});
