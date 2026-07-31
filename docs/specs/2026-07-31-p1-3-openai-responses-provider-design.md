# P1.3 OpenAI Responses Provider 设计

- **状态：** 已实现并验证
- **日期：** 2026-07-31
- **阶段：** P1.3 OpenAI Responses Provider
- **外部协议最后核验：** 2026-07-31

## 1. 第一性问题

P1.2 已证明 OpenAI Chat Completions 可以归一化为稳定的 `ModelProvider`。P1.3 要验证的是：面对事件类型、终止条件和输出结构都不同的 Responses 协议，Core 是否仍能只理解文本、usage、finish、取消和结构化错误，而不被 OpenAI 的 reasoning、tool、item 或 response 类型污染。

本任务采用“文本投影”：只保留用户最终可见的普通文本与拒绝文本，保留 Token 用量和终止原因；不把 reasoning 或工具调用引入 Core。

## 2. 已确认方向

- 新增独立协议值 `openai-responses`，不修改 `openai-chat-completions` 适配器的线协议行为。
- 向 `<baseUrl>/responses` 发送流式请求，并显式设置 `store: false`。
- `response.output_text.delta` 与 `response.refusal.delta` 都映射为 Core `text-delta`。
- 已知 lifecycle 与 reasoning 事件经过 Schema 校验后忽略。
- 未请求的 function、tool、MCP、搜索、图像、音频等输出事件直接拒绝，不静默丢失语义。
- `response.completed` 或 `response.incomplete` 是成功终止事件；Responses 流不依赖 Chat Completions 的 `[DONE]` 标记。
- 同一响应只允许一个用户可见文本位置；出现多个位置时拒绝，避免把不同 output item 或 content part 无边界拼接。
- 自动化测试只使用官方形状的确定性 Fixture，不调用真实 OpenAI 服务，不读取开发者凭证。

## 3. 方案比较

### 方案 A：严格文本投影（采用）

普通输出与拒绝输出归一化为 `text-delta`，reasoning 被忽略，超出当前 Core 表达能力的工具或多位置输出被拒绝。

优点是 Core 无需提前扩张，且不会静默吞掉可能改变 Agent 行为的输出。代价是 P1.3 不能承载 Tool Calling、多模态或并行输出；这些能力必须在后续阶段以新的内部契约显式接入。

### 方案 B：宽松扁平化所有文本（拒绝）

把多个 output item、content part、reasoning 和 refusal 依次拼成一个字符串。实现表面简单，但会丢失边界并可能把隐藏推理暴露给用户，Core 也无法判断拼接后的语义。

### 方案 C：立即扩张 Core 事件联合类型（拒绝）

为 Responses 的 item、reasoning、tool 和多模态事件增加内部类型。当前 P1 只需要单轮文本调用，没有真实 Agent Loop 消费这些信息；此时扩张只会把供应商协议结构误当成领域模型。

## 4. 范围

本任务实现：

- `openai-responses` 请求编码、SSE 事件校验与文本投影。
- completed、incomplete、failed 和 error 的明确终止行为。
- usage、finish reason、事件序号和单文本位置不变量。
- 配置文件、环境变量与 Quickstart 的显式协议选择。
- 复用 P1.2 的 SSE、HTTP 错误、安全输出、超时和取消语义。

本任务不实现：

- `previous_response_id`、服务端会话状态或 Responses 默认存储。
- reasoning 参数、reasoning 内容展示或 reasoning token 的新 Core 字段。
- Tool Calling、function calling、MCP、内置搜索、计算机操作、图像或音频输出。
- 多个 output item/content part 的无损内部表示。
- 非流式 Responses、结构化输出、供应商预设或协议自动探测。
- CLI `kfc ask`、真实网络验收、重试策略或指标采集。

## 5. 配置边界

协议联合类型扩展为：

```ts
type ProviderProtocol = "openai-chat-completions" | "openai-responses";
```

`KFC_PROTOCOL`、配置文件 Schema 与 Quickstart 接受这两个精确值。缺少协议字段时仍默认 `openai-chat-completions`，现有配置和 DeepSeek 回归行为不变。Quickstart 增加协议问题，默认也是 `openai-chat-completions`；它只展示协议名，不增加供应商品牌预设。

P1.3 不增加自动探测，也不创建尚无调用方的全局 Provider 工厂。适配器继续可通过公开构造器显式实例化。

## 6. 模块边界

计划新增：

