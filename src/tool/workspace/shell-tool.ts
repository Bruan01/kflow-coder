import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { z } from "zod";

import { UserInterruptedError } from "../../errors/user-interrupted-error.js";
import { defineTool, type ToolDefinition } from "../define-tool.js";
import type { WorkspaceBoundary } from "./workspace-boundary.js";
import {
  defaultReadOnlyToolLimits,
  type ReadOnlyToolLimits,
} from "./limits.js";
import { WorkspaceError } from "./workspace-error.js";
import { throwIfAborted, workspaceFailure } from "./tool-result.js";

function safeEnvironment(): NodeJS.ProcessEnv {
  const names = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM", "CI"];
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = process.env[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );
}

interface ShellResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
}

function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  maxOutputChars: number,
  signal: AbortSignal | undefined,
): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: safeEnvironment(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let outputChars = 0;
    let truncated = false;
    let timedOut = false;
    let interrupted = false;
    let settled = false;
    const append = (target: "stdout" | "stderr", chunk: Buffer): void => {
      if (outputChars >= maxOutputChars) {
        truncated = true;
        return;
      }
      const text = chunk.toString("utf8");
      const remaining = maxOutputChars - outputChars;
      const bounded = text.slice(0, remaining);
      outputChars += bounded.length;
      if (target === "stdout") stdout += bounded;
      else stderr += bounded;
      if (bounded.length < text.length) {
        truncated = true;
        child.kill("SIGTERM");
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    const abort = (): void => {
      interrupted = true;
      child.kill("SIGTERM");
    };
    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };

    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    child.once("close", (exitCode, childSignal) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (interrupted) {
        reject(new UserInterruptedError());
        return;
      }
      resolve({
        stdout,
        stderr,
        exitCode,
        signal: childSignal,
        timedOut,
        truncated,
      });
    });
  });
}

export function createShellTool(
  boundary: WorkspaceBoundary,
  limits: ReadOnlyToolLimits = defaultReadOnlyToolLimits,
): ToolDefinition {
  const maxCommandTimeoutMs =
    limits.maxCommandTimeoutMs ??
    defaultReadOnlyToolLimits.maxCommandTimeoutMs!;
  const defaultCommandTimeoutMs =
    limits.defaultCommandTimeoutMs ??
    defaultReadOnlyToolLimits.defaultCommandTimeoutMs!;
  const maxCommandOutputChars =
    limits.maxCommandOutputChars ??
    defaultReadOnlyToolLimits.maxCommandOutputChars!;
  return defineTool({
    name: "shell",
    description:
      "Run one shell command from a workspace directory with bounded output and timeout",
    capability: "execute",
    enabledByDefault: false,
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          minLength: 1,
          maxLength: 4096,
          description: "Command to run; user must explicitly enable shell",
        },
        cwd: {
          type: "string",
          description: "Workspace-relative working directory",
        },
        timeoutMs: {
          type: "integer",
          minimum: 1000,
          maximum: maxCommandTimeoutMs,
        },
        maxOutputChars: {
          type: "integer",
          minimum: 1,
          maximum: maxCommandOutputChars,
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
    inputSchema: z.object({
      command: z.string().trim().min(1).max(4096),
      cwd: z.string().default("."),
      timeoutMs: z
        .number()
        .int()
        .min(1000)
        .max(maxCommandTimeoutMs)
        .default(defaultCommandTimeoutMs),
      maxOutputChars: z
        .number()
        .int()
        .positive()
        .max(maxCommandOutputChars)
        .default(maxCommandOutputChars),
    }),
    async execute(input, options) {
      try {
        throwIfAborted(options.signal);
        const target = await boundary.resolveExisting(input.cwd);
        if (!(await stat(target.absolutePath)).isDirectory()) {
          throw new WorkspaceError("NOT_A_DIRECTORY", input.cwd);
        }
        const result = await runCommand(
          input.command,
          target.absolutePath,
          input.timeoutMs,
          input.maxOutputChars,
          options.signal,
        );
        return {
          content: JSON.stringify({
            command: input.command,
            cwd: target.relativePath,
            ...result,
          }),
          isError: result.exitCode !== 0 || result.timedOut || result.truncated,
        };
      } catch (error) {
        if (error instanceof UserInterruptedError) throw error;
        if (error instanceof WorkspaceError) return workspaceFailure(error);
        throw error;
      }
    },
  });
}
