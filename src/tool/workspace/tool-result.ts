import { UserInterruptedError } from "../../errors/user-interrupted-error.js";
import type { ToolExecutionOutput } from "../define-tool.js";
import { WorkspaceError } from "./workspace-error.js";

export type WorkspaceChangeState = "unchanged" | "changed" | "unknown";

export interface WorkspaceFailureOptions {
  readonly workspaceChange?: WorkspaceChangeState;
  readonly recovery?: string;
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new UserInterruptedError();
}

function defaultRecovery(state: WorkspaceChangeState): string {
  if (state === "changed") {
    return "工作区可能已改变；请先检查 git_diff，再人工审查，不自动回滚。";
  }
  if (state === "unknown") {
    return "无法确认工作区是否改变；请先检查 git_diff，不自动回滚。";
  }
  return "本次操作未写入工作区。";
}

export function workspaceFailure(
  error: WorkspaceError,
  options: WorkspaceFailureOptions = {},
): ToolExecutionOutput {
  const hasRecoveryMetadata =
    options.workspaceChange !== undefined || options.recovery !== undefined;
  const workspaceChange = options.workspaceChange ?? "unchanged";
  return {
    content: JSON.stringify({
      error: { code: error.code, path: error.path.slice(0, 1024) },
      ...(hasRecoveryMetadata
        ? {
            workspaceChange,
            recovery: options.recovery ?? defaultRecovery(workspaceChange),
          }
        : {}),
    }),
    isError: true,
  };
}
