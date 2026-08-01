# EXP-005：KFLOW 交互工作台终端验收

- **日期：** 2026-08-01
- **目标：** 证明无参数 `kfc` 在 TTY 中能进入并退出原生 ANSI 工作台，且状态、菜单和终端恢复不依赖真实网络调用。

## 执行

```text
pnpm build
pnpm kfc
```

在备用屏幕中执行：

1. 输入 `/`，以方向键选择 `/status`，Enter 填充，再 Enter 执行；
2. 观察配置文件（home 相对路径）、协议、Base URL、模型、超时、凭证隐藏状态、未知上下文窗口、会话消息和 Token 信息；
3. 输入 `/exit`。

## 观察

- KFLOW 启动后显示固定时间线、状态栏和 editor；`/` 出现中文候选菜单。
- `/status` 显示实际已解析的 Chat Completions 配置；尚未调用模型时累计 usage 为 `n/a`，没有伪造上下文窗口。
- `/exit` 后进程退出码为 `0`，无需额外 Ctrl+C；mouse tracking、cursor 和备用屏幕恢复序列均执行。
- 鼠标/未知 keypress、SGR mouse scroll、滚动偏移、确认式 clear、usage 累加与 raw-mode cleanup 由确定性测试覆盖。

## 结论

KFLOW 已从一次性 `kfc agent` 进程演进为只读的进程内交互会话。该实验不验证真实模型质量；真实 Provider Tool Calling 继续由 EXP-004 验收。