- `src/provider/openai-compatible/responses-schema.ts`：Responses SSE 事件与终端 response 的 Zod Schema。
- `src/provider/openai-compatible/openai-responses-provider.ts`：请求编排、事件状态机与 Core 投影。
- `tests/provider/openai-compatible/responses-schema.test.ts`：外部事件边界测试。
- `tests/provider/openai-compatible/openai-responses-provider.test.ts`：请求、映射、顺序与失败测试。
- `tests/fixtures/provider/openai-responses/`：脱敏的官方形状 SSE Fixture。

直接复用：

- `sse.ts` 的增量 SSE 解码器。
- `error-mapping.ts` 的 HTTP 状态与机器错误码规则。
- `KfcError`、`ProviderError`、`UserInterruptedError` 和 Core `ModelProvider` 类型。

第二个协议会暴露与 P1.2 相同的 timeout、AbortSignal、资源清理代码。实现时只提取已被两个适配器共同证明的最小生命周期帮助函数，并让 Chat Completions 现有测试继续作为回归保护；不创建通用“万能 Provider”或统一协议事件模型。

## 7. 请求编码

适配器向 `${baseUrl 去除末尾斜杠}/responses` 发送：

```http
POST /responses
Authorization: Bearer <API Key>
Content-Type: application/json
Accept: text/event-stream
```

最小请求体为：

```json
{
  "model": "configured-model",
  "input": [
    { "role": "system", "content": "Answer briefly." },
    { "role": "user", "content": "Say hello." }
  ],
  "stream": true,
  "store": false
}
```

Core 的 `system`、`user`、`assistant` 文本消息按原顺序作为 Responses `input`。不发送 `previous_response_id`、temperature、max output tokens、reasoning、tools 或供应商扩展字段。API Key 只进入 Authorization Header。

## 8. SSE 事件校验

每个 SSE `data` 必须是合法 JSON，并先通过以 `type` 为判别字段的 Zod Schema。所有事件必须包含非负整数 `sequence_number`，且在单次流中严格递增；重复或倒序视为 `PROVIDER_INVALID_RESPONSE`。不要求第一个序号固定为 0，以免把传输片段假设成协议不变量。

允许并忽略的事件包括：

- response created、queued、in-progress 等生命周期事件。
- output item 与 content part 的 added/done 包装事件。
- output text/refusal 的 done 事件。
- reasoning text、reasoning summary 及其 part 的 delta/done 事件。

只有 `response.output_text.delta` 和 `response.refusal.delta` 产生 Core 文本事件。任何 function call、custom tool、MCP、web/file search、computer、image、audio 或其他未请求的输出事件都失败。未知 `type` 同样失败，防止协议新增语义被静默吞掉。

Responses 不使用 `[DONE]` 作为本适配器的成功条件；收到字符串 `[DONE]`、SSE EOF 前没有终端事件、非法 JSON 或不合法事件结构都属于无效响应。

## 9. 文本投影状态机

适配器在 HTTP 成功、Content-Type 为 `text/event-stream` 且 body 存在后，先发送一次 `{ type: "start" }`。

第一个普通文本或拒绝文本事件确定唯一可见位置，其身份由事件种类、`item_id`、`output_index` 与 `content_index` 组成：

- 同一位置的非空 delta 按线协议顺序映射为 `text-delta`。
- 空 delta 不产生 Core 事件，但仍参与位置和顺序校验。
- 后续出现不同种类或不同位置的可见文本事件时失败。
- 对应 done 事件只关闭该位置，不重复发送完整文本；done 后再次出现 delta 时失败。
- 没有可见文本的合法 completed/incomplete 响应仍可只产生 start、usage 和 finish。

拒绝文本之所以进入 `text-delta`，是因为它是应展示给用户的最终回答，而不是隐藏 reasoning。Core 当前无需知道模型是正常回答还是拒绝；若后续策略需要区分，再由真实需求扩展契约。

## 10. Usage 与终止

Token 使用量只从终端 response 对象读取：

```text
input_tokens  -> inputTokens
output_tokens -> outputTokens
total_tokens  -> totalTokens
```

数值必须是非负整数，且 `total_tokens === input_tokens + output_tokens`。usage 为 `null` 或缺失时不伪造 `usage`；存在时恰好发送一次，并保证在 `finish` 之前。

终止映射：

| Responses 事件                                     | Core 行为                                   |
| -------------------------------------------------- | ------------------------------------------- |
| `response.completed`                               | 可选 usage，然后 `finish: stop`             |
| `response.incomplete` 且原因是 `max_output_tokens` | 可选 usage，然后 `finish: length`           |
| `response.incomplete` 且原因是 `content_filter`    | 可选 usage，然后 `finish: content-filter`   |
| `response.incomplete` 的其他原因                   | 可选 usage，然后 `finish: unknown`          |
| `response.failed`                                  | 抛安全的结构化 Provider 错误，不发送 finish |
| `error`                                            | 抛安全的结构化 Provider 错误，不发送 finish |

