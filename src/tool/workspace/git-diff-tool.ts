import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import { z } from "zod";

import { defineTool, type ToolDefinition } from "../define-tool.js";
import type { WorkspaceBoundary } from "./workspace-boundary.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { throwIfAborted } from "./tool-result.js";

const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 4 * 1024 * 1024;

type GitCommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

interface GitStatusEntry {
  readonly path: string;
  readonly index: string;
  readonly worktree: string;
}

interface NumstatEntry {
  readonly additions: number | undefined;
  readonly deletions: number | undefined;
}

interface GitBaseline {
  readonly available: boolean;
  readonly paths: ReadonlySet<string>;
}

interface DiffFile {
  readonly path: string;
  readonly status:
    | "added"
    | "deleted"
    | "modified"
    | "renamed"
    | "untracked"
    | "conflicted"
    | "unknown";
  readonly additions: number | undefined;
  readonly deletions: number | undefined;
  readonly staged: boolean;
  readonly unstaged: boolean;
  readonly preexisting: boolean;
  readonly newSinceSession: boolean;
}

function codeOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const value = (error as { readonly code?: unknown }).code;
  return typeof value === "number" ? value : undefined;
}

function outputOf(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return "";
  }
  const value = (error as { readonly [key: string]: unknown })[key];
  return typeof value === "string" ? value : "";
}

async function runGit(
  root: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<GitCommandResult> {
  throwIfAborted(signal);
  try {
    const result = await execFileAsync("git", [...args], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
      windowsHide: true,
      signal,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (signal?.aborted === true) throwIfAborted(signal);
    return {
      exitCode: codeOf(error) ?? 1,
      stdout: outputOf(error, "stdout"),
      stderr: outputOf(error, "stderr"),
    };
  }
}

function parseStatus(output: string): readonly GitStatusEntry[] {
  const tokens = output.split("\0");
  const entries: GitStatusEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.length < 4) continue;
    const status = token.slice(0, 2);
    let path = token.slice(3);
    if (
      (status[0] === "R" || status[0] === "C") &&
      tokens[index + 1] !== undefined
    ) {
      index += 1;
      path = tokens[index]!;
    }
    if (path !== "") {
      entries.push({ path, index: status[0]!, worktree: status[1]! });
    }
  }
  return entries;
}

function parseNumstat(output: string): ReadonlyMap<string, NumstatEntry> {
  const entries = new Map<string, NumstatEntry>();
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const path = parts.slice(2).join("\t");
    const additions = parts[0] === "-" ? undefined : Number(parts[0]);
    const deletions = parts[1] === "-" ? undefined : Number(parts[1]);
    if (
      path === "" ||
      (additions !== undefined && !Number.isInteger(additions)) ||
      (deletions !== undefined && !Number.isInteger(deletions))
    ) {
      continue;
    }
    entries.set(path, { additions, deletions });
  }
  return entries;
}

function statCount(
  entry: NumstatEntry | undefined,
  key: "additions" | "deletions",
): number | undefined {
  return entry === undefined ? 0 : entry[key];
}

function addCounts(
  first: number | undefined,
  second: number | undefined,
): number | undefined {
  if (first === undefined || second === undefined) return undefined;
  return first + second;
}

function statusFor(entry: GitStatusEntry): DiffFile["status"] {
  if (entry.index === "?" && entry.worktree === "?") return "untracked";
  if (entry.index === "U" || entry.worktree === "U") return "conflicted";
  if (entry.index === "A" || entry.worktree === "A") return "added";
  if (entry.index === "D" || entry.worktree === "D") return "deleted";
  if (entry.index === "R" || entry.worktree === "R") return "renamed";
  if (entry.index === "M" || entry.worktree === "M") return "modified";
  return "unknown";
}

async function captureBaseline(root: string): Promise<GitBaseline> {
  const repository = await runGit(root, ["rev-parse", "--show-toplevel"]);
  if (repository.exitCode !== 0) {
    return { available: false, paths: new Set() };
  }
  const status = await runGit(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--",
    ".",
  ]);
  return {
    available: status.exitCode === 0,
    paths: new Set(parseStatus(status.stdout).map((entry) => entry.path)),
  };
}

async function untrackedNumstat(
  root: string,
  path: string,
  signal: AbortSignal | undefined,
): Promise<NumstatEntry | undefined> {
  const result = await runGit(
    root,
    ["diff", "--no-index", "--numstat", "--no-prefix", "--", "/dev/null", path],
    signal,
  );
  return [...parseNumstat(result.stdout).values()][0];
}

function scopeArgs(path: string): readonly string[] {
  return ["--", path === "." ? "." : path];
}

