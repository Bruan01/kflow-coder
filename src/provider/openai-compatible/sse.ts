// ExtractedLine 接口：从缓冲区提取一行后的结果
interface ExtractedLine {
  readonly line: string; // 提取的当前行（不含换行符）
  readonly rest: string; // 剩余未处理的缓冲区内容
}

// extractLine：从缓冲区中提取一行（支持 \n、\r\n、\r 三种换行格式）
function extractLine(
  buffer: string,
  endOfStream: boolean, // 是否已是流的末尾
): ExtractedLine | null {
  // 查找 LF 和 CR 的位置
  const lfIndex = buffer.indexOf("\n");
  const crIndex = buffer.indexOf("\r");
  // 取两个候选中存在且最小的索引
  const candidates = [lfIndex, crIndex].filter((index) => index >= 0);
  const lineEnd = candidates.length === 0 ? -1 : Math.min(...candidates);

  if (lineEnd < 0) {
    // 没找到换行符：如果流已结束且有内容，返回整段作为最后一行
    return endOfStream && buffer.length > 0 ? { line: buffer, rest: "" } : null;
  }

  // 如果遇到 \r 且在缓冲区末尾且流未结束，暂时不处理（可能后续是 \n）
  if (
    buffer[lineEnd] === "\r" &&
    lineEnd === buffer.length - 1 &&
    !endOfStream
  ) {
    return null;
  }

  // 计算换行符长度：\r\n 为 2，否则为 1
  const newlineLength =
    buffer[lineEnd] === "\r" && buffer[lineEnd + 1] === "\n" ? 2 : 1;
  return {
    line: buffer.slice(0, lineEnd), // 提取行内容（不含换行符）
    rest: buffer.slice(lineEnd + newlineLength), // 剩余内容
  };
}

// dataValue：从 SSE 行中提取 data 字段的值（遵循 SSE 规范）
function dataValue(line: string): string | null {
  // 以冒号开头的行是 SSE 注释，忽略
  if (line.startsWith(":")) return null;

  const colonIndex = line.indexOf(":");
  // 提取字段名（冒号前的部分）
  const field = colonIndex < 0 ? line : line.slice(0, colonIndex);
  // 只处理 "data" 字段
  if (field !== "data") return null;

  // 提取值（冒号后的部分），去除前导空格（按 SSE 规范）
  const value = colonIndex < 0 ? "" : line.slice(colonIndex + 1);
  return value.startsWith(" ") ? value.slice(1) : value;
}

// decodeSseData：异步生成器函数，解码 SSE（Server-Sent Events）流并逐条产出 data 文本
export async function* decodeSseData(
  stream: ReadableStream<Uint8Array>, // 输入的字节流（通常是 fetch response.body）
): AsyncIterable<string> {
  const reader = stream.getReader(); // 获取流的读取器
  const decoder = new TextDecoder(); // 创建 UTF-8 文本解码器
  const dataLines: string[] = []; // 累积当前事件的 data 行
  let buffer = ""; // 未处理完的文本缓冲区
  let streamComplete = false; // 标记流是否已读完

  try {
    while (true) {
      // 从流中读取一块数据
      const result = await reader.read();
      if (result.done) {
        // 流已结束：解码缓冲区剩余字节（flush 模式）
        streamComplete = true;
        buffer += decoder.decode();
      } else {
        // 流未结束：解码当前块（stream 模式，保留不完整的多字节字符）
        buffer += decoder.decode(result.value, { stream: true });
      }

      // 从缓冲区逐行提取处理
      while (true) {
        const extracted = extractLine(buffer, streamComplete);
        if (extracted === null) break; // 没有完整的行可提取，等待更多数据
        buffer = extracted.rest; // 更新缓冲区为剩余内容

        // 空行表示一个 SSE 事件结束
        if (extracted.line === "") {
          // 如果有累积的 data 行，拼接后产出
          if (dataLines.length > 0) {
            const data = dataLines.join("\n"); // 多行 data 用换行拼接
            dataLines.length = 0; // 清空累积数组
            yield data; // 产出当前事件的 data 内容
          }
          continue;
        }

        // 非空行：提取 data 字段的值
        const value = dataValue(extracted.line);
        if (value !== null) dataLines.push(value); // 累积 data 值
      }

      // 流已读完且没有更多数据可处理
      if (streamComplete) {
        // 如果还有未产出的 data 行，最后产出一次
        if (dataLines.length > 0) yield dataLines.join("\n");
        return; // 结束生成器
      }
    }
  } finally {
    // 清理：如果流未正常完成，取消读取
    if (!streamComplete) await reader.cancel().catch(() => {});
    reader.releaseLock(); // 释放读取器锁
  }
}
