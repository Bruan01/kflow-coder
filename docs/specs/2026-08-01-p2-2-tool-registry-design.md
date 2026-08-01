# P2.2 Tool Registry 与参数验证设计

- **状态：** 已实现并验证
- **日期：** 2026-08-01
- **阶段：** P2.2 Tool Registry 与参数验证

## 1. 第一性问题

P2.1 已能执行模型提出的原子 Tool Call，但 Agent Loop 目前依赖一个无规则的 `AgentToolExecutor`。它不知道工具是否存在、参数是否合法、工具异常能否安全回灌，也无法向未来模型请求提供稳定工具元数据。

P2.2 只解决工具发现、完整参数校验和安全执行结果。若现在接入文件系统、Shell、权限 UI、供应商 JSON Schema 或并行调度，参数错误、权限错误和执行错误会同时出现，无法证明 Registry 本身可靠。

## 2. 已确认方向

- 实现纯内存 `ToolRegistry`，直接满足现有 `AgentToolExecutor`。
- 使用 Zod 校验完整 `ModelToolCall.input`，不处理供应商 argument delta。
- 使用 `defineTool()` 保留工具实现的静态输入类型，Registry 内部存储擦除后的统一定义。
- 工具不存在、参数错误和普通执行异常返回结构化错误 Tool Result，不使 Agent 进程崩溃。
- 取消仍是控制流错误，必须抛出 `UserInterruptedError`，不能转成 Tool Result。
- P2.2 只使用内存假工具，不读取工作区、不执行 Shell。

## 3. 方案比较

### 方案 A：ToolRegistry 实现 AgentToolExecutor（采用）

Registry 同时负责注册、查找、Zod 校验和结果归一化，Agent Loop 无需知道工具表或 Schema。

优点：P2.1 循环无需修改，工具边界可独立测试；未来真实工具只需提供定义。代价是 Registry 必须谨慎隔离泛型类型与运行时 unknown。

### 方案 B：Agent Loop 内部验证参数（拒绝）

会让循环同时负责步骤控制、工具发现、Zod issue 和异常格式，后续每种权限策略都继续侵入状态机。

### 方案 C：每个工具自行解析 unknown（拒绝）

工具实现重复 safeParse、错误格式与取消检查，无法保证未知工具和异常泄漏使用同一策略。

## 4. Tool 定义

公共帮助函数：

```ts
const searchTool = defineTool({
  name: "search",
  description: "Search an in-memory fixture",
  inputSchema: z.object({
    query: z.string().trim().min(1),
    limit: z.number().int().positive().default(5),
  }),
  async execute(input, options) {
    // input 自动推导为 { query: string; limit: number }
    return {
      content: `query=${input.query};limit=${input.limit}`,
      isError: false,
    };
  },
});
```

类型：

```ts
interface ToolExecutionOutput {
  readonly content: string;
  readonly isError: boolean;
}

interface ToolExecutionOptions {
  readonly signal?: AbortSignal;
}
```

`defineTool<TSchema extends z.ZodType>()` 在定义位置使用 `z.output<TSchema>` 推导 execute input。它返回统一的已注册定义，内部只在 Zod 成功后把解析结果交给 typed execute；Registry 不会把原始 unknown 直接断言成工具输入。

## 5. 定义约束

注册时要求：

- name 是非空、已 trim 的字符串。
- description 是非空、已 trim 的字符串。
- inputSchema 提供 Zod `safeParseAsync` 能力。
- execute 是函数。
- 名称按精确字符串区分，重复名称拒绝。

P2.2 不强制供应商函数名正则或长度，因为这些属于线协议编码边界。Registry 保持 Core 命名中立。

新增 `ToolRegistryError`，类别为 `agent`、退出码 1、非重试：

- `TOOL_DEFINITION_INVALID`
- `TOOL_NAME_DUPLICATE`

Registry 可以通过构造器接收初始工具，也可以调用 `register()` 追加；不支持覆盖、注销或静默替换。

## 6. Registry API

```ts
interface ToolMetadata {
  readonly name: string;
  readonly description: string;
}

class ToolRegistry implements AgentToolExecutor {
  constructor(tools?: readonly RegisteredTool[]);
  register(tool: RegisteredTool): void;
  list(): readonly ToolMetadata[];
  execute(
    toolCall: ModelToolCall,
    options?: ToolExecutionOptions,
  ): Promise<AgentToolResult>;
}
```

`list()` 保持注册顺序并返回新数组快照，不暴露可变 Map、Zod 实例或执行函数。P2.2 不生成 OpenAI/Responses tools JSON；协议 Schema 转换等真实 Tool Calling 接入时再设计。

## 7. 执行状态机

`execute(toolCall, options)`：

