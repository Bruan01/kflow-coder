# P1.2 OpenAI-compatible Provider 设计

- **状态：** 已实现并验证
- **日期：** 2026-07-31
- **阶段：** P1.2 OpenAI-compatible Provider
- **外部协议最后核验：** 2026-07-31

## 1. 第一性问题

Core 已经拥有供应商无关的 `ModelProvider` 契约，但真实模型服务暴露的是不稳定的 HTTP、SSE、JSON 和错误响应。P1.2 要解决的问题不是“怎样调用 DeepSeek”，而是怎样把一种主流线协议可靠地归一化成 Core 已经理解的事件，同时让后续协议可以独立接入而不污染 Core。

## 2. 已确认方向

采用“稳定 Core + 显式协议适配器”设计：

- Core 继续只依赖 `ModelProvider`、内部消息、内部流式事件和结构化领域错误。
- Provider 层按线协议组织适配器，不按供应商品牌复制 Core 类型。
- P1.2 完整实现 `openai-chat-completions`。
- 后续依次接入 `openai-responses` 与 `anthropic-messages`，每次使用独立 Fixture 验证。
- 配置显式声明协议，不根据 URL、模型名或响应内容自动猜测。
- 使用 Node.js 22 原生 `fetch` 与 Web Streams，不引入供应商 SDK。
- DeepSeek 只作为首个真实回归目标；模型名、Base URL 和供应商扩展字段不得进入 Core 契约。

## 3. 方案比较

### 方案 A：独立协议适配器（采用）

每种线协议拥有独立的请求编码、响应 Schema、SSE 事件映射与错误映射，最终实现同一个 `ModelProvider`。

优点：协议差异可见、测试边界清楚、失败可诊断，新增协议不需要修改 Agent Core。代价是多个协议之间会存在少量有意重复，只有第二个适配器出现后才提取共享机制。

### 方案 B：自动探测的万能兼容 Provider（拒绝）

根据 URL、响应字段或失败后重试来猜测协议。表面配置更少，但会让一次请求产生隐式分支、重复计费和不确定错误，Fixture 也无法证明实际走了哪条协议。

### 方案 C：每种供应商使用官方 SDK（拒绝）

初期 HTTP 代码较少，但 SDK 类型、重试、超时与错误模型会扩散到公共边界。不同 SDK 还会让取消和事件语义失去统一控制。

## 4. P1.2 范围

本任务实现：

- `openai-chat-completions` 请求编码与流式响应解析。
- HTTP 状态、网络失败、超时、用户取消和非法响应的结构化归一化。
- 完整的确定性 Fixture 测试，不调用真实外部服务。
- 为真实 DeepSeek 回归提供可实例化的 Provider，但不在自动化测试中读取真实 API Key。

本任务不实现：

- `openai-responses` 或 `anthropic-messages` 的生产适配器。
- CLI `kfc ask`、重试策略、指标采集、Tool Calling 或 reasoning 输出。
- 自动协议探测、供应商预设、模型枚举或实时模型列表查询。
- Provider SDK、EventSource 或第三方 SSE 库。

## 5. 配置边界

在现有 Provider 配置中增加显式协议：

```ts
interface ProviderConfig {
  type: "openai-compatible";
  protocol: "openai-chat-completions";
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}
```

P1.2 只有一个已实现协议，但仍保存协议字段，避免以后通过 URL 或供应商名推断。旧配置缺少该字段时，在配置边界补默认值 `openai-chat-completions`，保持现有用户文件兼容；Quickstart 写出的新配置包含该字段。

当 `openai-responses` 或 `anthropic-messages` 真正实现时，再扩展协议联合类型与 Provider 工厂。P1.2 不创建只有一个成员的抽象注册表。

## 6. 模块边界

计划新增：

- `src/provider/openai-compatible/openai-chat-completions-provider.ts`：实现 `ModelProvider`，负责编排请求、生命周期与事件顺序。
- `src/provider/openai-compatible/sse.ts`：纯增量 SSE 解码状态机。
- `src/provider/openai-compatible/chat-completions-schema.ts`：使用 Zod 校验外部 JSON chunk 与安全错误字段。
- `src/provider/openai-compatible/error-mapping.ts`：将 HTTP、网络和协议失败映射成稳定领域错误。
- `src/provider/openai-compatible/index.ts`：公开构造器与必要类型。
- `tests/provider/openai-compatible/`：请求、SSE、错误、超时和取消测试。
- `tests/fixtures/provider/openai-chat-completions/`：脱敏 SSE 与错误响应 Fixture。

