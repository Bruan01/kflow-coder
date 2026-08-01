# P2.1 Agent Loop 领域契约设计

- **状态：** 已实现并验证
- **日期：** 2026-08-01
- **阶段：** P2.1 Agent Loop 领域契约

## 1. 第一性问题

P1 已证明 KFC 能可靠完成一次模型调用，但编程 Agent 的核心不是“调用更强的模型”，而是一个受控循环：模型提出动作，程序决定是否执行，把结构化结果回灌，再由模型决定下一步。

P2.1 只建立这个循环的领域语言和终止规则。若此时直接接文件、Shell、OpenAI argument delta 或权限 UI，状态机、协议、工具安全和进程权限会同时耦合，失败后无法判断是哪一层的问题。

## 2. 已确认方向

- 扩展现有 `ModelProvider` 契约，不创建平行 `AgentModel`。
- Core 只接收完整、原子的 Tool Call，不暴露供应商流式参数片段。
- Agent Loop 是协议无关的纯应用状态机。
- P2.1 只使用脚本化 Mock Provider 和假工具执行器。
- 不接 `kfc ask`，不调用真实 Provider，不访问文件或 Shell。
- `anthropic-messages` 继续延期。

## 3. 方案比较

### 方案 A：演进现有 ModelProvider（采用）

在内部消息和流事件中加入最小 Tool Call/Tool Result 语义，Agent Loop 继续消费同一个 Provider。

优点：消息、取消、usage、错误和流式边界不重复；未来协议适配器只负责把线协议映射为同一原子事件。代价是 P1 文本契约会发生一次受真实 Agent 需求推动的受控扩张。

### 方案 B：新建 AgentModel 接口（拒绝）

短期不影响 P1 类型，但会复制 ModelRequest、流式文本、取消、usage 和错误；两个模型接口最终仍需合并。

### 方案 C：Core 直接消费供应商 Tool Calling（拒绝）

把 OpenAI `tool_calls[].function.arguments` delta 或 Responses output item 放入 Core。这样状态机必须理解供应商 chunk 顺序，未来协议会把分支扩散到 Agent 层。

## 4. Model Tool Call

新增供应商无关类型：

```ts
interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}
```

约束：

- `id` 是一次 Agent Run 内唯一的调用标识。
- `name` 是工具注册名，但 P2.1 不验证工具是否存在。
- `input` 已是完整 JSON 值；参数字符串拼接和 JSON 解析属于未来协议适配任务。
- Core 不保存 Provider item ID、content index、argument delta 或供应商品牌字段。

## 5. Model Message 演进

消息联合类型扩展为：

```ts
type ModelMessage =
  | {
      readonly role: "system" | "user";
      readonly content: string;
    }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls?: readonly ModelToolCall[];
    }
  | {
      readonly role: "tool";
      readonly toolCallId: string;
      readonly content: string;
      readonly isError: boolean;
    };
```

Agent Loop 在模型请求工具后追加一条 assistant message，其中保存该轮文本和 Tool Calls；每个执行结果再追加一条对应的 tool message。Tool Result 使用字符串 content，复杂对象由未来 Tool Registry 负责安全序列化。

P2.1 不让现有 Chat Completions/Responses 适配器发送这些扩展消息。真实 Provider Tool Calling 编码、tools 参数和 delta 组装属于后续独立任务；本阶段 Agent Loop 只能与 Mock Provider 组合。现有 `kfc ask` 仍只发送单条 user message。

## 6. Model Stream 演进

新增原子事件：

```ts
{ readonly type: "tool-call"; readonly toolCall: ModelToolCall }
```

`ModelFinishReason` 新增：

```ts
"tool-call";
```

一轮有效模型流满足：

- 恰好一个 start，且必须是首个事件。
- text-delta 可出现零到多次。
- tool-call 可出现零到多次，每个事件包含完整调用。
- usage 最多一次。
- finish 恰好一次且为最后事件。
- 有 Tool Call 时 finish reason 必须是 `tool-call`。
- finish reason 为 `tool-call` 时至少有一个 Tool Call。
- 没有 Tool Call 时，`stop`、`length`、`content-filter` 或 `unknown` 都是终止结果。

未知事件、重复 lifecycle、非法 usage、finish 后内容和 finish/tool-call 不一致继续归一化为 `PROVIDER_INVALID_RESPONSE`，因为失败源是模型流契约，而不是工具执行。

`runAsk` 不支持 Tool Calling；若观察到 `tool-call`，继续安全拒绝为 `PROVIDER_INVALID_RESPONSE`，不进入 Agent Loop。

## 7. Tool Result 与执行器

P2.1 使用最小注入接口：

```ts
interface AgentToolResult {
  readonly toolCallId: string;
  readonly content: string;
  readonly isError: boolean;
}

interface AgentToolExecutor {
  execute(
    toolCall: ModelToolCall,
    options?: { readonly signal?: AbortSignal },
  ): Promise<AgentToolResult>;
}
```

执行器必须返回与输入 Tool Call 相同的 `toolCallId`；不匹配视为 Agent 内部契约错误。P2.1 的 Fake Executor 直接返回脚本化结果，不查 Registry、不做参数 Schema 校验。

