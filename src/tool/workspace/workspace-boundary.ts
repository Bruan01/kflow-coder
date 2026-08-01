import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { WorkspaceError } from "./workspace-error.js";

export interface WorkspaceTarget {
  readonly absolutePath: string;
  readonly relativePath: string;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return undefined;
}

function isInside(root: string, target: string): boolean {
  const value = relative(root, target);
  return (
    value === "" ||
    (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value))
  );
}

function displayPath(root: string, target: string): string {
  const value = relative(root, target);
  return value === "" ? "." : value.split(sep).join("/");
}

function isValidToolPath(path: string, maxPathLength: number): boolean {
  if (
    path === "" ||
    path.length > maxPathLength ||
    path.includes("\0") ||
    path.includes("\\") ||
    path.startsWith("~") ||
    isAbsolute(path) ||
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.startsWith("//")
  ) {
    return false;
  }
  if (path === ".") return true;
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment !== "" &&
      segment !== "." &&
      segment !== ".." &&
      segment !== ".git",
  );
}

export class WorkspaceBoundary {
  private constructor(
    private readonly canonicalRoot: string,
    private readonly maxPathLength: number,
  ) {}

  static async create(
    workspaceRoot: string,
    options: { readonly maxPathLength?: number } = {},
  ): Promise<WorkspaceBoundary> {
    const canonicalRoot = await realpath(workspaceRoot);
    const rootStat = await stat(canonicalRoot);
    if (!rootStat.isDirectory())
      throw new WorkspaceError("NOT_A_DIRECTORY", ".");
    return new WorkspaceBoundary(canonicalRoot, options.maxPathLength ?? 1024);
  }

  async resolveExisting(path: string): Promise<WorkspaceTarget> {
    if (!isValidToolPath(path, this.maxPathLength)) {
      throw new WorkspaceError("WORKSPACE_PATH_INVALID", path);
    }

    const lexicalTarget =
      path === "."
        ? this.canonicalRoot
        : resolve(this.canonicalRoot, ...path.split("/"));
    let canonicalTarget: string;
    try {
      canonicalTarget = await realpath(lexicalTarget);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ENOTDIR") {
        throw new WorkspaceError("PATH_NOT_FOUND", path);
      }
      throw error;
    }

    if (!isInside(this.canonicalRoot, canonicalTarget)) {
      throw new WorkspaceError("WORKSPACE_PATH_OUTSIDE", path);
    }
    return {
      absolutePath: canonicalTarget,
      relativePath: displayPath(this.canonicalRoot, canonicalTarget),
    };
  }

  toRelative(absolutePath: string): string {
    if (!isInside(this.canonicalRoot, absolutePath)) {
      throw new WorkspaceError("WORKSPACE_PATH_OUTSIDE", ".");
    }
    return displayPath(this.canonicalRoot, absolutePath);
  }
}
