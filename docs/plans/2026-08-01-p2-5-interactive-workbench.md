# P2.5 KFLOW 交互工作台实施计划

- **设计：** `docs/specs/2026-08-01-p2-5-interactive-terminal-design.md`
- **目标：** 让 TTY 中直接运行 `kfc` 进入可视、连续、只读的 Agent 工作台。

## 实施

1. 进入备用屏幕并播放短 KFLOW 文本动画；非 TTY 保持 help。
2. 建立纯状态 Workbench：时间线、固定状态栏、编辑器、滚动偏移、命令菜单与确认框。
3. raw-mode 输入支持文本、光标、删除、多行、`↑`/`↓`/PageUp/PageDown、Ctrl+J、Esc/Ctrl+C，并保留终端原生选区复制。
4. `/help`、`/status`、`/clear`、`/exit` 使用中文；clear 需要 `y` 确认并重置当前消息上下文。
5. Agent 回调写入用户、工具和 assistant 时间线；usage 跨 Model step 和成功 session turn 累计。
6. 关闭流程停止监听和 stdin 流，恢复 raw mode、光标和原 terminal screen。

## 验收

- 自动化覆盖 ANSI 文本净化、编辑、菜单、滚动、异常鼠标序列防护、状态累计、clear 上下文重置、退出清理和 Agent usage 聚合。
- 真实 TTY 验证 `/status`、菜单选择和 `/exit` 的正常进程退出。
