import type { ToolDefinition } from "../define-tool.js";
import { ToolRegistryError } from "../tool-registry-error.js";
import { createGrepTool } from "./grep-tool.js";
import { createListDirectoryTool } from "./list-directory-tool.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { createReadFileTool } from "./read-file-tool.js";
import { WorkspaceBoundary } from "./workspace-boundary.js";

function validLimits(limits: ReadOnlyToolLimits): boolean {
  return (
    Object.values(limits).every(
      (value) => Number.isInteger(value) && value > 0,
    ) &&
    limits.defaultListEntries <= limits.maxListEntries &&
    limits.defaultReadLines <= limits.maxReadLines &&
    limits.defaultSearchResults <= limits.maxSearchResults
  );
}

export async function createReadOnlyWorkspaceTools(options: {
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
    createReadFileTool(boundary, limits),
    createGrepTool(boundary, limits),
  ];
}
