# P2.1 Agent Loop 领域契约实施计划

- **设计：** `docs/specs/2026-08-01-p2-1-agent-loop-domain-contract-design.md`
- **目标：** 使用脚本化 Mock Provider 与假工具执行器证明受控 Tool Loop，不接真实协议和真实工具。
- **方法：** 每个领域行为先写失败测试，再实现最小代码。

## 1. Core 类型

修改 `src/provider/model-provider.ts` 及契约测试：

- 增加原子 `ModelToolCall`。
- 扩展 assistant/tool 消息。
- 增加 `tool-call` 流事件和 finish reason。
- 保持现有文本 Provider 与 Ask 测试可编译。

## 2. AgentError

新增 `src/agent/agent-error.ts` 及测试：

- `AGENT_INVALID_OPTIONS`
- `AGENT_MAX_STEPS_EXCEEDED`
- `AGENT_INVALID_TOOL_RESULT`
- agent category、退出码 1、非重试和安全展示。

## 3. 最小 Agent Loop

新增 `src/agent/run-agent.ts` 与纵向测试：

- 一步文本完成。
- Tool Call → Fake Executor → tool message → 第二步完成。
- 返回完整不可变消息轨迹和模型步骤数。

## 4. 状态机反例

逐项增加测试与最小实现：

- 多工具串行与结果顺序。
- 跨步骤重复 Tool Call ID。
- finish/tool-call 不一致和非法生命周期。
- 非法 maxSteps。
- 最后一步请求工具时不执行工具。
- Tool Result ID 不匹配。
- 请求前、模型期间和多工具之间取消。
- 执行器错误保持身份。

## 5. 验收

更新 Provider/Error 文档、TODO 和学习日志，随后运行：

```sh
pnpm build
pnpm typecheck:tests
pnpm lint
pnpm format:check
pnpm test
pnpm learning:snapshot -- "P2.1 Agent Loop domain contract"
```
