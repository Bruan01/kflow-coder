import { describe, expect, it, vi } from "vitest";

import {
  createStartupFrames,
  playStartupAnimation,
} from "../../src/interactive/startup-animation.js";

describe("KFlow startup animation", () => {
  it("uses one safe static KFLOW frame when color is disabled or the terminal is narrow", () => {
    expect(createStartupFrames({ columns: 24, color: true })).toEqual([
      "KFLOW\n",
    ]);
    expect(createStartupFrames({ columns: 120, color: false })).toEqual([
      "KFLOW\n",
    ]);
  });

  it("builds a short text-only animation for a regular terminal", () => {
    const frames = createStartupFrames({ columns: 80, color: true });

    expect(frames).toHaveLength(5);
    expect(frames.at(-1)).toContain("KFLOW");
    expect(frames.join("")).not.toContain("\u001b[?1049");
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

    expect(write).toHaveBeenCalledTimes(5);
    expect(delay).toHaveBeenCalledTimes(4);
    expect(delay).toHaveBeenCalledWith(90);
  });
});
