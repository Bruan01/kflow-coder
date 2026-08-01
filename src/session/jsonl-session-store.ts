import { appendFile, chmod, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { SessionStorageError } from "./session-storage-error.js";
import { sessionEventFromJson, type SessionEvent } from "./session-events.js";

export interface SessionLogIssue {
  readonly line: number;
  readonly reason: "invalid-json" | "invalid-event";
}

export interface SessionLogReadResult {
  readonly events: readonly SessionEvent[];
  readonly issues: readonly SessionLogIssue[];
}

export interface SessionStore {
  readonly path: string;
  append(event: SessionEvent): Promise<void>;
  flush(): Promise<void>;
  read(): Promise<SessionLogReadResult>;
}

function serializeEvent(event: SessionEvent): string {
  try {
    return `${JSON.stringify(event)}\n`;
  } catch (error) {
    throw new SessionStorageError("Unable to serialize session event", error);
  }
}

export function createJsonlSessionStore(path: string): SessionStore {
  let pending = Promise.resolve();

  const writeEvent = async (event: SessionEvent): Promise<void> => {
    const serialized = serializeEvent(event);
    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await appendFile(path, serialized, {
        encoding: "utf8",
        mode: 0o600,
      });
      await chmod(path, 0o600);
    } catch (error) {
      if (error instanceof SessionStorageError) throw error;
      throw new SessionStorageError("Unable to append session event", error);
    }
  };

  return {
    path,
    append(event) {
      pending = pending.then(() => writeEvent(event));
      return pending;
    },
    flush() {
      return pending;
    },
    async read() {
      let content: string;
      try {
        content = await readFile(path, "utf8");
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return { events: [], issues: [] };
        }
        throw new SessionStorageError("Unable to read session log", error);
      }

      const events: SessionEvent[] = [];
      const issues: SessionLogIssue[] = [];
      for (const [index, line] of content.split(/\r?\n/).entries()) {
        if (line.trim() === "") continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          issues.push({ line: index + 1, reason: "invalid-json" });
          continue;
        }
        const event = sessionEventFromJson(parsed);
        if (event === undefined) {
          issues.push({ line: index + 1, reason: "invalid-event" });
          continue;
        }
        events.push(event);
      }
      return { events, issues };
    },
  };
}
