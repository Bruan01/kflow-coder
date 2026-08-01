# P3 复盘：写操作、Shell 与最小权限

- 日期：2026-08-01
- 状态：完成 P3.1 最小闭环验收

## 已完成

- `apply_patch` 精确单次替换，`write_file` 禁止覆盖已有文件。
- `shell` 固定在工作区内执行，限制 cwd、超时、输出和环境变量，默认关闭。
- `/tool` 能力级开关与方向键逐次授权并存：`Yes`、`No`、`Tell me why?`。
- `git_diff` 只读检查文件级 Git 状态、增删摘要、未跟踪内容和会话起始基线。
- 工具结果携带工作区变化状态；交互失败时输出已完成工具、失败工具和恢复建议。
- 真实临时 Git 仓库完成读取、修改、Diff、测试闭环。

## 第一性结论

权限问题不是一个“是否允许 Shell”的布尔值。至少要区分：工具能力是否启用、当前具体调用是否授权、
工具执行后工作区是否改变、失败后能否证明恢复范围。`git_diff` 的作用不是替用户回滚，而是把工作区事实
重新暴露出来，避免模型或 UI 凭感觉宣布完成。

## 质量证据

- `pnpm build`：通过。
- `pnpm typecheck:tests`：通过。
- `pnpm exec eslint src tests`：通过。
- 相关 Vitest：通过；源码测试 54 个测试文件通过。
- `pnpm test`：代码测试通过，但 LR Machine 的本机 HTTP 测试在当前沙箱因 `listen EPERM 127.0.0.1` 失败，属于环境限制，不是源码断言失败。
- `pnpm exec prettier --check ...`：通过。
- `git diff --check`：通过。

## 未解决与后续

- 当前会话基线不跨进程持久化。
- Shell 仍只能报告 `unknown`，必须通过 `git_diff` 二次确认。
- 不自动回滚、不提交、不做分支/Worktree；这些能力留到核心闭环稳定后的后续阶段。
- 下一步进入 P4 前，优先观察真实用户使用中的 diff 可读性，而不是扩展 MCP、Subagents 或 Anthropic Messages Provider。
