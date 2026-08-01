import type { ToolDefinition } from "../define-tool.js";
import { ToolRegistryError } from "../tool-registry-error.js";
import { createApplyPatchTool } from "./apply-patch-tool.js";
import { createGrepTool } from "./grep-tool.js";
import { createGitDiffTool } from "./git-diff-tool.js";
import { createFindFilesTool } from "./find-files-tool.js";
import { createListDirectoryTool } from "./list-directory-tool.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { createReadFileTool } from "./read-file-tool.js";
import { createShellTool } from "./shell-tool.js";
import { WorkspaceBoundary } from "./workspace-boundary.js";
import { createWriteFileTool } from "./write-file-tool.js";

function validLimits(limits: ReadOnlyToolLimits): boolean {
  const maxCommandTimeoutMs =
    limits.maxCommandTimeoutMs ??
    defaultReadOnlyToolLimits.maxCommandTimeoutMs!;
  const defaultCommandTimeoutMs =
    limits.defaultCommandTimeoutMs ??
    defaultReadOnlyToolLimits.defaultCommandTimeoutMs!;
  return (
    Object.values(limits).every(
      (value) => value === undefined || (Number.isInteger(value) && value > 0),
    ) &&
    limits.defaultListEntries <= limits.maxListEntries &&
    limits.defaultReadLines <= limits.maxReadLines &&
    limits.defaultSearchResults <= limits.maxSearchResults &&
    defaultCommandTimeoutMs <= maxCommandTimeoutMs &&
    defaultCommandTimeoutMs >= 1000 &&
    (limits.maxGitDiffFiles === undefined || limits.maxGitDiffFiles > 0)
  );
}

export async function createWorkspaceTools(options: {
  readonly workspaceRoot: string;
  readonly limits?: ReadOnlyToolLimits;
}): Promise<readonly ToolDefinition[]> {
  const limits = options.limits ?? defaultReadOnlyToolLimits;
  if (!validLimits(limits)) {
    throw new ToolRegistryError(
      "TOOL_DEFINITION_INVALID",
      "Read-only tool limits are invalid",
    );
  }
  const boundary = await WorkspaceBoundary.create(options.workspaceRoot, {
    maxPathLength: limits.maxPathLength,
  });
  return [
    createListDirectoryTool(boundary, limits),
    createFindFilesTool(boundary, limits),
    createReadFileTool(boundary, limits),
    createGrepTool(boundary, limits),
    await createGitDiffTool(boundary, limits),
    createApplyPatchTool(boundary, limits),
    createWriteFileTool(boundary, limits),
    createShellTool(boundary, limits),
  ];
}

export async function createReadOnlyWorkspaceTools(options: {
  readonly workspaceRoot: string;
  readonly limits?: ReadOnlyToolLimits;
}): Promise<readonly ToolDefinition[]> {
  const tools = await createWorkspaceTools(options);
  return tools.filter((tool) => (tool.capability ?? "read") === "read");
}
