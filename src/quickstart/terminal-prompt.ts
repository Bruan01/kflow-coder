import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";

import { UserInterruptedError } from "../errors/user-interrupted-error.js";
import type { QuickstartPrompt } from "./quickstart.js";

type TtyReadable = Readable & {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?(mode: boolean): void;
};
type TtyWritable = Writable & { isTTY?: boolean };

async function question(
  input: TtyReadable,
  output: TtyWritable,
  text: string,
): Promise<string> {
  const readline = createInterface({ input, output });
  try {
    return await readline.question(text);
  } finally {
    readline.close();
  }
}

async function hiddenQuestion(
  input: TtyReadable,
  output: TtyWritable,
  label: string,
): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Secret input requires a TTY with raw mode support");
  }

  output.write(`${label}: `);
  const wasRaw = Boolean(input.isRaw);
  const wasPaused = input.isPaused();
  return new Promise((resolvePromise, reject) => {
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode?.(wasRaw);
      if (wasPaused) input.pause();
      output.write("\n");
    };

    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup();
          reject(new UserInterruptedError());
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolvePromise(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };

    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
  });
}

export function createTerminalPrompt(
  input: TtyReadable = stdin,
  output: TtyWritable = stdout,
): QuickstartPrompt {
  return {
    isInteractive: Boolean(input.isTTY && output.isTTY),
    async ask(label: string, defaultValue?: string): Promise<string> {
      const suffix = defaultValue === undefined ? "" : ` [${defaultValue}]`;
      const answer = (
        await question(input, output, `${label}${suffix}: `)
      ).trim();
      return answer || defaultValue || "";
    },
    askSecret: (label: string) => hiddenQuestion(input, output, label),
    async confirm(label: string, defaultValue = false): Promise<boolean> {
      const hint = defaultValue ? "Y/n" : "y/N";
      while (true) {
        const answer = (await question(input, output, `${label} [${hint}] `))
          .trim()
          .toLowerCase();
        if (!answer) return defaultValue;
        if (answer === "y" || answer === "yes") return true;
        if (answer === "n" || answer === "no") return false;
        output.write("Please answer yes or no.\n");
      }
    },
    write(text: string): void {
      output.write(text);
    },
    close(): void {},
  };
}
