export interface InputEditorState {
  readonly value: string;
  readonly cursor: number;
}

export type InputKey =
  | { readonly type: "text"; readonly value: string }
  | {
      readonly type: "left" | "right" | "home" | "end" | "backspace" | "delete";
    }
  | { readonly type: "newline" };

function sanitizeText(value: string): string {
  return sanitizeTerminalText(value);
}

function clampCursor(value: string, cursor: number): number {
  return Math.min(value.length, Math.max(0, cursor));
}

export function createInputEditor(): InputEditorState {
  return { value: "", cursor: 0 };
}

export function applyInputKey(
  editor: InputEditorState,
  key: InputKey,
): InputEditorState {
  const cursor = clampCursor(editor.value, editor.cursor);
  if (key.type === "text") {
    const value = sanitizeText(key.value);
    return {
      value: `${editor.value.slice(0, cursor)}${value}${editor.value.slice(cursor)}`,
      cursor: cursor + value.length,
    };
  }
  if (key.type === "newline") {
    return {
      value: `${editor.value.slice(0, cursor)}\n${editor.value.slice(cursor)}`,
      cursor: cursor + 1,
    };
  }
  if (key.type === "left")
    return { ...editor, cursor: Math.max(0, cursor - 1) };
  if (key.type === "right") {
    return { ...editor, cursor: Math.min(editor.value.length, cursor + 1) };
  }
  if (key.type === "home") {
    return {
      ...editor,
      cursor: editor.value.lastIndexOf("\n", cursor - 1) + 1,
    };
  }
  if (key.type === "end") {
    const nextLine = editor.value.indexOf("\n", cursor);
    return {
      ...editor,
      cursor: nextLine === -1 ? editor.value.length : nextLine,
    };
  }
  if (key.type === "backspace") {
    if (cursor === 0) return { ...editor, cursor };
    return {
      value: `${editor.value.slice(0, cursor - 1)}${editor.value.slice(cursor)}`,
      cursor: cursor - 1,
    };
  }
  if (key.type === "delete") {
    return {
      value: `${editor.value.slice(0, cursor)}${editor.value.slice(cursor + 1)}`,
      cursor,
    };
  }
  return editor;
}
import { sanitizeTerminalText } from "./sanitize-terminal-text.js";
