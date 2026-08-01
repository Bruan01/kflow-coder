import { randomUUID } from "node:crypto";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { z } from "zod";

import { defineTool, type ToolDefinition } from "../define-tool.js";
import type { WorkspaceBoundary } from "./workspace-boundary.js";
import { WorkspaceError } from "./workspace-error.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { throwIfAborted, workspaceFailure } from "./tool-result.js";

function decodeText(data: Uint8Array, path: string): string {
  if (data.includes(0)) throw new WorkspaceError("BINARY_FILE", path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new WorkspaceError("BINARY_FILE", path);
  }
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

async function writeAtomically(
  path: string,
  content: string,
  mode: number,
): Promise<void> {
  const directory = dirname(path);
  const temporaryPath = resolve(
    directory,
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, content, {
      encoding: "utf8",
      flag: "wx",
      mode,
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export function createApplyPatchTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  const maxPatchBytes =
    limits.maxPatchBytes ?? defaultReadOnlyToolLimits.maxPatchBytes!;
  return defineTool({
    name: "apply_patch",
    description:
      "Apply one exact text replacement inside an existing workspace file",
    capability: "edit",
    enabledByDefault: false,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        oldText: {
          type: "string",
          minLength: 1,
          maxLength: maxPatchBytes,
          description: "Exact text that must occur once in the file",
        },
        newText: {
          type: "string",
          maxLength: maxPatchBytes,
          description: "Replacement text; may be empty",
        },
      },
      required: ["path", "oldText", "newText"],
      additionalProperties: false,
    },
    inputSchema: z.object({
      path: z.string(),
      oldText: z.string().min(1).max(maxPatchBytes),
      newText: z.string().max(maxPatchBytes),
    }),
    async execute(input, options) {
      try {
        throwIfAborted(options.signal);
        const target = await boundary.resolveExisting(input.path);
        const fileStat = await stat(target.absolutePath);
        if (!fileStat.isFile()) {
          throw new WorkspaceError("NOT_A_FILE", input.path);
        }
        if (fileStat.size > limits.maxFileBytes) {
          throw new WorkspaceError("FILE_TOO_LARGE", input.path);
        }
        const original = decodeText(
          await readFile(target.absolutePath),
          input.path,
        );
        throwIfAborted(options.signal);
        const occurrences = countOccurrences(original, input.oldText);
        if (occurrences === 0) {
          throw new WorkspaceError("PATCH_NOT_FOUND", input.path);
        }
        if (occurrences !== 1) {
          throw new WorkspaceError("PATCH_AMBIGUOUS", input.path);
        }
        const next = original.replace(input.oldText, input.newText);
        const nextBytes = Buffer.byteLength(next, "utf8");
        if (nextBytes > limits.maxFileBytes) {
          throw new WorkspaceError("CONTENT_TOO_LARGE", input.path);
        }
        await writeAtomically(target.absolutePath, next, fileStat.mode & 0o777);
        return {
          content: JSON.stringify({
            path: target.relativePath,
            replacements: 1,
            bytesWritten: nextBytes,
            workspaceChange: "changed",
            recovery:
              "文件已经修改；如需恢复，请先运行 git_diff 并人工审查，不自动回滚。",
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
