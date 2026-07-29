import { execFileSync } from "node:child_process";

function runGit(projectRoot, args) {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2500,
    }).trim();
  } catch {
    return "";
  }
}

export function collectGitState(projectRoot) {
  const branch =
    runGit(projectRoot, ["branch", "--show-current"]) || "unavailable";
  const head =
    runGit(projectRoot, ["rev-parse", "--short", "HEAD"]) || "no-commit";
  const statusText = runGit(projectRoot, ["status", "--short"]);
  const logText = runGit(projectRoot, [
    "log",
    "-5",
    "--pretty=format:%h%x09%s%x09%cs",
  ]);

  return {
    branch,
    head,
    changes: statusText
      ? statusText.split("\n").map((line) => ({
          state: line.slice(0, 2).trim() || "?",
          path: line.slice(3),
        }))
      : [],
    commits: logText
      ? logText.split("\n").map((line) => {
          const [hash, subject, date] = line.split("\t");
          return { hash, subject, date };
        })
      : [],
  };
}
