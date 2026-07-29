import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { renderPage } from "../lib/render-page.mjs";
import { slugify, snapshotTitleFromArgs } from "../generate-snapshot.mjs";

const minimalData = {
  generatedAt: "2026-07-29T10:00:00.000Z",
  snapshot: { title: "P0.3 </script><script>alert(1)</script>" },
  project: { name: "kflow-code", version: "0.1.0", description: "" },
  progress: {
    phases: [],
    currentTask: null,
    totals: {
      total: 0,
      completed: 0,
      verified: 0,
      completionPercent: 0,
      verificationPercent: 0,
    },
  },
  learningEntries: [],
  visionMarkdown: "# Vision",
  commands: [],
  api: [],
  git: { branch: "main", head: "abc1234", changes: [], commits: [] },
  snapshots: [],
};

describe("snapshot rendering", () => {
  it("creates a self-contained document and escapes embedded JSON", async () => {
    const css = await readFile(resolve("lr-machine/public/styles.css"), "utf8");
    const js = await readFile(resolve("lr-machine/public/app.js"), "utf8");
    const html = renderPage({ data: minimalData, css, js, inlineAssets: true });

    expect(html).toContain("<style>");
    expect(html).toContain('id="lr-data"');
    expect(html).not.toContain('src="/assets/app.js"');
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script\\u003e");
  });

  it("creates safe ASCII snapshot slugs", () => {
    expect(slugify("P0.3 最小 CLI 入口")).toBe("p0-3-cli");
    expect(slugify("学习记录")).toBe("learning-snapshot");
  });

  it("removes pnpm's argument delimiter from the snapshot title", () => {
    expect(snapshotTitleFromArgs(["--", "LR Machine 学习日志展示服务"])).toBe(
      "LR Machine 学习日志展示服务",
    );
  });
});
