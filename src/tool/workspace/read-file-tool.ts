import { readFile, stat } from "node:fs/promises";
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

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (/\r\n$|\n$|\r$/.test(text)) lines.pop();
  return lines;
}

export function createReadFileTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  return defineTool({
    name: "read_file",
    description: "Read a UTF-8 text file inside the workspace",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        offset: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1, maximum: limits.maxReadLines },
      },
      required: ["path"],
      additionalProperties: false,
    },
    inputSchema: z.object({
      path: z.string(),
      offset: z.number().int().positive().default(1),
      limit: z
        .number()
        .int()
        .positive()
        .max(limits.maxReadLines)
        .default(limits.defaultReadLines),
    }),
    async execute(input, options) {
      try {
        throwIfAborted(options.signal);
        const target = await boundary.resolveExisting(input.path);
        const fileStat = await stat(target.absolutePath);
        if (!fileStat.isFile())
          throw new WorkspaceError("NOT_A_FILE", input.path);
        if (fileStat.size > limits.maxFileBytes)
          throw new WorkspaceError("FILE_TOO_LARGE", input.path);
        const data = await readFile(target.absolutePath);
        throwIfAborted(options.signal);
        if (data.byteLength > limits.maxFileBytes)
          throw new WorkspaceError("FILE_TOO_LARGE", input.path);
        const lines = splitLines(decodeText(data, input.path));
        const selected = lines.slice(
          input.offset - 1,
          input.offset - 1 + input.limit,
        );
        return {
          content: JSON.stringify({
            path: target.relativePath,
            totalLines: lines.length,
            offset: input.offset,
            lines: selected.map((text, index) => ({
              number: input.offset + index,
              text,
            })),
            truncated: input.offset - 1 + selected.length < lines.length,
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