`src/provider/model-provider.ts` 不导入上述模块。协议适配器单向依赖 Core 契约、配置值和错误类型。

## 7. 请求编码

适配器向 `${baseUrl 去除末尾斜杠}/chat/completions` 发送：

```http
POST /chat/completions
Authorization: Bearer <API Key>
Content-Type: application/json
Accept: text/event-stream
```

最小请求体为：

```json
{
  "model": "configured-model",
  "messages": [{ "role": "user", "content": "..." }],
  "stream": true,
  "stream_options": { "include_usage": true }
}
```

不发送 `temperature`、`max_tokens`、thinking、tools 或供应商扩展字段。API Key 只进入请求 Header，禁止进入事件、错误、日志、Fixture 或 Snapshot。

## 8. 成功流状态机

只有 HTTP 状态成功、响应体存在且 `Content-Type` 为 `text/event-stream` 后，适配器才发送首个 `{ type: "start" }`。

SSE 解码器必须正确处理：

- 任意网络 chunk 边界，包括 UTF-8 多字节字符被拆分。
- `LF` 与 `CRLF`。
- 一个网络 chunk 中多个事件，以及一个事件跨多个网络 chunk。
- 注释、未知 SSE 字段和多行 `data:`。
- 流尾 `data: [DONE]`。

每个 JSON chunk 先经 Zod 校验，再按以下规则映射：

- `choices[0].delta.content` 为非空字符串时发送 `text-delta`。
- 空字符串 content 不产生事件。
- 完整且可信的 usage 映射为一次 `usage`。
- `stop`、`length`、`content_filter` 分别映射为 `stop`、`length`、`content-filter`；其他原因映射为 `unknown`。
- 为保证 `finish` 永远是最后一个事件，适配器记录 finish reason，直到收到 `[DONE]` 才发送 `finish`。

流必须在第一个 `[DONE]` 前看到恰好一个 finish reason；`[DONE]` 是终止帧，收到后立即发送 `finish` 并释放 reader。EOF 提前到达、重复 usage、缺失 index 0 choice、非法 JSON、非法 Token 统计或 finish reason 后出现文本，都抛 `PROVIDER_INVALID_RESPONSE`，不得伪造成功结束。

## 9. 超时、取消与提前停止

每次 `stream()` 创建内部 `AbortController`，同时观察调用方 `AbortSignal` 与配置的 `timeoutMs`：

- 请求开始前调用方已取消：抛 `UserInterruptedError`，不调用 fetch。
- 请求中或消费中由调用方取消：中止 fetch/reader，抛 `UserInterruptedError`。
- 内部计时器先触发：中止 fetch/reader，抛 `PROVIDER_TIMEOUT`。
- 消费者提前退出 `for await`：在 generator `finally` 中中止并释放底层 reader，不继续下载响应。
- 正常、失败、取消和提前退出都必须清理 timer 与 abort listener。

取消原因按本地状态判定，不依赖不同运行时的原始 `AbortError` 文案。

## 10. 错误映射

公开错误只包含稳定、安全的 KFC 信息。第三方响应正文、请求 Header、API Key、原始异常 message 和 Stack 不进入公开 message/details。

最低映射表：

| 信号                                                                  | KFC code                         | Retryable |
| --------------------------------------------------------------------- | -------------------------------- | --------: |
| HTTP 401/403                                                          | `PROVIDER_AUTHENTICATION_FAILED` |        no |
| HTTP 402，或明确的机器可读 quota code（包括 429 响应中的 quota code） | `PROVIDER_QUOTA_EXCEEDED`        |        no |
| HTTP 408/504，或内部 timer                                            | `PROVIDER_TIMEOUT`               |       yes |
| HTTP 429                                                              | `PROVIDER_RATE_LIMITED`          |       yes |
| 明确的机器可读 context-limit code                                     | `PROVIDER_CONTEXT_LIMIT`         |        no |
| HTTP 500/502/503                                                      | `PROVIDER_SERVICE_UNAVAILABLE`   |       yes |
| 非法 2xx 响应、其他 4xx、未知状态                                     | `PROVIDER_INVALID_RESPONSE`      |        no |
| 调用方 AbortSignal                                                    | `USER_INTERRUPTED`               |        no |

