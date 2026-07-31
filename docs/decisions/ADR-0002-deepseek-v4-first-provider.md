# ADR-0002：首个真实 Provider 使用 DeepSeek V4 Flash

- **状态：** Accepted
- **决定日期：** 2026-07-29
- **外部信息最后核验：** 2026-07-31

## 背景

KFC 在 P1 需要选择一个 OpenAI-compatible 服务验证单轮调用、流式事件、错误映射与后续 Tool Calling。首个目标既要支持主流兼容格式，也应暴露“兼容不等于完全相同”的真实边界。

## 决定

首个真实接入目标采用：

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-flash
```

API Key 继续只通过 `KFC_API_KEY` 环境变量提供。Provider 核心接口使用通用 OpenAI-compatible 请求与内部事件，不把 DeepSeek 模型名称、Thinking 字段或参数差异写死在 Core。

## 理由

- 当前官方服务提供 OpenAI-compatible Chat Completions 接口。
- 2026-07-31 官方更新确认 DeepSeek V4 Flash 正式版进入 public beta，`deepseek-v4-flash` 模型名和 Base URL 保持有效。
- V4 Flash 适合作为首个开发与回归目标；需要更强能力时可以切换 V4 Pro。
- DeepSeek 在角色、Token 参数、Thinking 和 Tool Calling 细节上存在供应商差异，能帮助我们识别 Provider 抽象真正应该统一的边界。

## 代价

- “OpenAI-compatible”不能被视为行为完全一致。
- P1 必须通过真实请求和录制 Fixture 验证流式事件与错误响应。
- 当前模型名称属于外部事实，升级或停用时需要重新核验，不能成为领域类型的一部分。

## 重新评估条件

- 官方停用或替换 `deepseek-v4-flash`。
- Tool Calling 或流式协议不能满足最小 Agent Loop。
- 服务稳定性、访问条件或成本不适合作为固定回归目标。
- 另一个兼容服务更能暴露我们当前需要学习的 Provider 边界。

## 参考来源

- DeepSeek 官方 Chat Completions 文档：`https://api-docs.deepseek.com/api/create-chat-completion`
- DeepSeek 官方模型与价格：`https://api-docs.deepseek.com/quick_start/pricing`
- DeepSeek 官方更新记录：`https://api-docs.deepseek.com/updates`
