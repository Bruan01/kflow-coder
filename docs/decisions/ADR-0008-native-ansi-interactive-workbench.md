# ADR-0008：使用原生 ANSI 状态工作台承载交互会话

- **状态：** Accepted
- **决定日期：** 2026-08-01

## 背景

显式 `kfc agent` 已能完成一轮真实 Tool Calling，但一次进程只能发送一个 prompt。早期交互原型使用 `readline.question()`；它可以连续提问，却无法固定输入栏、显示事件时间线、实现命令选择器或可靠地承载滚动历史。用户需要类似现代 coding-agent CLI 的终端工作台，而不是普通 REPL。

原型还暴露两类真实终端边界：鼠标滚轮可能产生 `value === undefined` 的 keypress，且 `emitKeypressEvents()` 会启动 stdin 流；只恢复备用屏幕而不暂停输入流可能导致父进程退出等待。

## 决定

- `kfc` 仅在 stdin/stdout 都是 TTY 时进入备用屏幕 ANSI workbench；非 TTY 继续输出帮助。
- 使用纯 TypeScript WorkbenchState 保存时间线、滚动偏移、固定 editor、命令菜单和 clear confirmation；渲染器从状态生成全屏文本。
- 使用 Node raw-mode 和 keypress events 实现编辑；`↑`/`↓`、PageUp/PageDown 与 SGR 鼠标滚轮用于时间线滚动，`Ctrl+J` 换行，Esc/Ctrl+C 取消当前请求。
- `/` 打开中文命令菜单，使用上下方向键选择；`/clear` 清除内存上下文和可见时间线前必须输入 `y`。
- 终端内容通过统一控制序列净化；模型、用户和工具文字永不生成 UI ANSI 控制。
- 生命周期在 finally 中关闭 mouse tracking、移除监听、暂停 stdin、恢复 raw mode、显示光标并离开备用屏幕。
- `/status` 显示安全配置与真实 usage；不存在的 Provider 上下文窗口显示未知。

## 结果

收益：

- UI 是 Agent 事件的可视化状态，而不是 stdout 的不可控拼接。
- 交互、滚动、上下文重置和终端恢复均有无网络自动化测试。
- 不引入 React/Ink，保留 Node 22 单二进制终端依赖边界。

代价：

- 需要维护 ANSI 宽度、raw-mode 和不同终端 mouse 行为；首版只保证基础 ASCII 布局与安全降级。
- 会话仍没有 Token 压缩或持久化，超长历史是 P5 问题。

## 重新评估条件

- Unicode 宽度、复制粘贴或复杂编辑需求使手写 editor 失去可靠性。
- 需要 Windows/终端模拟器兼容矩阵或富组件时，评估 Ink/TUI 框架。
- P4 事件总线进入 Core 后，UI 从当前 callbacks 演进为领域事件消费者。
