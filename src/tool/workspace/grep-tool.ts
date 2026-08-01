import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { defineTool, type ToolDefinition } from "../define-tool.js";
import type { WorkspaceBoundary } from "./workspace-boundary.js";
import { WorkspaceError } from "./workspace-error.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { throwIfAborted, workspaceFailure } from "./tool-result.js";

function decode(data: Uint8Array): string | null {
  if (data.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return null;
  }
}

export function createGrepTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  return defineTool({
    name: "grep",
    description: "Search for a fixed string in workspace text files",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 512 },
        path: {
          type: "string",
          description: "Workspace-relative file or directory path",
        },
        caseSensitive: { type: "boolean" },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: limits.maxSearchResults,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    inputSchema: z.object({
      query: z.string().min(1).max(512),
      path: z.string().default("."),
      caseSensitive: z.boolean().default(true),
      maxResults: z
        .number()
        .int()
        .positive()
        .max(limits.maxSearchResults)
        .default(limits.defaultSearchResults),
    }),
    async execute(input, options) {
      try {
        const target = await boundary.resolveExisting(input.path);
        const pending = [target.absolutePath];
        const matches: { path: string; line: number; preview: string }[] = [];
        let scannedFiles = 0;
        let skippedFiles = 0;
        let truncated = false;
        const needle = input.caseSensitive
          ? input.query
          : input.query.toLocaleLowerCase();
        while (pending.length > 0 && !truncated) {
          throwIfAborted(options.signal);
          const current = pending.shift();
          if (current === undefined) break;
          const currentStat = await stat(current);
          if (currentStat.isDirectory()) {
            const entries = (
              await readdir(current, { withFileTypes: true })
            ).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
            for (const entry of entries) {
              if (
                entry.name === ".git" ||
                entry.name === "node_modules" ||
                entry.isSymbolicLink()
              )
                continue;
              if (entry.isDirectory() || entry.isFile())
                pending.push(resolve(current, entry.name));
            }
            continue;
          }
          if (!currentStat.isFile()) continue;
          if (scannedFiles >= limits.maxSearchFiles)
            throw new WorkspaceError("SEARCH_FILE_LIMIT_REACHED", input.path);
          scannedFiles += 1;
          if (currentStat.size > limits.maxFileBytes) {
            skippedFiles += 1;
            continue;
          }
          const data = await readFile(current);
          throwIfAborted(options.signal);
          if (data.byteLength > limits.maxFileBytes) {
            skippedFiles += 1;
            continue;
          }
          const text = decode(data);
          if (text === null) {
            skippedFiles += 1;
            continue;
          }
          const lines = text.split(/\r\n|\n|\r/);
          for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index] ?? "";
            const haystack = input.caseSensitive
              ? line
              : line.toLocaleLowerCase();
            if (!haystack.includes(needle)) continue;
            const preview =
              line.length > limits.maxPreviewLength
                ? `${line.slice(0, limits.maxPreviewLength)}…`
                : line;
            matches.push({
              path: boundary.toRelative(current),
              line: index + 1,
              preview,
            });
            if (matches.length >= input.maxResults) {
              truncated = true;
              break;
            }
          }
        }
        return {
          content: JSON.stringify({
            query: input.query,
            path: target.relativePath,
            matches,
            scannedFiles,
            skippedFiles,
            truncated,
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