async function collectDiff(
  root: string,
  path: string,
  baseline: GitBaseline,
  limits: ReadOnlyToolLimits,
  signal: AbortSignal | undefined,
): Promise<{
  readonly head: string | undefined;
  readonly files: readonly DiffFile[];
  readonly truncated: boolean;
}> {
  const maxFiles =
    limits.maxGitDiffFiles ?? defaultReadOnlyToolLimits.maxGitDiffFiles!;
  const [head, status, unstaged, staged] = await Promise.all([
    runGit(root, ["rev-parse", "--short", "HEAD"], signal),
    runGit(
      root,
      [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        ...scopeArgs(path),
      ],
      signal,
    ),
    runGit(
      root,
      ["diff", "--numstat", "--no-renames", "--no-prefix", ...scopeArgs(path)],
      signal,
    ),
    runGit(
      root,
      [
        "diff",
        "--cached",
        "--numstat",
        "--no-renames",
        "--no-prefix",
        ...scopeArgs(path),
      ],
      signal,
    ),
  ]);
  throwIfAborted(signal);
  if (status.exitCode !== 0) {
    return { head: undefined, files: [], truncated: false };
  }
  const entries = parseStatus(status.stdout);
  const unstagedStats = parseNumstat(unstaged.stdout);
  const stagedStats = parseNumstat(staged.stdout);
  const files: DiffFile[] = [];
  for (const entry of entries.slice(0, maxFiles)) {
    const isUntracked = entry.index === "?" && entry.worktree === "?";
    const untrackedStats = isUntracked
      ? await untrackedNumstat(root, entry.path, signal)
      : undefined;
    const unstagedStat = unstagedStats.get(entry.path);
    const stagedStat = stagedStats.get(entry.path);
    const additions = isUntracked
      ? untrackedStats?.additions
      : addCounts(
          statCount(unstagedStat, "additions"),
          statCount(stagedStat, "additions"),
        );
    const deletions = isUntracked
      ? untrackedStats?.deletions
      : addCounts(
          statCount(unstagedStat, "deletions"),
          statCount(stagedStat, "deletions"),
        );
    const preexisting = baseline.paths.has(entry.path);
    files.push({
      path: entry.path,
      status: statusFor(entry),
      additions,
      deletions,
      staged: !isUntracked && entry.index !== " ",
      unstaged: !isUntracked && entry.worktree !== " ",
      preexisting,
      newSinceSession: !preexisting,
    });
  }
  return {
    head:
      head.exitCode === 0 && head.stdout.trim() !== ""
        ? head.stdout.trim()
        : undefined,
    files,
    truncated: entries.length > maxFiles,
  };
}

function summaryOf(files: readonly DiffFile[]): {
  readonly files: number;
  readonly additions: number | undefined;
  readonly deletions: number | undefined;
  readonly stagedFiles: number;
  readonly unstagedFiles: number;
  readonly untrackedFiles: number;
  readonly preexistingFiles: number;
  readonly sessionFiles: number;
} {
  const knownAdditions = files.every((file) => file.additions !== undefined);
  const knownDeletions = files.every((file) => file.deletions !== undefined);
  return {
    files: files.length,
    additions: knownAdditions
      ? files.reduce((total, file) => total + (file.additions ?? 0), 0)
      : undefined,
    deletions: knownDeletions
      ? files.reduce((total, file) => total + (file.deletions ?? 0), 0)
      : undefined,
    stagedFiles: files.filter((file) => file.staged).length,
    unstagedFiles: files.filter((file) => file.unstaged).length,
    untrackedFiles: files.filter((file) => file.status === "untracked").length,
    preexistingFiles: files.filter((file) => file.preexisting).length,
    sessionFiles: files.filter((file) => file.newSinceSession).length,
  };
}

export async function createGitDiffTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): Promise<ToolDefinition> {
  const root = (await boundary.resolveExisting(".")).absolutePath;
  const baseline = await captureBaseline(root);
  return defineTool({
    name: "git_diff",
    description:
      "Inspect safe Git workspace changes with file summaries, line counts, and session baseline information without returning full diff content",
    capability: "read",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Workspace-relative file or directory to inspect",
        },
      },
      additionalProperties: false,
    },
    inputSchema: z.object({ path: z.string().default(".") }),
    async execute(input, options) {
      throwIfAborted(options.signal);
      const target = await boundary.resolveExisting(input.path);
      await stat(target.absolutePath);
      const scope = target.relativePath;
      if (!baseline.available) {
        return {
          content: JSON.stringify({
            error: {
              code: "GIT_REPOSITORY_NOT_FOUND",
              path: scope,
            },
            workspaceChange: "unchanged",
            recovery: "当前工作区不是 Git 仓库；没有可执行的 Git 回滚操作。",
          }),
          isError: true,
        };
      }
      const result = await collectDiff(
        root,
        scope,
        baseline,
        limits,
        options.signal,
      );
      const summary = summaryOf(result.files);
      return {
        content: JSON.stringify({
          path: scope,
          head: result.head,
          clean: result.files.length === 0,
          baseline: "session-start",
          summary,
          files: result.files,
          truncated: result.truncated,
          workspaceChange: "unchanged",
          recovery:
            "这是只读检查；不会修改工作区。若要恢复修改，请先人工审查此摘要，不自动执行 reset 或 checkout。",
        }),
        isError: false,
      };
    },
  });
}
