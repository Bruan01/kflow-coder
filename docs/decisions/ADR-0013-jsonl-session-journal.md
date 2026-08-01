# ADR-0013：使用权限受限的 JSONL 会话日志支持崩溃诊断

- 状态：Accepted
- 日期：2026-08-01
- 范围：Interactive TUI、Session Store、Config Path

## 背景

取消固定步数后，长任务可能持续更久；Provider 中断、终端关闭或进程崩溃时，内存中的消息轨迹会随进程消失。
如果没有持久化事实，用户无法区分“最后一轮已经完成”与“工具执行到一半”。自动回滚也不安全，因为工作区可能包含用户原有修改。

## 决策

1. 每个交互会话在配置目录旁的 `sessions/` 下创建独立 JSONL 文件，文件权限为 `0600`，目录权限为 `0700`。
2. 记录 `session.started`、`turn.started`、`tool.call`、`tool.result`、`turn.completed`、`turn.failed`、`session.cleared` 和 `session.ended` 事件。
3. `turn.completed` 保存完整的 provider-neutral `ModelMessage[]`、终止原因、usage 和运行指标，作为后续恢复上下文的最小事实源。
4. 读取时逐行校验；非法 JSON 或不符合事件 schema 的记录被跳过，并返回行号和原因，不让整个诊断过程崩溃。
5. 当前只做日志与诊断，不自动恢复、重放工具或回滚工作区。恢复动作必须由用户审查后明确触发。

## 不变量

- 会话日志不包含 API Key、Authorization 或配置凭证。
- 工具输入和结果属于本地会话事实，落盘前不进入公共 stdout；日志文件只对当前用户可读。
- 追加顺序由 Session Store 串行化，退出前等待队列 flush，避免 `session.ended` 早于前一轮完成事件写入。
- 损坏记录不会覆盖或修复原始文件；诊断只报告问题位置。

## 代价与后续

- 日志可能包含用户提示、文件内容和工具结果，需要提供清理/保留策略；当前没有自动归档或删除命令。
- 事件还没有被 Agent Core 的所有内部状态统一消费，P4 仍需把 Provider、工具授权和完成状态接成领域事件。
- 下一步可以增加只读的会话列表/诊断命令，以及用户确认后的 resume，而不是隐式重放。
