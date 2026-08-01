# ADR-0009：在交互 TUI 中对高风险工具实施逐次授权

- **状态：** Accepted
- **决定日期：** 2026-08-01

## 背景

Tool Registry 已经用 `read`、`edit`、`execute` capability 区分观察、修改和执行能力，且 Edit/Shell 默认关闭。但用户通过 `/tool` 启用高风险工具后，旧 Agent Loop 会在模型提出 Tool Call 后直接执行，启用开关只能表达“本轮允许这类能力”，不能表达“我同意这一次具体操作”。

## 决定

- `AgentRunDependencies` 增加可选异步 `authorizeToolCall` 边界。
- 授权回调返回 `true` 才进入 `toolExecutor.execute()`；返回 `false` 生成 `TOOL_CALL_DENIED`，返回 `"explain"` 生成 `TOOL_CALL_EXPLANATION_REQUESTED`，两者都不执行工具而继续 Agent Loop。
- TUI 对 capability 为 `edit` 或 `execute` 的每个 Tool Call 显示安全目标摘要和方向键确认菜单（`Yes`、`No`、`Tell me why?`）；读工具自动通过。
- ↑/↓ 选择 `Yes`、`No` 或 `Tell me why?`，Enter 确认；Esc/Ctrl+C 等价于 `No`，不遗留 Promise；退出时同时取消活动请求并恢复终端。
- 非交互调用方未提供授权回调时保持现有兼容行为；高风险工具仍由 Registry 的默认关闭状态保护。

## 结果

收益：

- 模型提出动作、程序授权动作、工具执行动作形成明确的三段边界。
- 拒绝不会让 Agent Loop 崩溃，模型可以基于结构化失败调整回答。
- TUI 时间线能区分等待确认、已执行和已拒绝。

代价：

- 高风险工具会增加一次用户交互，无法在无人值守 TTY 中静默运行。
- 当前授权事件仍通过回调传递，完整审计轨迹要等 P4 领域事件和持久化再统一。
- Shell 当前仍是工作区 cwd、超时和输出上限约束，不等同于 OS 级沙箱。

## 重新评估条件

- 需要批量批准、目录级 allowlist、会话级批准或自动化策略时，评估独立 Permission Policy，而不是继续扩展 TUI 回调。
- P4 事件总线落地后，将授权请求、决定和执行结果迁移为统一领域事件。
