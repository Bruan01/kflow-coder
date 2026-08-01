export type WorkspaceErrorCode =
  | "WORKSPACE_PATH_INVALID"
  | "WORKSPACE_PATH_OUTSIDE"
  | "PATH_NOT_FOUND"
  | "NOT_A_FILE"
  | "NOT_A_DIRECTORY"
  | "FILE_TOO_LARGE"
  | "BINARY_FILE"
  | "SEARCH_FILE_LIMIT_REACHED"
  | "PATH_ALREADY_EXISTS"
  | "PATCH_NOT_FOUND"
  | "PATCH_AMBIGUOUS"
  | "CONTENT_TOO_LARGE";

export class WorkspaceError extends Error {
  constructor(
    readonly code: WorkspaceErrorCode,
    readonly path: string,
  ) {
    super("Workspace operation failed");
    this.name = "WorkspaceError";
  }
}
