export const ACTIVITY_FRAME_INTERVAL_MS = 100;

export const ACTIVITY_SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

export function activitySpinnerFrame(frame: number): string {
  const index =
    ((Math.floor(frame) % ACTIVITY_SPINNER_FRAMES.length) +
      ACTIVITY_SPINNER_FRAMES.length) %
    ACTIVITY_SPINNER_FRAMES.length;
  return ACTIVITY_SPINNER_FRAMES[index] ?? ACTIVITY_SPINNER_FRAMES[0];
}

export interface ActivityAnimationHandle {
  stop(): void;
}

export function startActivityAnimation(
  onFrame: (frame: number) => void,
  intervalMs = ACTIVITY_FRAME_INTERVAL_MS,
): ActivityAnimationHandle {
  let frame = 0;
  let stopped = false;
  onFrame(frame);
  const timer = setInterval(() => {
    if (stopped) return;
    frame = (frame + 1) % ACTIVITY_SPINNER_FRAMES.length;
    onFrame(frame);
  }, intervalMs);

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}
