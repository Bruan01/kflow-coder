import { readFileSync } from "node:fs";

interface PackageMetadata {
  version?: unknown;
}

export function readPackageVersion(
  packageUrl = new URL("../../package.json", import.meta.url),
): string {
  const metadata = JSON.parse(
    readFileSync(packageUrl, "utf8"),
  ) as PackageMetadata;
  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("package.json does not contain a valid version");
  }
  return metadata.version;
}
