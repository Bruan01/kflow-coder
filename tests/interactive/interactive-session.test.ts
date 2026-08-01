import { describe, expect, it, vi } from "vitest";

import {
  UserInterruptedError,
  type AgentRunResult,
  type ModelMessage,
} from "../../src/index.js";
import { runInteractiveSession } from "../../src/interactive/interactive-session.js";

function result(
  messages: readonly ModelMessage[],
  finalText: string,
): AgentRunResult {
  return {
    messages: [...messages, { role: "assistant", content: finalText }],
    steps: 1,
    finalText,
    finishReason: "stop",
  };
}

describe("runInteractiveSession", () => {
  it("keeps successful conversation history across prompts and handles slash commands", async () => {
    const lines = ["first question", "/status", "/clear", "follow up", "/exit"];
    const output: string[] = [];
    const clear = vi.fn();
    const runTurn = vi.fn(async (messages, handlers) => {
      handlers.onText("answer");
      return result(messages, "answer");
    });

    await runInteractiveSession({
      readLine: async () => lines.shift(),
      write: (text) => output.push(text),
      clear,
      runTurn,
      status: () => "Read-only · Chat Completions",
    });

    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(runTurn.mock.calls[1]?.[0]).toEqual([
      { role: "user", content: "first question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "follow up" },
    ]);
    expect(output.join("")).toContain("Read-only · Chat Completions");
    expect(clear).toHaveBeenCalledOnce();
  });

  it("shows only the actual tool name and retains history after a cancelled turn", async () => {
    const lines = ["inspect", "cancelled", "follow up", "/exit"];
    const output: string[] = [];
    let invocation = 0;

    await runInteractiveSession({
      readLine: async () => lines.shift(),
      write: (text) => output.push(text),
      clear: vi.fn(),
      status: () => "Read-only",
      runTurn: async (messages, handlers) => {
        invocation += 1;
        if (invocation === 1) {
          handlers.onToolCall({
            id: "call_1",
            name: "read_file",
            input: { path: "private-plan.md" },
          });
          return result(messages, "done");
        }
        if (invocation === 2) throw new UserInterruptedError();
        return result(messages, "after cancellation");
      },
    });

    expect(output.join("")).toContain("tool read_file");
    expect(output.join("")).not.toContain("private-plan.md");
    expect(output.join("")).toContain("Cancelled");
    expect(output.join("")).toContain("after cancellation");
  });

  it("prints help and rejects unknown slash commands without calling the model", async () => {
    const lines = ["/help", "/unknown", "/exit"];
    const write = vi.fn();
    const runTurn = vi.fn();

    await runInteractiveSession({
      readLine: async () => lines.shift(),
      write,
      clear: vi.fn(),
      runTurn,
      status: () => "Read-only",
    });

    expect(runTurn).not.toHaveBeenCalled();
    expect(write.mock.calls.join("")).toContain("/exit");
    expect(write.mock.calls.join("")).toContain("Unknown command");
  });
});
