import { describe, expect, it } from "vitest";

import {
  applyInputKey,
  createInputEditor,
  type InputKey,
} from "../../src/interactive/input-editor.js";

function apply(keys: readonly InputKey[]) {
  return keys.reduce(
    (editor, key) => applyInputKey(editor, key),
    createInputEditor(),
  );
}

describe("input editor", () => {
  it("supports insertion, cursor movement, deletion, and multiline input", () => {
    const editor = apply([
      { type: "text", value: "ac" },
      { type: "left" },
      { type: "text", value: "b" },
      { type: "newline" },
      { type: "text", value: "d" },
      { type: "backspace" },
      { type: "delete" },
    ]);

    expect(editor).toEqual({ value: "ab\n", cursor: 3 });
  });

  it("never stores terminal control characters in editable text", () => {
    const editor = apply([
      { type: "text", value: "safe\u001b[2J\u0007" },
      { type: "home" },
      { type: "delete" },
    ]);

    expect(editor).toEqual({ value: "afe", cursor: 0 });
  });
});
