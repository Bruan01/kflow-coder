import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectProjectData } from "./lib/collect-project-data.mjs";
import { renderPage } from "./lib/render-page.mjs";

const LR_ROOT = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = resolve(LR_ROOT, "..");
const SNAPSHOT_ROOT = resolve(LR_ROOT, "snapshots");

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestamp(date) {
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function snapshotTitleFromArgs(args) {
  const normalized = args[0] === "--" ? args.slice(1) : args;
  return normalized.join(" ").trim();
}

export function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/([a-z0-9])\.([a-z0-9])/g, "$1-$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "learning-snapshot";
}

async function uniqueFileName(baseName) {
  for (let index = 1; index < 100; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const name = `${baseName}${suffix}.html`;
    try {
      await writeFile(resolve(SNAPSHOT_ROOT, name), "", { flag: "wx" });
      return name;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Unable to allocate a unique snapshot name");
}

export async function generateSnapshot(title, now = new Date()) {
  const cleanTitle = String(title ?? "").trim();
  if (!cleanTitle) {
    throw new Error(
      'Snapshot title is required. Example: pnpm learning:snapshot -- "P0.3 Minimal CLI"',
    );
  }

  await mkdir(SNAPSHOT_ROOT, { recursive: true });
  const fileName = await uniqueFileName(
    `${timestamp(now)}-${slugify(cleanTitle)}`,
  );
  const snapshotMeta = { title: cleanTitle, fileName };

  try {
    const [css, js, data] = await Promise.all([
      readFile(resolve(LR_ROOT, "public", "styles.css"), "utf8"),
      readFile(resolve(LR_ROOT, "public", "app.js"), "utf8"),
      collectProjectData(PROJECT_ROOT, snapshotMeta),
    ]);
    data.snapshots = [
      { name: fileName, modifiedAt: now.toISOString() },
      ...data.snapshots.filter((snapshot) => snapshot.name !== fileName),
    ];
    const html = renderPage({ data, css, js, inlineAssets: true });
    await writeFile(resolve(SNAPSHOT_ROOT, fileName), html, "utf8");
    return `lr-machine/snapshots/${fileName}`;
  } catch (error) {
    await unlink(resolve(SNAPSHOT_ROOT, fileName)).catch(() => {});
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateSnapshot(snapshotTitleFromArgs(process.argv.slice(2)))
    .then((path) => console.log(`Learning snapshot created: ${path}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
