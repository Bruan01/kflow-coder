import { readdir, readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { collectApiExports } from "./collect-api.mjs";
import { collectGitState } from "./git-state.mjs";
import {
  collectVerifiedTaskIds,
  parseLearningLog,
} from "./parse-learning-log.mjs";
import { parseTodo } from "./parse-todo.mjs";

async function readText(path) {
  return readFile(path, "utf8").catch(() => "");
}

function commandDescription(name) {
  const descriptions = {
    build: "Compile production TypeScript with strict checks",
    test: "Run deterministic automated tests",
    lint: "Run static analysis",
    format: "Rewrite supported files using Prettier",
    "format:check": "Verify formatting without modifying files",
    "learning:serve": "Start the local LR Machine dashboard",
    "learning:snapshot": "Archive the current learning state as HTML",
    "learning:test": "Run LR Machine focused tests",
  };
  return descriptions[name] ?? "Project command";
}

async function collectSnapshots(projectRoot) {
  const directory = resolve(projectRoot, "lr-machine", "snapshots");
  const names = await readdir(directory).catch(() => []);
  const snapshots = [];

  for (const name of names.filter((value) => /^[\w.-]+\.html$/u.test(value))) {
    const info = await stat(resolve(directory, name)).catch(() => null);
    if (info?.isFile()) {
      snapshots.push({
        name: basename(name),
        modifiedAt: info.mtime.toISOString(),
      });
    }
  }

  return snapshots.sort((left, right) => right.name.localeCompare(left.name));
}

export async function collectProjectData(projectRoot, snapshotMeta = null) {
  const [
    todoMarkdown,
    learningMarkdown,
    visionMarkdown,
    packageText,
    api,
    snapshots,
  ] = await Promise.all([
    readText(resolve(projectRoot, "TODO.md")),
    readText(resolve(projectRoot, "docs", "learning-log.md")),
    readText(resolve(projectRoot, "docs", "vision.md")),
    readText(resolve(projectRoot, "package.json")),
    collectApiExports(projectRoot),
    collectSnapshots(projectRoot),
  ]);

  const learningEntries = parseLearningLog(learningMarkdown);
  const progress = parseTodo(
    todoMarkdown,
    collectVerifiedTaskIds(learningEntries),
  );
  const packageData = packageText ? JSON.parse(packageText) : {};
  const commands = Object.entries(packageData.scripts ?? {}).map(
    ([name, command]) => ({
      name,
      command,
      description: commandDescription(name),
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    snapshot: snapshotMeta,
    project: {
      name: packageData.name ?? "kflow-code",
      version: packageData.version ?? "unversioned",
      description: packageData.description ?? "",
    },
    progress,
    learningEntries,
    visionMarkdown,
    commands,
    api,
    git: collectGitState(projectRoot),
    snapshots,
  };
}
