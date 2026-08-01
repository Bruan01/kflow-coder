import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ToolRegistry,
  WorkspaceBoundary,
  createReadFileTool,
  defaultReadOnlyToolLimits,
} from "../../../src/index.js";
const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
async function registry() {
  const root = await mkdtemp(resolve(tmpdir(), "kfc-read-"));
  roots.push(root);
  const boundary = await WorkspaceBoundary.create(root);
  return { root, registry: new ToolRegistry([createReadFileTool(boundary)]) };
}
describe("read_file", () => {
  it("returns numbered UTF-8 lines with offset and truncation", async () => {
    const value = await registry();
    await writeFile(resolve(value.root, "file.txt"), "one\r\ntwo\nthree\r");
    const result = await value.registry.execute({
      id: "c",
      name: "read_file",
      input: { path: "file.txt", offset: 2, limit: 1 },
    });
    expect(JSON.parse(result.content)).toEqual({
      path: "file.txt",
      totalLines: 3,
      offset: 2,
      lines: [{ number: 2, text: "two" }],
      truncated: true,
    });
  });
  it("rejects binary and oversized files safely", async () => {
    const value = await registry();
    await writeFile(resolve(value.root, "binary"), Buffer.from([65, 0, 66]));
    expect(
      JSON.parse(
        (
          await value.registry.execute({
            id: "c",
            name: "read_file",
            input: { path: "binary" },
          })
        ).content,
      ).error.code,
    ).toBe("BINARY_FILE");
    await writeFile(
      resolve(value.root, "large"),
      Buffer.alloc(defaultReadOnlyToolLimits.maxFileBytes + 1),
    );
    expect(
      JSON.parse(
        (
          await value.registry.execute({
            id: "c",
            name: "read_file",
            input: { path: "large" },
          })
        ).content,
      ).error.code,
    ).toBe("FILE_TOO_LARGE");
  });
});
