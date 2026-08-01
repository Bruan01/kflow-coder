export interface StartupAnimationOptions {
  readonly columns: number;
  readonly color: boolean;
  readonly write: (text: string) => void;
  readonly delay?: (milliseconds: number) => Promise<void>;
}

export interface StartupFrameOptions {
  readonly columns: number;
  readonly color: boolean;
}

const FRAME_DELAY_MS = 90;

function centered(text: string, columns: number): string {
  const padding = Math.max(0, Math.floor((columns - text.length) / 2));
  return `${" ".repeat(padding)}${text}\n`;
}

export function createStartupFrames(
  options: StartupFrameOptions,
): readonly string[] {
  if (!options.color || options.columns < 36) return ["KFLOW\n"];

  const words = ["·", "K·", "KF·", "KFL·", "KFLOW"];
  return words.map((word, index) => {
    const prefix = index === words.length - 1 ? "\u001b[1;36m" : "\u001b[2;36m";
    return `${prefix}${centered(word, options.columns)}\u001b[0m`;
  });
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function playStartupAnimation(
  options: StartupAnimationOptions,
): Promise<void> {
  const frames = createStartupFrames(options);
  const delay = options.delay ?? defaultDelay;

  for (const [index, frame] of frames.entries()) {
    options.write(`\u001b[2J\u001b[H${frame}`);
    if (index < frames.length - 1) await delay(FRAME_DELAY_MS);
  }
}
