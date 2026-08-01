# P2.4 Chat Completions Agent 接通计划

- **设计：** `docs/specs/2026-08-01-p2-4-chat-completions-agent-integration-design.md`
- **目标：** 将 P2.1 Agent Loop、P2.2 Registry 与 P2.3 只读工作区工具接入真实 OpenAI-compatible Chat Completions Tool Calling。

## 实施

1. 在协议无关的 ModelRequest 中加入模型安全工具定义；Tool Registry 暴露安全定义，执行继续由 Zod 校验。
2. 编码 Chat Completions messages、`tools`、assistant `tool_calls` 和 tool result。
3. 解析并按 index 组装流式 `delta.tool_calls`；只对完整 JSON object 产生内部 Tool Call。
4. Agent Loop 在每个模型 step 传递定义并回调文本；CLI 新增显式 `agent`，使用当前目录创建 P2.3 只读工具。
5. 对非 Chat Completions 配置保持明确拒绝，不做静默降级。

## 验收

- 单元/集成测试覆盖请求编码、参数分片、非法调用、每 step 传递 tools、CLI 输出和错误。
- 全量 `pnpm build`、`pnpm typecheck:tests`、`pnpm lint`、`pnpm format:check`、`pnpm test` 通过。
- 真实 `kfc agent` 在当前工作区完成只读目录/文件获取与项目总结。
