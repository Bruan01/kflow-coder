import { sanitizeTerminalText } from "./sanitize-terminal-text.js";

export type MarkdownLineKind =
  | "blank"
  | "heading"
  | "bullet"
  | "quote"
  | "paragraph"
  | "code-border"
  | "code";

export interface MarkdownLine {
  readonly kind: MarkdownLineKind;
  readonly text: string;
}

const FENCE_PATTERN = /^\s*```([^`]*)\s*$/;
const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET_PATTERN = /^(\s*)([-*+])\s+(.+)$/;
const ORDERED_PATTERN = /^(\s*)(\d+)[.)]\s+(.+)$/;
const QUOTE_PATTERN = /^\s{0,3}>\s?(.*)$/;

function normalizeIndent(indent: string): string {
  return "  ".repeat(Math.floor(indent.length / 2));
}

export function projectMarkdown(text: string): readonly MarkdownLine[] {
  const lines = sanitizeTerminalText(text).split("\n");
  const projected: MarkdownLine[] = [];
  let inFence = false;

  for (const line of lines) {
    const fence = line.match(FENCE_PATTERN);
    if (fence !== null) {
      if (inFence) {
        projected.push({ kind: "code-border", text: "└─" });
      } else {
        const language = fence[1]?.trim();
        projected.push({
          kind: "code-border",
          text:
            language === undefined || language === ""
              ? "┌─ code"
              : `┌─ ${language}`,
        });
      }
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      projected.push({ kind: "code", text: `│ ${line}` });
      continue;
    }

    if (line.trim() === "") {
      projected.push({ kind: "blank", text: "" });
      continue;
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading !== null) {
      projected.push({ kind: "heading", text: heading[2]!.trim() });
      continue;
    }

    const bullet = line.match(BULLET_PATTERN);
    if (bullet !== null) {
      projected.push({
        kind: "bullet",
        text: `${normalizeIndent(bullet[1]!)}• ${bullet[3]!.trim()}`,
      });
      continue;
    }

    const ordered = line.match(ORDERED_PATTERN);
    if (ordered !== null) {
      projected.push({
        kind: "bullet",
        text: `${normalizeIndent(ordered[1]!)}${ordered[2]}. ${ordered[3]!.trim()}`,
      });
      continue;
    }

    const quote = line.match(QUOTE_PATTERN);
    if (quote !== null) {
      projected.push({ kind: "quote", text: `│ ${quote[1]!.trim()}` });
      continue;
    }

    projected.push({ kind: "paragraph", text: line });
  }

  return projected;
}
