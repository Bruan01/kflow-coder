import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { collectApiExports } from "../lib/collect-api.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("collectApiExports", () => {
  it("collects only real exported declarations with relative locations", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "lr-machine-api-"));
    temporaryRoots.push(root);
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src", "sample.ts"),
      `const hidden = 1;\nexport interface Tool { name: string }\nexport const version = "1";\n`,
    );

    const result = await collectApiExports(root);

    expect(result.map((item) => item.name)).toEqual(["Tool", "version"]);
    expect(result[0]).toMatchObject({
      kind: "interface",
      path: "src/sample.ts",
      line: 2,
    });
    expect(JSON.stringify(result)).not.toContain(root);
  });
});