1. 请求前检查 AbortSignal。
2. 按精确 name 查找工具。
3. 未找到时返回 `TOOL_NOT_FOUND` 错误结果。
4. 使用 `safeParseAsync(toolCall.input)`。
5. 校验失败时返回 `TOOL_INPUT_INVALID`，不调用工具。
6. 将 Zod 输出传给工具；默认值、transform 和 object 字段剔除均已生效。
7. await 工具执行。
8. await 后再次检查取消。
9. 校验工具输出 content/isError 的运行时类型。
10. 返回带原 Tool Call ID 的 `AgentToolResult`。

Tool 实现不负责填写 toolCallId，避免伪造或错配；Registry 始终使用请求 ID。

## 8. 安全错误 Tool Result

错误结果 `isError: true`，content 使用稳定 JSON 字符串：

```json
{
  "error": {
    "code": "TOOL_INPUT_INVALID",
    "tool": "search",
    "paths": ["query"]
  }
}
```

错误码：

- `TOOL_NOT_FOUND`
- `TOOL_INPUT_INVALID`
- `TOOL_EXECUTION_FAILED`

规则：

- tool 名称最多回显前 128 个 Unicode code units，并由 JSON.stringify 转义。
- Zod issue 只保留去重后的字段路径；根路径表示为 `$`。
- 不包含原始 input、Zod 原始 message、异常 message、cause、stack、凭证或任意对象序列化。
- 未知工具不创建假的字段路径。
- 工具返回 `{ isError: true }` 属于主动、已结构化结果，content 原样保留。
- 工具返回非法 output 形状视为 `TOOL_EXECUTION_FAILED`。

## 9. 异常与取消

- 请求前已取消：不查找、不校验、不执行，抛 `UserInterruptedError`。
- Zod 异步校验期间取消：校验结束后检查并抛中断，不执行工具。
- 工具执行期间取消：Signal 传给工具；工具 resolve/reject 后再次检查，统一抛中断。
- 工具直接抛 `UserInterruptedError`：保持原身份。
- Signal 已 aborted 时，任何其他异常也优先归一化为 `UserInterruptedError`。
- 其他 KfcError、Error、字符串或未知 throw 全部转成 `TOOL_EXECUTION_FAILED`，不泄漏内容。

P2.2 不实现内部 timeout。真实工具阶段会在 Tool Registry 外或 Tool Definition 包装层统一加入超时策略。

## 10. Agent Loop 集成

`ToolRegistry` 可直接作为：

```ts
runAgent(request, {
  provider: scriptedProvider,
  toolExecutor: registry,
});
```

集成测试证明：

- 合法 input 的结果进入下一次 ModelRequest。
- 参数错误和未知工具同样作为 `role: "tool"`、`isError: true` 回灌，Agent Loop 不崩溃。
- 模型可以读取错误 Tool Result 并在下一步正常结束。

P2.2 不修改 `runAgent` 的状态机、最大步数或错误归属。

## 11. 模块边界

计划新增：

- `src/tool/define-tool.ts`
- `src/tool/tool-registry.ts`
- `src/tool/tool-registry-error.ts`
- `src/tool/index.ts`
- `tests/tool/define-tool.test.ts`
- `tests/tool/tool-registry.test.ts`
- `tests/tool/tool-registry-agent-integration.test.ts`

修改：

- `src/errors/kfc-error.ts`：增加 Registry 错误码。
- 公共导出、README、Error/Agent 文档、TODO 和学习日志。

不修改 Provider 协议适配器，不新增文件系统或进程权限。

## 12. 测试证据

至少覆盖：

1. defineTool 在 TypeScript 中推导 Zod output。
2. 注册、list 顺序和 list 快照隔离。
3. 非法定义和重复名称返回稳定 ToolRegistryError。
4. 合法 input 执行成功。
5. Zod default、transform 和未知字段剔除后的值进入工具。
6. 未知工具返回 `TOOL_NOT_FOUND`。
7. 非法 input 返回去重路径，不调用 execute，不回显原值或 Zod message。
8. 工具主动错误结果原样保留。
9. 工具抛 Error、KfcError、字符串和非法 output 均安全转换，不泄漏。
10. 请求前、异步校验后和工具 await 后取消。
11. Registry 与脚本化 Agent Loop 完成成功结果回灌。
12. Registry 与 Agent Loop 完成未知工具/参数错误回灌后正常终止。
13. 所有 P1/P2.1 测试回归。

## 13. 验收条件

1. Tool Registry 只依赖 Zod、Agent Tool 契约和结构化错误。
2. 工具实现只接收 Zod 解析后的 typed input。
3. 所有普通失败都成为安全 Tool Result，取消保持控制流错误。
4. Registry 可直接注入 `runAgent`，不修改循环。
5. 不读取文件、不执行 Shell、不调用真实 Provider。
6. build、测试类型检查、lint、格式检查和全量测试通过。
7. 设计、ADR/文档、学习日志、TODO 和 LR Machine Snapshot 同步。
