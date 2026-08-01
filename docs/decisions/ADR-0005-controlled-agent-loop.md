# ADR-0005：使用受控、协议无关的 Agent Loop

- **状态：** Accepted
- **决定日期：** 2026-08-01

## 背景

P1 的 `ModelProvider` 只表达单轮文本流。进入 P2 后，模型需要提出 Tool Call，程序执行受控动作并把 Tool Result 回灌下一轮。若 Agent Loop 直接消费 OpenAI argument delta、Responses output item 或供应商 finish 字段，协议变化会污染工具、权限和会话状态。

同时，循环若没有显式最大步骤，模型可以无限请求工具；若最后一步仍执行工具，其结果没有合法的下一轮模型调用可消费，动作会失去闭环意义。

## 决定

- 演进现有 `ModelProvider`，增加供应商无关的原子 `ModelToolCall`、tool result message、`tool-call` 事件和 finish reason。
- Agent Loop 只依赖 `ModelProvider` 与 `AgentToolExecutor`，不导入任何协议适配器。
- 每次模型调用获得独立消息数组快照，历史请求不得被后续追加修改。
- Tool Result 作为结构化 tool message 精确回灌下一次 ModelRequest。
- Tool Calls 按事件顺序串行执行；并行执行推迟到真实工具证明有需要时。
- `maxSteps` 计算模型调用次数。最后允许步骤仍请求工具时，不执行工具并抛结构化超限错误。
- Tool Call ID 在完整会话轨迹中唯一。
- 模型流错误、Agent 控制错误和 Tool Executor 错误保持不同归属。
- P2.1 只使用脚本化 Mock，不启用真实 Provider Tool Calling 或真实工具。

## 结果

收益：

- Agent 的循环、终止和回灌可在无网络、无文件权限条件下确定性重放。
- Core 不依赖供应商 Tool Calling 的分片方式。
- 最大步数和取消检查位于程序控制边界，而不是交给模型自律。
- 下一步 Tool Registry 可以专注工具发现、参数验证和失败结果，不必重新设计循环。

代价：

- ModelProvider 公共消息和事件联合类型扩大。
- 现有真实协议适配器仍是文本模式，尚不能与 Agent Loop 直接组合。
- 串行工具执行可能增加延迟，但当前换取了更清晰的顺序和取消语义。

## 拒绝方案

- 新建平行 AgentModel：重复消息、流、usage、取消和错误契约。
- Core 消费供应商 Tool Call delta：让协议状态扩散到 Agent。
- 无上限循环：把终止权交给不可靠的模型输出。
- 最后一步照常执行工具：产生无法回灌和验证的孤立动作。

## 重新评估条件

- 两个以上真实、无副作用工具证明并行执行有明显收益。
- OpenAI Chat Completions 或 Responses Tool Calling 接入时，原子 Tool Call 无法表达必要语义。
- Tool Result 需要结构化二进制、多模态或超出字符串安全序列化的内容。
- Agent 事件总线和会话持久化进入 P4，需要从返回轨迹演进为领域事件。
