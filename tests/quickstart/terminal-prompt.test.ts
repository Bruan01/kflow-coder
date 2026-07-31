import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { createTerminalPrompt } from "../../src/quickstart/terminal-prompt.js";

describe("createTerminalPrompt secret input", () => {
  it("does not echo the secret and restores the paused input state", async () => {
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn((mode: boolean) => {
        input.isRaw = mode;
      }),
    });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    const chunks: string[] = [];
    output.on("data", (chunk) => chunks.push(String(chunk)));
    input.pause();
    const prompt = createTerminalPrompt(input, output);

    const secretPromise = prompt.askSecret("Provider API Key");
    input.write("terminal-secret-value\n");
    const secret = await secretPromise;

    expect(secret).toBe("terminal-secret-value");
    expect(chunks.join("")).toContain("Provider API Key: ");
    expect(chunks.join("")).not.toContain("terminal-secret-value");
    expect(input.isPaused()).toBe(true);
    expect(input.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });
});
