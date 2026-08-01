# ADR-0006：在 Tool Registry 边界统一 Zod 校验与安全结果

- **状态：** Accepted
- **决定日期：** 2026-08-01

## 背景

Agent Loop 接收的 Tool Call input 是运行时 unknown。若每个工具自行解析参数、查找名称和处理异常，校验规则、错误格式、取消和秘密泄漏策略会在工具之间漂移。若由 Agent Loop 负责这些细节，循环状态机又会耦合 Zod issue、工具表和执行异常。

## 决定

- 使用纯内存 `ToolRegistry` 作为 `AgentToolExecutor`。
- 工具通过 `defineTool()` 定义，execute input 由 Zod output 静态推导。
- Registry 使用 `safeParseAsync`，只有解析后的 output 才能进入工具实现。
- 工具不存在、参数错误和普通执行异常成为稳定 JSON Tool Result，不抛出到 Agent Loop。
- 错误结果不包含原始 input、Zod message、异常 message、cause 或 stack。
- 工具主动返回的 `{ content, isError }` 保持原样。
- AbortSignal 和 `UserInterruptedError` 始终保持控制流异常，不转换为 Tool Result。
- Registry list 只暴露名称与说明，不提前生成供应商 tools JSON Schema。
- P2.2 只使用内存假工具，不获取文件、Shell 或网络权限。

## 结果

收益：

- Agent Loop 无需修改即可获得参数校验和安全失败回灌。
- 工具作者获得 typed input，不重复处理 unknown。
- 普通失败成为模型可读取的 Tool Result，单个工具异常不会摧毁循环。
- 取消与业务失败保持不同语义。

代价：

- 工具实现必须使用 Zod，并以字符串 content 作为当前输出边界。
- Registry 暂不提供 JSON Schema、权限、timeout、输出截断或并行调度。
- 工具主动错误 content 由工具作者负责安全性，Registry 只隔离 thrown error。

## 拒绝方案

- Agent Loop 内校验：污染循环状态机。
- 工具自行 safeParse：错误和取消策略重复。
- 工具异常全部抛出：一个可恢复工具失败会终止 Agent。
- 直接序列化异常或原始 input：可能泄漏凭证、路径和内部实现。

## 重新评估条件

- 接入 OpenAI/Responses Tool Calling，需要把 Zod 转换为供应商 JSON Schema。
- 真实只读工具需要统一 timeout、输出大小和路径权限。
- 工具输出需要二进制、多模态或结构化对象而非字符串。
- 权限确认进入 P3，需要 Registry 在执行前调用授权策略。
