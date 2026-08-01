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

const FRAME_DELAY_MS = 120;
const LOGO = "KFLOW CODE";
const DIGITS = "0123456789";
const RAIN_FRAMES = 9;
const REVEAL_FRAMES = 10;
const HOLD_FRAMES = 3;
const LOGO_TOP = 2;
const ASCII_FONT: Readonly<Record<string, readonly string[]>> = {
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function buildAsciiLogo(): readonly string[] {
  const rows = ASCII_FONT.K?.length ?? 0;
  return Array.from({ length: rows }, (_, row) =>
    [...LOGO]
      .map((character) => ASCII_FONT[character]?.[row] ?? ".....")
      .join(" "),
  );
}

const ASCII_LOGO = buildAsciiLogo();
const ASCII_LOGO_WIDTH = ASCII_LOGO[0]?.length ?? 0;
const ASCII_LOGO_HEIGHT = ASCII_LOGO.length;
const CANVAS_HEIGHT = LOGO_TOP + ASCII_LOGO_HEIGHT + 2;

function normalizedColumns(columns: number): number {
  return Math.max(1, Math.floor(columns));
}

function centered(text: string, columns: number): string {
  const width = normalizedColumns(columns);
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return `${" ".repeat(padding)}${text}\n`;
}

function colored(text: string, code: string, color: boolean): string {
  return color ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function digitAt(frame: number, row: number, column: number): string {
  const index =
    (frame * 17 + row * 31 + column * 13 + (column % 5) * frame) %
    DIGITS.length;
  return DIGITS[index] ?? "0";
}

function hasRain(frame: number, row: number, column: number): boolean {
  return (frame * 7 + row * 11 + column * 5) % 9 < 6;
}

function revealThreshold(row: number, column: number): number {
  return ((column * 37 + row * 23 + 11) % 100) / 100;
}

function renderField(
  columns: number,
  color: boolean,
  frame: number,
  progress: number,
): string {
  const canvasWidth = normalizedColumns(columns);
  const logoStart = Math.floor((canvasWidth - ASCII_LOGO_WIDTH) / 2);
  const lines: string[] = [];

  for (let row = 0; row < CANVAS_HEIGHT; row += 1) {
    const logoRow = row - LOGO_TOP;
    const logoLine = ASCII_LOGO[logoRow];
    let line = "";
    for (let column = 0; column < canvasWidth; column += 1) {
      const logoColumn = column - logoStart;
      const target =
        logoLine !== undefined && logoColumn >= 0
          ? logoLine[logoColumn]
          : undefined;
      const isLogoCell = target !== undefined;
      const isRevealed =
        isLogoCell && progress >= revealThreshold(logoRow, logoColumn);
      const value = isRevealed
        ? target === "#"
          ? "#"
          : " "
        : hasRain(frame, row, column)
          ? digitAt(frame, row, column)
          : " ";
      line += colored(value, isRevealed ? "1;36" : "2;32", color);
    }
    lines.push(line);
  }

  return `${lines.join("\n")}\n`;
}

export function createStartupFrames(
  options: StartupFrameOptions,
): readonly string[] {
  const columns = normalizedColumns(options.columns);
  if (columns < ASCII_LOGO_WIDTH + 2) {
    return [centered(LOGO, columns)];
  }

  const frames: string[] = [];
  for (let index = 0; index < RAIN_FRAMES; index += 1) {
    frames.push(
      renderField(columns, options.color, index, index / RAIN_FRAMES / 3),
    );
  }
  for (let index = 0; index < REVEAL_FRAMES; index += 1) {
    frames.push(
      renderField(
        columns,
        options.color,
        RAIN_FRAMES + index,
        (index + 1) / REVEAL_FRAMES,
      ),
    );
  }
  for (let index = 0; index < HOLD_FRAMES; index += 1) {
    frames.push(
      renderField(
        columns,
        options.color,
        RAIN_FRAMES + REVEAL_FRAMES + index,
        1,
      ),
    );
  }
  return frames;
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
  options.write("\u001b[2J\u001b[H");
}
