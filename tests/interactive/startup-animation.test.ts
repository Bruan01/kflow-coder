import { describe, expect, it, vi } from "vitest";

import {
  createStartupFrames,
  playStartupAnimation,
} from "../../src/interactive/startup-animation.js";

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

describe("KFlow startup animation", () => {
  it("uses a safe static text fallback when the terminal cannot fit the ASCII logo", () => {
    expect(createStartupFrames({ columns: 24, color: true })).toEqual([
      `${" ".repeat(7)}KFLOW CODE\n`,
    ]);
  });

  it("fills the TUI width with digital rain and reveals a large ASCII logo", () => {
    const frames = createStartupFrames({ columns: 80, color: true });
    const firstFrame = stripAnsi(frames[0] ?? "");
    const finalFrame = stripAnsi(frames.at(-1) ?? "");

    expect(frames).toHaveLength(22);
    expect(firstFrame.split("\n").filter(Boolean)).toHaveLength(11);
    expect(
      firstFrame
        .split("\n")
        .filter(Boolean)
        .every((line) => line.length === 80),
    ).toBe(true);
    expect(firstFrame).toMatch(/[0-9]/);
    expect(finalFrame).toContain("#####");
    expect(finalFrame).toContain("#   #");
    expect(frames.at(-1)).toContain("\u001b[1;36m#");
  });

  it("keeps the large ASCII animation when color is disabled", () => {
    const frames = createStartupFrames({ columns: 80, color: false });

    expect(frames).toHaveLength(22);
    expect(frames.join("")).not.toContain("\u001b[");
    expect(frames.at(-1)).toContain("#####");
  });

  it("writes bounded frames through injected timing without network or model work", async () => {
    const write = vi.fn();
    const delay = vi.fn(async () => {});

    await playStartupAnimation({
      columns: 80,
      color: true,
      write,
      delay,
    });

    expect(write).toHaveBeenCalledTimes(23);
    expect(delay).toHaveBeenCalledTimes(21);
    expect(delay).toHaveBeenCalledWith(120);
    expect(write.mock.lastCall?.[0]).toBe("\u001b[2J\u001b[H");
  });
});
