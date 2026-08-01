import { readdir, stat } from "node:fs/promises";
import { z } from "zod";
import { defineTool, type ToolDefinition } from "../define-tool.js";
import type { WorkspaceBoundary } from "./workspace-boundary.js";
import { WorkspaceError } from "./workspace-error.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { throwIfAborted, workspaceFailure } from "./tool-result.js";

export function createListDirectoryTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  return defineTool({
    name: "list_directory",
    description: "List one directory level inside the workspace",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Workspace-relative directory path",
        },
        limit: { type: "integer", minimum: 1, maximum: limits.maxListEntries },
      },
      additionalProperties: false,
    },
    inputSchema: z.object({
      path: z.string().default("."),
      limit: z
        .number()
        .int()
        .positive()
        .max(limits.maxListEntries)
        .default(limits.defaultListEntries),
    }),
    async execute(input, options) {
      try {
        throwIfAborted(options.signal);
        const target = await boundary.resolveExisting(input.path);
        throwIfAborted(options.signal);
        if (!(await stat(target.absolutePath)).isDirectory()) {
          throw new WorkspaceError("NOT_A_DIRECTORY", input.path);
        }
        const dirents = await readdir(target.absolutePath, {
          withFileTypes: true,
        });
        throwIfAborted(options.signal);
        const entries = dirents
          .filter((entry) => entry.name !== ".git")
          .map((entry) => ({
            name: entry.name,
            type: entry.isFile()
              ? "file"
              : entry.isDirectory()
                ? "directory"
                : entry.isSymbolicLink()
                  ? "symlink"
                  : "other",
          }))
          .sort((left, right) =>
            left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
          );
        return {
          content: JSON.stringify({
            path: target.relativePath,
            entries: entries.slice(0, input.limit),
            truncated: entries.length > input.limit,
          }),
          isError: false,
        };
      } catch (error) {
        if (error instanceof WorkspaceError) return workspaceFailure(error);
        throw error;
      }
    },
  });
}