执行器抛错转为 Tool Result、工具不存在、超时和输出截断属于 P2.2 Tool Registry/执行边界。本任务只保证 Agent Loop 不吞掉执行器错误，也不会继续产生伪造结果。

## 8. Agent Run API

计划新增：

```ts
interface AgentRunRequest {
  readonly messages: readonly ModelMessage[];
  readonly maxSteps: number;
}

interface AgentRunResult {
  readonly messages: readonly ModelMessage[];
  readonly steps: number;
  readonly finalText: string;
  readonly finishReason: Exclude<ModelFinishReason, "tool-call">;
}
```

`runAgent(request, dependencies, options)` 依赖 `ModelProvider` 与 `AgentToolExecutor`。返回 messages 是包含初始消息、assistant turn、Tool Results 和最终 assistant message 的完整不可变轨迹。

P2.1 不累计跨步骤 usage，不输出 Agent 事件，也不持久化轨迹；这些需求分别属于观测和 P4 事件/会话任务。

## 9. 循环状态机

对 `step = 1..maxSteps`：

1. 检查 AbortSignal。
2. 使用当前消息调用 ModelProvider。
3. 收集该轮文本、Tool Calls、usage 和 finish。
4. 若没有 Tool Call：追加 assistant message并返回完成结果。
5. 若存在 Tool Call：追加带 toolCalls 的 assistant message。
6. 若当前已是最后允许步骤，抛最大步数错误，不执行任何 Tool。
7. 按事件出现顺序串行执行 Tool Calls。
8. 每次执行前再次检查取消，并追加对应 tool message。
9. 进入下一模型步骤。

多个 Tool Calls 暂不并行。串行顺序更容易验证取消、结果回灌和副作用边界；并行策略必须等真实工具出现后重新设计。

## 10. 最大步数与 AgentError

新增 `AgentError`，类别为 `agent`，退出码为 1，非重试：

- `AGENT_INVALID_OPTIONS`：`maxSteps` 不是正整数。
- `AGENT_MAX_STEPS_EXCEEDED`：最后允许的模型步骤仍请求 Tool。
- `AGENT_INVALID_TOOL_RESULT`：执行器返回不匹配的 Tool Call ID。

最大步数计算模型调用次数，不计算单个工具数量。最后一步请求工具时不执行工具，因为其结果已经没有合法的下一模型步骤可以消费。

模型流语义错误继续使用 `ProviderError(PROVIDER_INVALID_RESPONSE)`；执行器原始错误保持身份传播。这样错误归属仍可判断是模型、Agent 控制还是工具实现。

## 11. 取消语义

- 请求前已取消时，不调用 Provider 或 Tool Executor。
- Signal 原样传给每次 Provider 调用和 Tool 执行。
- 模型消费期间取消时，不执行后续 Tool。
- 多工具之间取消时，不执行剩余 Tool，也不进行下一模型步骤。
- 取消保持 `USER_INTERRUPTED`，不伪造 finish 或 Tool Result。

## 12. 模块边界

计划新增：

- `src/agent/agent-error.ts`
- `src/agent/run-agent.ts`
- `src/agent/index.ts`
- `tests/agent/agent-error.test.ts`
- `tests/agent/run-agent.test.ts`

修改：

- `src/provider/model-provider.ts`：扩展消息、Tool Call、事件和 finish reason。
- `src/errors/kfc-error.ts`：增加 agent category/code。
- 公共导出、Provider/错误文档、TODO 和学习日志。

现有协议适配器不增加 tools 请求字段，不解析 Tool Calling；现有测试必须全量回归。

## 13. 测试证据

至少覆盖：

1. 模型直接文本完成时只调用一次 Provider，不执行 Tool。
2. 首轮请求 Tool，Fake Executor 返回结果，第二次 ModelRequest 精确包含 assistant toolCalls 与 tool message。
3. 第二轮读取 Tool Result 后完成最终回答和完整消息轨迹。
4. 多个 Tool Calls 按事件顺序串行执行并按相同顺序回灌。
5. Tool Call ID 在跨步骤重复时被拒绝。
6. finish/tool-call 不一致、重复 lifecycle、未知事件和缺失 finish 被拒绝。
7. 非正整数 maxSteps 返回 `AGENT_INVALID_OPTIONS`。
8. 最后一步仍请求 Tool 时返回 `AGENT_MAX_STEPS_EXCEEDED`，且不执行 Tool。
9. Tool Result ID 不匹配时返回 `AGENT_INVALID_TOOL_RESULT`。
10. 请求前、模型期间和多工具之间取消时停止后续工作。
11. 执行器抛错保持原错误身份，不追加伪造 Tool Result。
12. `runAsk` 与两个 P1 Provider 的全部文本行为保持通过。

## 14. 验收条件

1. Core 中不存在 OpenAI/Responses/Anthropic Tool Calling 字段。
2. Agent Loop 只依赖 `ModelProvider` 和 `AgentToolExecutor`。
3. 工具结果精确进入下一次 ModelRequest，完整轨迹可由测试审查。
4. 最大步数、取消和错误归属均有确定性反例。
5. 不读取文件、不执行 Shell、不调用真实 Provider。
6. build、测试类型检查、lint、格式检查和全量测试通过。
7. 设计、学习日志、TODO 和 LR Machine Snapshot 同步。
