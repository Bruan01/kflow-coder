import { appendFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createJsonlSessionStore,
  sessionEventFromJson,
  type SessionEvent,
} from "../../src/session/index.js";

const createdDirectories: string[] = [];

function eventBase(): Pick<
  SessionEvent,
  "version" | "sessionId" | "timestamp"
> {
  return {
    version: 1,
    sessionId: "session-test",
    timestamp: new Date().toISOString(),
  };
}

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("createJsonlSessionStore", () => {
  it("appends ordered events to a private JSONL file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kfc-session-"));
    createdDirectories.push(directory);
    const store = createJsonlSessionStore(join(directory, "session.jsonl"));
    const started: SessionEvent = {
      ...eventBase(),
      type: "session.started",
      cwd: "/tmp/workspace",
      model: "fixture-model",
      protocol: "openai-chat-completions",
    };
    const ended: SessionEvent = {
      ...eventBase(),
      type: "session.ended",
      reason: "user-exit",
    };

    await Promise.all([store.append(started), store.append(ended)]);

    const result = await store.read();
    expect(result).toEqual({ events: [started, ended], issues: [] });
    expect((await stat(store.path)).mode & 0o777).toBe(0o600);
    expect((await readFile(store.path, "utf8")).split("\n")).toHaveLength(3);
  });

  it("skips malformed JSONL records while reporting their line numbers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kfc-session-"));
    createdDirectories.push(directory);
    const store = createJsonlSessionStore(join(directory, "session.jsonl"));
    const valid: SessionEvent = {
      ...eventBase(),
      type: "session.ended",
      reason: "stdin-closed",
    };
    await store.append(valid);
    await appendFile(store.path, "not-json\n{}\n", "utf8");

    const result = await store.read();

    expect(result.events).toEqual([valid]);
    expect(result.issues).toEqual([
      { line: 2, reason: "invalid-json" },
      { line: 3, reason: "invalid-event" },
    ]);
  });

  it("rejects an event with an invalid lifecycle shape", () => {
    expect(
      sessionEventFromJson({
        version: 1,
        sessionId: "session-test",
        timestamp: new Date().toISOString(),
        type: "turn.completed",
        turn: 0,
      }),
    ).toBeUndefined();
  });
});