真实协议暴露了现有错误集合缺少“额度耗尽”。P1.2 增加 `PROVIDER_QUOTA_EXCEEDED`，而不是把 402 错标为认证失败或可重试的服务异常。

分类先检查受限长度、经 Zod 校验并通过 allowlist 的机器可读错误 code，再按 HTTP 状态回退。因此带明确 quota code 的 429 映射为额度耗尽，普通 429 映射为限流。不得使用第三方 message 的模糊字符串匹配决定重试或公开展示。

## 11. 依赖注入与测试

Provider 构造器接受默认值为 `globalThis.fetch` 的最小 fetch 依赖。测试注入脚本化 fetch，返回真实 `Response` 与分块 `ReadableStream`，从 HTTP 边界验证行为，而不是直接调用内部映射函数冒充集成测试。

Fixture 至少覆盖：

1. DeepSeek 官方形状：最终 chunk 同时包含 finish reason 与 usage。
2. OpenAI 主流形状：finish chunk 后再出现 choices 为空的 usage chunk。
3. UTF-8、CRLF、跨 chunk JSON 与多个 SSE event 同 chunk。
4. 空 delta、未知 finish reason 和合法无文本响应。
5. 非 2xx 状态映射及秘密不泄漏。
6. 非 SSE、空 body、非法 JSON、缺失 `[DONE]`、非法 usage 和事件顺序错误。
7. 请求前取消、fetch 期间取消、流消费期间取消、超时和消费者提前退出。
8. 请求 URL、method、headers 与 JSON body 精确匹配，且 Fixture 和错误输出不含 API Key。

自动化测试不得访问网络、读取开发者环境变量或真实配置文件。

## 12. 验收条件

P1.2 只有同时满足以下条件才完成：

1. `OpenAiChatCompletionsProvider` 实现 P1.1 `ModelProvider`，Core 类型无协议字段。
2. 两种主流 usage/finish chunk 顺序都归一化为合法内部事件序列。
3. 超时、用户取消和消费者提前退出均停止底层流并清理资源。
4. 所有外部 JSON 均通过结构化 Schema 校验，不信任类型断言。
5. HTTP 与协议失败只产生安全、稳定的领域错误，API Key 和原始响应不泄漏。
6. `pnpm build`、`pnpm lint`、`pnpm format:check`、Provider 定向测试和全量 `pnpm test` 全部通过。
7. 更新配置文档、错误文档、ADR 外部核验日期、TODO 与学习日志，并生成 LR Machine Snapshot。

## 13. 官方协议核验

截至 2026-07-31，DeepSeek 官方资料确认：

- OpenAI 格式 Base URL 为 `https://api.deepseek.com`。
- Chat Completions 为 `POST /chat/completions`。
- `deepseek-v4-flash` 与 `deepseek-v4-pro` 均是有效模型名。
- `stream_options.include_usage` 可在 `[DONE]` 前提供 usage。
- SSE 使用 data-only 事件并以 `data: [DONE]` 终止。
- 官方 2026-07-31 更新确认 `deepseek-v4-flash` 正式版进入 public beta。

来源：

- `https://api-docs.deepseek.com/api/create-chat-completion`
- `https://api-docs.deepseek.com/quick_start/pricing`
- `https://api-docs.deepseek.com/quick_start/error_codes`
- `https://api-docs.deepseek.com/updates`

## 14. 后续演进

P1.3 可按同一验收标准增加 `openai-responses`；只有两个真实适配器出现重复后，才提取共享 HTTP 生命周期、SSE 或错误映射工具。`anthropic-messages` 在下一独立任务接入，用来验证当前内部消息和流事件是否仍足够，而不是提前扩大 Core 联合类型。
