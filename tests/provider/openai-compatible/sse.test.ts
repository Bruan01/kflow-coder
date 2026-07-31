import { describe, expect, it, vi } from "vitest";

import { decodeSseData } from "../../../src/provider/openai-compatible/sse.js";

function streamFromChunks(
  chunks: readonly Uint8Array[],
  cancel = vi.fn(),
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel,
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const events: string[] = [];
  for await (const data of decodeSseData(stream)) events.push(data);
  return events;
}

describe("decodeSseData", () => {
  it("decodes UTF-8, CRLF, split lines, and multiple events", async () => {
    const encoded = new TextEncoder().encode(
      ': keep-alive\r\nevent: message\r\ndata: {"text":"你好"}\r\n\r\n' +
        "data: second\n\n",
    );
    const splitInsideUnicode = encoded.indexOf(0xe4) + 1;
    const chunks = [
      encoded.slice(0, 9),
      encoded.slice(9, splitInsideUnicode),
      encoded.slice(splitInsideUnicode, encoded.length - 3),
      encoded.slice(encoded.length - 3),
    ];

    await expect(collect(streamFromChunks(chunks))).resolves.toEqual([
      '{"text":"你好"}',
      "second",
    ]);
  });

  it("joins multiple data fields and dispatches a final unterminated event", async () => {
    const stream = streamFromChunks([
      new TextEncoder().encode("data: first\ndata: second"),
    ]);

    await expect(collect(stream)).resolves.toEqual(["first\nsecond"]);
  });

  it("cancels the reader when the consumer exits early", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("data: first\n\n"));
      },
      cancel,
    });

    for await (const data of decodeSseData(stream)) {
      expect(data).toBe("first");
      break;
    }

    expect(cancel).toHaveBeenCalledOnce();
  });
});