completed/incomplete 的 response.status 必须和事件类型一致。第一个终端事件结束消费，`finish` 永远是最后一个 Core 事件。

## 11. 错误、安全与生命周期

非 2xx HTTP 响应继续使用 P1.2 映射。流内 failed/error 只读取经过 Schema 校验且受限长度的机器错误码：已知 quota、context limit、rate limit 与 server error 映射到既有稳定错误；未知码保守映射为 `PROVIDER_INVALID_RESPONSE`。第三方 message、response 正文、Header、API Key、原始异常和 Stack 不进入公开错误。

生命周期保持 P1.2 不变量：

- 请求前已取消时不调用 fetch，抛 `USER_INTERRUPTED`。
- 调用方在 fetch 或消费期间取消时，中止请求与 reader，抛 `USER_INTERRUPTED`。
- 内部 deadline 触发时抛可重试的 `PROVIDER_TIMEOUT`。
- 消费者提前退出时取消底层流。
- 正常、失败、超时和取消路径都清理 timer、listener 与 reader。

## 12. 测试证据

确定性测试至少覆盖：

1. 请求 URL、method、headers、`input`、`stream: true` 和 `store: false` 精确匹配。
2. 官方形状的普通文本流映射为 start、多个 text-delta、usage、finish。
3. refusal delta 映射为用户可见文本；reasoning 事件不进入 Core。
4. completed 与两种已知 incomplete 原因，以及未知 incomplete 原因。
5. usage 缺失、非法 Token、状态不一致和 EOF 缺少终端事件。
6. sequence number 重复/倒序、done 后 delta、多个文本位置和 `[DONE]`。
7. 意外 tool/function 事件与未知事件被拒绝。
8. response.failed、error 和非 2xx HTTP 的安全错误映射，不泄漏 Fixture 文本或 API Key。
9. 请求前取消、fetch 期间取消、流期间取消、超时和消费者提前退出。
10. Chat Completions 全量回归，证明共享生命周期提取没有改变 P1.2 行为。

自动化测试注入 fetch，并使用真实 `Response`、`ReadableStream` 和分块 SSE 数据；不访问网络、真实环境变量或用户配置。

## 13. 验收条件

P1.3 只有同时满足以下条件才完成：

1. `OpenAiResponsesProvider` 实现现有 `ModelProvider`，Core 类型没有新增 OpenAI 字段。
2. 普通文本与拒绝文本可靠投影，reasoning 被忽略，意外工具或多位置输出被拒绝。
3. completed/incomplete、usage、sequence 和终止顺序均有确定性反例测试。
4. `openai-responses` 可通过配置文件、`KFC_PROTOCOL` 与 Quickstart 显式选择，旧配置默认行为不变。
5. 超时、取消、提前退出和安全错误满足 P1.2 的相同不变量。
6. `pnpm build`、`pnpm typecheck:tests`、`pnpm lint`、`pnpm format:check`、定向测试和全量 `pnpm test` 全部通过。
7. 更新 Provider/配置/Quickstart 文档、TODO 与学习日志，并生成 LR Machine Snapshot。

## 14. 官方协议核验

截至 2026-07-31，OpenAI 官方资料确认：

- Responses 使用带 `type` 的语义化 SSE 事件。
- 主要文本事件为 `response.output_text.delta`，成功终止事件为 `response.completed`。
- Responses 可以直接接受消息数组作为 `input`。
- Response 默认存储，`store: false` 可关闭存储。
- 终端 response 的 usage 使用 `input_tokens`、`output_tokens` 与 `total_tokens`。
- incomplete reason 包括 `max_output_tokens` 与 `content_filter`。
- refusal 与 reasoning 拥有独立流事件，不能和普通输出文本盲目等同处理。

来源：

- `https://developers.openai.com/api/docs/guides/streaming-responses`
- `https://developers.openai.com/api/docs/guides/responses-vs-chat-completions`
- `https://developers.openai.com/api/docs/api-reference/responses-streaming`

当前会话未暴露已安装的 OpenAI Developer Docs MCP，因此以上内容使用同一官方域名页面核验；实现不依赖非官方资料。

## 15. 后续演进

P1.4 将以独立 `anthropic-messages` 适配器继续检验 Core 边界。Tool Calling 在 P2 Agent Loop 中出现真实消费者后再设计内部工具事件；届时可重新评估 Responses 中被 P1.3 明确拒绝的 function/tool 事件，而不是修改本次文本投影的含义。
