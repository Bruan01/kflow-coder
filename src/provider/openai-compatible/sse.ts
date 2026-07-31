interface ExtractedLine {
  readonly line: string;
  readonly rest: string;
}

function extractLine(
  buffer: string,
  endOfStream: boolean,
): ExtractedLine | null {
  const lfIndex = buffer.indexOf("\n");
  const crIndex = buffer.indexOf("\r");
  const candidates = [lfIndex, crIndex].filter((index) => index >= 0);
  const lineEnd = candidates.length === 0 ? -1 : Math.min(...candidates);

  if (lineEnd < 0) {
    return endOfStream && buffer.length > 0 ? { line: buffer, rest: "" } : null;
  }

  if (
    buffer[lineEnd] === "\r" &&
    lineEnd === buffer.length - 1 &&
    !endOfStream
  ) {
    return null;
  }

  const newlineLength =
    buffer[lineEnd] === "\r" && buffer[lineEnd + 1] === "\n" ? 2 : 1;
  return {
    line: buffer.slice(0, lineEnd),
    rest: buffer.slice(lineEnd + newlineLength),
  };
}

function dataValue(line: string): string | null {
  if (line.startsWith(":")) return null;

  const colonIndex = line.indexOf(":");
  const field = colonIndex < 0 ? line : line.slice(0, colonIndex);
  if (field !== "data") return null;

  const value = colonIndex < 0 ? "" : line.slice(colonIndex + 1);
  return value.startsWith(" ") ? value.slice(1) : value;
}

export async function* decodeSseData(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const dataLines: string[] = [];
  let buffer = "";
  let streamComplete = false;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        streamComplete = true;
        buffer += decoder.decode();
      } else {
        buffer += decoder.decode(result.value, { stream: true });
      }

      while (true) {
        const extracted = extractLine(buffer, streamComplete);
        if (extracted === null) break;
        buffer = extracted.rest;

        if (extracted.line === "") {
          if (dataLines.length > 0) {
            const data = dataLines.join("\n");
            dataLines.length = 0;
            yield data;
          }
          continue;
        }

        const value = dataValue(extracted.line);
        if (value !== null) dataLines.push(value);
      }

      if (streamComplete) {
        if (dataLines.length > 0) yield dataLines.join("\n");
        return;
      }
    }
  } finally {
    if (!streamComplete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
