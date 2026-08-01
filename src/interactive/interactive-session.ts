import type { AgentRunResult } from "../agent/run-agent.js";
import { UserInterruptedError } from "../errors/user-interrupted-error.js";
import type {
  ModelMessage,
  ModelToolCall,
} from "../provider/model-provider.js";
import { sanitizeTerminalText } from "./sanitize-terminal-text.js";

export interface InteractiveTurnHandlers {
  onText(delta: string): void;
  onToolCall(toolCall: ModelToolCall): void;
}

export interface InteractiveSessionOptions {
  readonly readLine: () => Promise<string | undefined>;
  readonly write: (text: string) => void;
  readonly clear: () => void;
  readonly status: () => string;
  readonly runTurn: (
    messages: readonly ModelMessage[],
    handlers: InteractiveTurnHandlers,
  ) => Promise<AgentRunResult>;
}

function sanitizeDisplayText(text: string): string {
  return sanitizeTerminalText(text);
}

function helpText(): string {
  return [
    "Commands:",
    "  /help    Show commands",
    "  /clear   Clear the visible terminal (conversation remains in memory)",
    "  /status  Show the current read-only session status",
    "  /exit    Leave KFlow",
    "",
  ].join("\n");
}

function writeAssistantPrefix(write: (text: string) => void): void {
  write("\nKFC › ");
}

export async function runInteractiveSession(
  options: InteractiveSessionOptions,
): Promise<void> {
  let messages: readonly ModelMessage[] = [];

  while (true) {
    const line = await options.readLine();
    if (line === undefined) return;
    const input = line.trim();
    if (input === "") continue;

    if (input.startsWith("/")) {
      switch (input) {
        case "/help":
          options.write(helpText());
          continue;
        case "/clear":
          options.clear();
          continue;
        case "/status":
          options.write(`${options.status()}\n`);
          continue;
        case "/exit":
          return;
        default:
          options.write(`Unknown command: ${sanitizeDisplayText(input)}\n`);
          continue;
      }
    }

    const nextMessages: readonly ModelMessage[] = [
      ...messages,
      { role: "user", content: input },
    ];
    let startedAssistant = false;
    try {
      const result = await options.runTurn(nextMessages, {
        onText(delta) {
          if (!startedAssistant) {
            startedAssistant = true;
            writeAssistantPrefix(options.write);
          }
          options.write(sanitizeDisplayText(delta));
        },
        onToolCall(toolCall) {
          options.write(`\n  ↳ tool ${sanitizeDisplayText(toolCall.name)}\n`);
        },
      });
      messages = result.messages;
      if (!startedAssistant && result.finalText !== "") {
        writeAssistantPrefix(options.write);
        options.write(sanitizeDisplayText(result.finalText));
      }
      if (startedAssistant || result.finalText !== "") options.write("\n");
    } catch (error) {
      if (error instanceof UserInterruptedError) {
        options.write("\nCancelled. Conversation context was unchanged.\n");
        continue;
      }
      throw error;
    }
  }
}
