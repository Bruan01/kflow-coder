# ADR-0007：使用显式只读 Agent 接通 Chat Completions Tool Calling

- **状态：** Accepted
- **决定日期：** 2026-08-01

## 背景

P2.1 的受控 Agent Loop、P2.2 的 Registry 和 P2.3 的工作区只读工具均已可在本地确定性测试，但真实 `kfc ask` 仍是文本单轮请求。把工具能力偷偷加到 `ask` 会把一个原本无本地文件权限的命令变成有文件读取能力的命令；同时，Core 不能直接依赖 OpenAI 的 `delta.tool_calls` 分片。

## 决定

- 新增显式 `kfc agent <prompt...>`；`kfc ask` 保持文本单轮语义。
- 第一阶段仅接通 `openai-chat-completions`。`openai-responses` 收到工具定义时明确拒绝，Anthropic Messages 继续延期。
- ToolDefinition 可选地声明模型安全 JSON Schema parameters，Zod inputSchema 仍是执行时权威。
- Chat Completions 适配器负责 message、tools、assistant tool_calls 与 tool result 的双向编码，并在 Provider 层组装完整 JSON Tool Call。
- CLI 使用 `process.cwd()` 创建 P2.3 只读工具，最多八次模型调用，并让 Provider 与工具共享一个 SIGINT AbortSignal。

## 结果

收益：

- 用户在命令层可见地选择本地只读能力。
- Agent Loop、Registry 和工作区安全边界无需知道供应商分片格式。
- 真实 DeepSeek-compatible Chat Completions 可完成读取和总结工作区的闭环。

代价：

- ToolDefinition 同时维护 Zod 与 JSON Schema；不做未经验证的自动转换。
- 初期只支持一个真实 Tool Calling 协议，避免在尚无需求时复制适配器状态机。
- Agent 的中间文本也会流到 stdout；P4 事件系统会重新评估交互显示策略。

## 拒绝方案

- 让 `kfc ask` 自动进入 Agent：权限边界不可见。
- 在 Agent Loop 内拼 OpenAI delta：供应商状态污染 Core。
- 同时实现 Responses / Anthropic：扩大表面积而没有真实验收需求。
- 增加写入或 Shell：跳过 P3 最小权限边界。

## 重新评估条件

- Responses Tool Calling 有真实用户需求并具备独立验收样例。
- JSON Schema 与 Zod 声明重复导致真实维护错误。
- Agent 中间文本造成 CLI 交互混乱，需要以 P4 领域事件重做渲染。
- 只读工具需要统一超时、输出预算、持久化轨迹或细粒度授权。
