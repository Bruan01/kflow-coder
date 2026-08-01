import { writeFile } from "node:fs/promises";
import { z } from "zod";

import { defineTool, type ToolDefinition } from "../define-tool.js";
import type { WorkspaceBoundary } from "./workspace-boundary.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { WorkspaceError } from "./workspace-error.js";
import { throwIfAborted, workspaceFailure } from "./tool-result.js";

export function createWriteFileTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  const maxPatchBytes =
    limits.maxPatchBytes ?? defaultReadOnlyToolLimits.maxPatchBytes!;
  return defineTool({
    name: "write_file",
    description:
      "Create a new UTF-8 text file inside the workspace without overwriting",
    capability: "edit",
    enabledByDefault: false,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Workspace-relative new file path",
        },
        content: {
          type: "string",
          maxLength: maxPatchBytes,
          description: "UTF-8 file content",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    inputSchema: z.object({
      path: z.string(),
      content: z.string().max(maxPatchBytes),
    }),
    async execute(input, options) {
      try {
        throwIfAborted(options.signal);
        const target = await boundary.resolveForWrite(input.path);
        const bytes = Buffer.byteLength(input.content, "utf8");
        if (bytes > limits.maxFileBytes) {
          throw new WorkspaceError("CONTENT_TOO_LARGE", input.path);
        }
        await writeFile(target.absolutePath, input.content, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o644,
        });
        throwIfAborted(options.signal);
        return {
          content: JSON.stringify({
            path: target.relativePath,
            bytesWritten: bytes,
            created: true,
            workspaceChange: "changed",
            recovery:
              "文件已经创建；如需恢复，请先运行 git_diff 并人工审查，不自动删除。",
          }),
          isError: false,
        };
      } catch (error) {
        if (error instanceof WorkspaceError)
          return workspaceFailure(error, {
            workspaceChange: "unchanged",
            recovery: "修改未写入工作区；请修正目标或补丁后重试，无需回滚。",
          });
        throw error;
      }
    },
  });
}
