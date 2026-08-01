import { describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_SPINNER_FRAMES,
  activitySpinnerFrame,
  startActivityAnimation,
} from "../../src/interactive/activity-animation.js";

describe("activity animation", () => {
  it("normalizes spinner frames and wraps in both directions", () => {
    expect(activitySpinnerFrame(0)).toBe(ACTIVITY_SPINNER_FRAMES[0]);
    expect(activitySpinnerFrame(ACTIVITY_SPINNER_FRAMES.length)).toBe(
      ACTIVITY_SPINNER_FRAMES[0],
    );
    expect(activitySpinnerFrame(-1)).toBe(ACTIVITY_SPINNER_FRAMES.at(-1));
  });

  it("starts immediately, advances on a timer, and stops cleanly", () => {
    vi.useFakeTimers();
    try {
      const onFrame = vi.fn();
      const animation = startActivityAnimation(onFrame, 50);

      expect(onFrame).toHaveBeenCalledWith(0);
      vi.advanceTimersByTime(150);
      expect(onFrame.mock.calls.map(([frame]) => frame)).toEqual([0, 1, 2, 3]);

      animation.stop();
      vi.advanceTimersByTime(200);
      expect(onFrame.mock.calls.map(([frame]) => frame)).toEqual([0, 1, 2, 3]);
    } finally {
      vi.useRealTimers();
    }
  });
});
