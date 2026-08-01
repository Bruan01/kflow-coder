# EXP-004：真实 `kfc agent` Chat Completions Tool Calling 验收

- **日期：** 2026-08-01
- **目标：** 证明显式 Agent CLI 能经由已配置的 OpenAI-compatible Chat Completions Provider 请求只读工作区工具、回灌结果并给出最终总结。
- **协议：** `openai-chat-completions`

## 前置门禁

```text
pnpm build
pnpm typecheck:tests
pnpm lint
pnpm format:check
pnpm test
```

结果：构建、类型检查、Lint、格式检查通过；Vitest 为 41 个测试文件、222 个测试通过。

## 真实调用

执行：

```text
pnpm kfc agent "查看当前工作目录下的有哪些主要文件和目录，并用中文简要总结项目用途。请使用可用工具获取事实，不要猜测。"
```

观察：

- 首次调用与独立 `kfc ask` 健康对照都遇到临时 Provider 服务不可用；重试后最小 Ask 成功，确认不是 Tool Calling 请求特有失败。
- 重试 Agent 后退出码为 `0`，完成摘要，stderr 为 `agent steps=4 finish=stop`。
- 最终回答列出了工作区的主要目录与项目用途，表明模型请求工具、程序在只读边界执行、结果回灌以及最终模型 turn 均已成立。
- 未输出 API Key、原始 Provider 错误 body、绝对工作区路径或 Shell 命令。

## 结论

真实链路为：CLI `agent` → 配置/协议门禁 → P2.3 只读工具与 Registry → Chat Completions tools/流式 Tool Call 组装 → P2.1 Agent Loop 回灌 → 最终 stdout。该实验只接受 Chat Completions Tool Calling；Responses 与 Anthropic 不在本次结论范围内。
