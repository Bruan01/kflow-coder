import { UserInterruptedError } from "../../errors/user-interrupted-error.js";
import type { ToolExecutionOutput } from "../define-tool.js";
import { WorkspaceError } from "./workspace-error.js";

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new UserInterruptedError();
}

export function workspaceFailure(error: WorkspaceError): ToolExecutionOutput {
  return {
    content: JSON.stringify({
      error: { code: error.code, path: error.path.slice(0, 1024) },
    }),
    isError: true,
  };
}
