import { readdir, stat } from "node:fs/promises";
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

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globPattern(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const current = pattern[index];
    if (current === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (current === "*") {
      source += "[^/]*";
    } else if (current === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(current ?? "");
    }
  }
  return new RegExp(`^${source}$`);
}

function matches(
  matcher: RegExp,
  pattern: string,
  relativePath: string,
): boolean {
  return matcher.test(
    pattern.includes("/")
      ? relativePath
      : (relativePath.split("/").at(-1) ?? ""),
  );
}

export function createFindFilesTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  return defineTool({
    name: "find_files",
    description: "Find workspace files using a bounded glob pattern",
    capability: "read",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          description: "Glob such as **/*.ts or *.test.ts",
        },
        path: {
          type: "string",
          description: "Workspace-relative directory to search from",
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: limits.maxSearchResults,
        },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    inputSchema: z.object({
      pattern: z.string().min(1).max(256),
      path: z.string().default("."),
      maxResults: z
        .number()
        .int()
        .positive()
        .max(limits.maxSearchResults)
        .default(limits.defaultSearchResults),
    }),
    async execute(input, options) {
      try {
        throwIfAborted(options.signal);
        const target = await boundary.resolveExisting(input.path);
        if (!(await stat(target.absolutePath)).isDirectory()) {
          throw new WorkspaceError("NOT_A_DIRECTORY", input.path);
        }
        const matcher = globPattern(input.pattern);
        const pending = [
          {
            absolutePath: target.absolutePath,
            relativePath: target.relativePath,
          },
        ];
        const files: string[] = [];
        let scannedEntries = 0;
        let truncated = false;

        while (pending.length > 0 && !truncated) {
          throwIfAborted(options.signal);
          const current = pending.shift();
          if (current === undefined) break;
          const entries = await readdir(current.absolutePath, {
            withFileTypes: true,
          });
          entries.sort((left, right) => left.name.localeCompare(right.name));
          for (const entry of entries) {
            throwIfAborted(options.signal);
            if (entry.name === ".git" || entry.name === "node_modules") {
              continue;
            }
            scannedEntries += 1;
            if (scannedEntries > limits.maxSearchFiles) {
              throw new WorkspaceError("SEARCH_FILE_LIMIT_REACHED", input.path);
            }
            const relativePath =
              current.relativePath === "."
                ? entry.name
                : `${current.relativePath}/${entry.name}`;
            const absolutePath = resolve(current.absolutePath, entry.name);
            if (entry.isDirectory()) {
              pending.push({ absolutePath, relativePath });
              continue;
            }
            if (
              !entry.isFile() ||
              !matches(matcher, input.pattern, relativePath)
            ) {
              continue;
            }
            files.push(relativePath);
            if (files.length >= input.maxResults) {
              truncated = true;
              break;
            }
          }
        }

        return {
          content: JSON.stringify({
            pattern: input.pattern,
            path: target.relativePath,
            files,
            scannedEntries,
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
