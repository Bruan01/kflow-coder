import { describe, expect, it } from "vitest";

import { projectMarkdown } from "../../src/interactive/markdown-projection.js";

describe("projectMarkdown", () => {
  it("projects common Markdown structure without interpreting terminal escapes", () => {
    expect(
      projectMarkdown(
        "# Title\n\n- **important**\n1. `code`\n> note\n\n```ts\nconst x = 1;\n```",
      ),
    ).toEqual([
      { kind: "heading", text: "Title" },
      { kind: "blank", text: "" },
      { kind: "bullet", text: "• **important**" },
      { kind: "bullet", text: "1. `code`" },
      { kind: "quote", text: "│ note" },
      { kind: "blank", text: "" },
      { kind: "code-border", text: "┌─ ts" },
      { kind: "code", text: "│ const x = 1;" },
      { kind: "code-border", text: "└─" },
    ]);
  });

  it("keeps an unfinished fenced block incremental and strips terminal controls", () => {
    expect(projectMarkdown("```\nprivate\u001b[2J-plan")).toEqual([
      { kind: "code-border", text: "┌─ code" },
      { kind: "code", text: "│ private-plan" },
    ]);
  });
});
