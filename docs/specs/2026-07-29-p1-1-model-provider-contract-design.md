# P1.1 ModelProvider 契约设计

- **状态：** 已实现并验证
- **日期：** 2026-07-29
- **阶段：** P1.1 Provider 契约

## 1. 第一性问题

远程模型的协议、网络行为和供应商字段都不稳定，但 Agent Core 需要一个稳定边界来表达三件事：发送哪些对话消息、逐步收到哪些结果、怎样取消或识别失败。

P1.1 不解决真实 HTTP 接入，而是先用最小契约证明 Core 不需要认识 OpenAI、DeepSeek 或任何 SDK 的类型。

## 2. 已批准方案

采用最小文本流契约：

- Core 只认识规范化消息、请求和流式事件。
- `ModelProvider.stream(request, options)` 返回 `AsyncIterable<ModelStreamEvent>`。
- `options.signal` 使用平台标准 `AbortSignal`，不另造取消令牌。
- 流事件只包含 `start`、`text-delta`、`usage` 和 `finish`。
- Provider、协议或网络失败通过现有 `ProviderError` 抛出，不伪装成普通事件。
- 用户取消统一表现为现有 `UserInterruptedError`。
- P1.1 不发起网络请求，不引入供应商 SDK，不定义 Tool Calling 事件。

## 3. 类型边界

### 3.1 消息与请求

消息角色仅包含：

- `system`
- `user`
- `assistant`

每条消息的内容在 P1.1 中只是字符串。请求只包含只读消息序列：

```ts
interface ModelMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

interface ModelRequest {
  readonly messages: readonly ModelMessage[];
}
```

模型名称、Base URL、API Key 和超时属于 Provider 配置或适配器构造参数，不进入每次 Core 请求。`temperature`、`maxTokens` 等采样参数没有当前实验需求，也暂不加入。

### 3.2 Provider

```ts
interface ModelStreamOptions {
  readonly signal?: AbortSignal;
}

interface ModelProvider {
  stream(
    request: ModelRequest,
    options?: ModelStreamOptions,
  ): AsyncIterable<ModelStreamEvent>;
}
```

选择 `AsyncIterable` 而不是回调或原始 `ReadableStream`，是为了让 Core 可以使用统一的 `for await...of` 控制消费、错误传播和提前终止，同时不绑定 Node.js Stream 或 Web Stream。

### 3.3 流式事件

```ts
type ModelFinishReason = "stop" | "length" | "content-filter" | "unknown";

interface ModelTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

type ModelStreamEvent =
  | { readonly type: "start" }
  | { readonly type: "text-delta"; readonly delta: string }
  | { readonly type: "usage"; readonly usage: ModelTokenUsage }
  | { readonly type: "finish"; readonly reason: ModelFinishReason };
```

`unknown` 是供应商结束原因无法安全映射时的显式降级值，不允许把原始供应商字符串泄漏到 Core。Tool Calling 尚未进入当前阶段，因此不预留 `tool-call-*` 或 `finish: "tool-calls"`。

## 4. 事件流不变量

一个成功流必须满足：

1. `start` 恰好出现一次，并且是第一个事件。
2. 可以没有 `text-delta`，也可以有多个；适配器不应发送空字符串 delta。
3. `usage` 最多出现一次；只有 Provider 给出完整、可信的统计时才发送。
4. Token 数必须是非负整数，`totalTokens` 应等于 `inputTokens + outputTokens`。
5. `finish` 恰好出现一次，并且是最后一个事件。
6. `finish` 之后不得再发送事件。
7. 若流失败或被取消，可以在 `finish` 前抛错；失败流不伪造成功结束事件。

P1.1 通过 Mock 证明消费者可以依赖这一顺序。未来真实适配器测试负责证明协议 chunk 被正确归一化成该顺序。

## 5. 错误与取消

- 认证、限流、超时、上下文上限、服务不可用和非法响应继续使用现有 `ProviderError` 稳定错误码。
- Provider 实现不得把原始响应正文、Authorization、API Key、第三方错误或 Stack 放入公开错误字段。
- 调用方通过 `AbortSignal` 发出取消。Provider 必须在请求开始前和流消费期间观察该信号。
- 因调用方取消而终止时抛 `UserInterruptedError`；不能把用户取消误报为 Provider 超时或内部错误。
- 错误在异步迭代期间自然传播，消费者无需监听额外的 `error` 事件。

## 6. 备选方案与取舍

### 方案 A：最小文本流契约（采用）

优点是边界小、可测试、不预支未知需求，足以支撑 P1 单轮文本调用。代价是 P3 Tool Calling 到来时需要扩展事件联合类型。

### 方案 B：提前定义 Tool Calling 事件（拒绝）

可能减少未来一次类型变更，但目前没有真实协议轨迹证明工具参数增量、并行调用和结束语义应怎样统一，容易把猜测固化成 Core 契约。

### 方案 C：直接暴露 OpenAI-compatible chunk（拒绝）

适配工作最少，但会把 `choices`、`delta`、`finish_reason` 等供应商协议结构传入 Core，使供应商兼容差异扩散到 Agent Loop 和测试。

## 7. 文件与导出设计

计划新增：

- `src/provider/model-provider.ts`：全部供应商无关类型与 `ModelProvider` 接口。
- `src/provider/index.ts`：Provider 公共出口。
- `tests/provider/model-provider.test.ts`：Mock 成功流、错误传播、取消与类型边界测试。

根 `src/index.ts` 只重新导出公共 Provider 契约。生产代码中不加入 Mock；Mock 只属于测试证据。

## 8. 验收证据

P1.1 完成需同时证明：

1. 一个不依赖网络的 Mock 可以实现 `ModelProvider` 并产生确定的成功事件序列。
2. 消费者能按顺序拼接文本并读取规范化 usage 与 finish reason。
3. Mock 抛出的 `ProviderError` 在异步迭代边界保持结构化信息。
4. 已中断或消费期间中断的 `AbortSignal` 会产生 `UserInterruptedError`，并停止后续事件。
5. 公共类型不导入供应商 SDK、CLI 或配置实现类型。
6. `pnpm build`、`pnpm test`、`pnpm lint` 和 `pnpm format:check` 全部通过。

## 9. 明确非目标

- 真实 DeepSeek/OpenAI-compatible HTTP 请求。
- SSE/JSON chunk 解析与供应商错误响应映射。
- CLI `kfc ask`。
- 超时计时器实现。
- 首 Token 延迟和总耗时采集器。
- Tool Calling、多模态消息、reasoning 内容或供应商扩展字段。
- 运行时事件校验器；只有真实外部协议进入适配器时才在边界增加验证。

## 10. 后续演进

P1.2 将用真实 OpenAI-compatible 协议实现本契约，并用录制 Fixture 验证 chunk 映射、错误标准化、超时和取消。只有真实 Tool Calling 实验表明文本事件不足时，才扩展消息内容和事件联合类型。
