# ADR-0004：使用显式线协议适配器

- **状态：** Accepted
- **决定日期：** 2026-07-31

## 背景

KFC 的 Core 只需要稳定的消息、文本流、usage、finish、取消和错误语义，但外部模型服务同时存在 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 等主流协议。它们在请求字段、SSE 事件、结束条件、usage 位置、认证 Header 和错误格式上并不相同。

如果根据 URL、模型名或首次响应自动猜测协议，一次用户请求可能产生隐式分支、重复计费和不可复现失败。如果直接暴露供应商 SDK 类型，协议差异会扩散到 Core。

## 决定

- Core 继续只依赖供应商无关的 `ModelProvider`。
- 配置显式声明线协议，不自动探测。
- 每种主流协议使用独立适配器，实现自己的请求编码、外部 Schema、流事件和错误映射。
- 首个适配器为 `openai-chat-completions`，第二个为 `openai-responses`；只有真实主路线需要时才继续增加 `anthropic-messages`。
- 使用平台 `fetch`、`AbortSignal` 和 Web Streams，不让供应商 SDK 类型进入公共契约。
- 只有至少两个真实适配器暴露相同复杂度后，才提取共享 HTTP/SSE 抽象。

## 结果

收益：

- 每次请求走哪种协议可配置、可测试、可诊断。
- 协议升级或供应商差异停留在适配器内部。
- Fixture 能独立证明每种线协议如何映射到同一 Core 契约。

代价：

- 协议适配器之间会保留少量有意重复。
- 增加协议需要独立的 Schema、Fixture、错误和生命周期测试。
- 当前内部契约不足时，必须用真实跨协议证据推动演进，不能靠自动兼容掩盖差异。

## 实施结果（2026-07-31）

- Chat Completions 与 Responses 已分别使用独立 Schema、请求编码和终止状态机实现。
- 两个适配器证明 timeout、AbortSignal、未知网络错误和资源清理具有稳定共性，因此只提取了最小 request lifecycle；协议事件仍保持独立。
- `kfc ask` 通过显式协议工厂消费统一 `ModelProvider`，没有根据 DeepSeek URL 或模型名推断协议。
- 首次真实 DeepSeek V4 Flash 调用成功，使用 Chat Completions 路径返回 `finish=stop`、完整 usage 和流式文本。
- `anthropic-messages` 经用户确认延期。它不再是 P1 完成门槛；未来只有在现有协议不能覆盖真实需求时重新评估。

## 拒绝方案

- 自动探测协议：行为不确定，失败可能产生额外请求和费用。
- 一个万能解析器：条件分支随协议增长，错误来源难以定位。
- 每种供应商直接使用 SDK：SDK 类型和隐式重试/超时会污染统一边界。

## 重新评估条件

- 两个以上协议适配器证明存在稳定、非偶然的共享机制。
- 某种协议无法合理映射到当前 `ModelProvider`，且真实任务需要保留额外语义。
- 平台原生 fetch/Web Streams 无法满足可观察性、性能或协议要求。
