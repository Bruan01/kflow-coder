# ADR-0003：统一错误契约

- **状态：** Accepted
- **日期：** 2026-07-29

## 背景

配置、Provider、用户中断和未知异常需要由 CLI 以稳定方式展示并映射为退出码。直接打印原始 Error、Stack 或 Provider 响应会让调用方无法可靠判断状态，也可能泄露密钥和授权信息。

## 决定

使用 `KfcError` 作为领域错误基类，保存 category、code、safe message、exitCode、retryable、public details 和显式 debugDetails。ConfigError、ProviderError 与 UserInterruptedError 继承该基类。

标准展示器遵循：

- 默认只输出安全消息与公开 details。
- Debug 模式只输出结构化 debugDetails，并按敏感键递归脱敏。
- cause、原始未知错误 message 和 stack 不进入标准输出。
- 未知异常归一化为 `INTERNAL_ERROR`，退出码 1。

## 代价

- 调用方必须主动构造安全消息，不能直接透传第三方错误。
- Debug 信息少于完整 Stack，需要未来通过受控日志补充诊断能力。
- Provider 错误映射必须维护明确的错误码和 retryable 规则。

## 重新评估条件

- P1 真实 Provider 错误包含现有模型无法表达的重要状态。
- 调试困难证明仅有结构化 debugDetails 不足。
- CLI、API 服务和 IDE 集成需要不同但可复用的错误呈现策略。
