# ADR-0011：生产 Agent 使用可中断的无限步数模式

- 状态：Accepted
- 日期：2026-08-01
- 范围：Agent Core、CLI、Interactive TUI

## 背景

KFC 原先默认把 Agent Loop 限制为 8 步，并允许通过 `KFC_AGENT_MAX_STEPS` 调到 64。
这对教学测试有帮助，但会把长任务在尚未完成时硬切断，用户看到的是 `AGENT_MAX_STEPS_EXCEEDED`，
而不是模型或工具真正完成任务。对于编程 Agent，固定小预算不是可靠的完成条件。

## 决策

1. `AgentRunRequest.maxSteps` 支持 `number | "unlimited"`。
2. CLI 与 TUI 生产运行统一传入 `maxSteps: "unlimited"`，移除 `KFC_AGENT_MAX_STEPS` 用户配置入口。
3. 数值预算仍保留在 Core API 中，服务于确定性测试、嵌入式调用和显式需要预算的调用方；它不再是生产默认策略。
4. 无限模式的终止边界是：
   - 模型返回非 Tool Call 的最终响应；
   - Provider、上下文或工具执行失败；
   - 用户使用 Esc、Ctrl+C 或会话退出中断。
5. TUI 状态显示“Agent 步数限制：无”，而不是虚构一个默认轮数；错误提示不再要求用户设置 `KFC_AGENT_MAX_STEPS`。

## 不变量

- 无限模式不绕过现有 `AbortSignal`、权限确认、工具边界、Provider 错误和上下文限制。
- 取消仍然必须能终止当前 Provider 请求与 Shell 工具。
- 不允许用无限循环掩盖 Provider 永不结束、工具重复调用或上下文膨胀问题；这些问题应通过事件、错误和后续 P4 观测解决。
- 生产模式不提供一个让模型自行修改执行预算的配置路径。

## 代价与后续

- 如果模型或 Provider 本身陷入循环，系统不会用 8 步替用户做决定；用户需要中断，后续应增加重复调用检测、成本观测和继续/停止交互。
- 当前 Agent Loop 在显式数值预算超限时仍抛出错误；后续可以把部分消息状态暴露给“继续执行”机制。
- 需要在 P4/P5 增加 Token、耗时、上下文增长和重复 Tool Call 的实时观测。
