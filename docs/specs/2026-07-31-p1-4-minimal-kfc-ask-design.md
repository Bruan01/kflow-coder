# P1.4 Minimal `kfc ask` Vertical Slice 设计

- **状态：** 已实现并验证
- **日期：** 2026-07-31
- **阶段：** P1.4 Minimal `kfc ask` Vertical Slice

## 1. 第一性问题

KFC 已分别拥有 CLI、配置、凭证、错误和两个 Provider 适配器，但这些模块还没有形成用户可运行的单轮模型调用。继续增加协议或建设独立指标系统，只会让基础设施横向变宽，却不能证明“输入任务 → 调用模型 → 流式看到结果”的主路径成立。

P1.4 要完成第一个真实纵向闭环：用户通过 `kfc ask` 输入一个问题，KFC 加载配置、按显式协议创建 Provider、流式输出可见文本，并用稳定退出码、错误和调用指标说明结果。

## 2. 路线纠偏

- `anthropic-messages` 明确延期，不作为当前 P1 完成门槛。
- 不实现独立 `ObservedModelProvider`。在没有第二个指标消费者前，通用装饰器属于提前抽象。
- TTFT、总耗时和 usage 在 Ask Runner 内采集；若未来 Agent Loop 出现真实重复，再提取共享观察层。

## 3. 命令边界

新增：

```text
kfc ask <prompt...>
```

规则：

- `ask` 后至少需要一个非空参数。
- 多个 positional 按单个空格连接，允许 `kfc ask explain this project`，也支持 Shell 引号保留原始空格。
- P1.4 不从 stdin、文件或交互会话读取 Prompt。
- `--help`、`--version`、`--quickstart` 等全局选项继续优先处理；未知选项维持现有错误边界。
- Ask 只产生一条 `user` 消息，不注入隐藏 system prompt，不保存会话。

## 4. 组件边界

### 4.1 CLI 参数与帮助

`parseCliArgs()` 新增 `{ type: "ask"; prompt: string }`。Help 增加 `ask <prompt...>` 示例。参数解析保持纯函数，不读取配置或进程状态。

### 4.2 Provider 工厂

新增协议无关 `createModelProvider(config)`：

- `openai-chat-completions` → `OpenAiChatCompletionsProvider`
- `openai-responses` → `OpenAiResponsesProvider`

工厂只根据已验证的 `ProviderConfig.protocol` 分派，不看 URL、模型名或响应形状，不发网络请求。

### 4.3 Ask Runner

新增 `runAsk(prompt, dependencies, options)`，依赖：

- 一个 `ModelProvider`
- 可注入单调时钟 `now()`，默认使用 `performance.now()`
- 文本回调 `onText(delta)`
- 可选 `AbortSignal`

Runner 构造单条 user message，消费 Provider 流并原样把非空 `text-delta` 交给 `onText`。它不理解 Chat Completions 或 Responses 字段。

### 4.4 进程适配

`src/cli.ts` 在执行 Ask 时：

1. 调用 `loadConfig()`。
2. 使用 Provider 工厂创建适配器。
3. 为当前调用创建 `AbortController`。
4. 临时监听一次 `SIGINT` 并中止 controller。
5. 将文本 delta 写入 stdout，将最终摘要写入 stderr。
6. 在成功、失败和中断后移除 listener。

CLI 入口仍保持薄层；配置合并、协议分派、流状态和错误格式化分别由已有模块负责。

## 5. 输出边界

### stdout

- 只包含模型可见文本。
- 按 delta 到达顺序实时写入，不缓存完整回答。
- 成功结束时，如果最后一个 delta 不以换行结尾，补一个换行，便于终端显示。
- 不输出 usage、计时、配置、模型名或错误详情，保证正文可被管道消费。

### stderr

成功后输出单行安全摘要：

```text
[kfc] finish=stop ttft=123ms total=456ms tokens=12/4/16
```

Token 顺序为 input/output/total。usage 或首 Token 不存在时使用 `n/a`。毫秒展示使用四舍五入后的非负整数。

失败或中断继续使用 `formatErrorForCli`。若失败前已有部分文本，已有 stdout 不撤回，错误只进入 stderr。

## 6. Ask Report 与计时语义

Runner 成功返回：

```ts
interface AskReport {
  readonly timeToFirstTokenMs: number | null;
  readonly totalDurationMs: number;
  readonly usage?: ModelTokenUsage;
  readonly finishReason: ModelFinishReason;
  readonly endedWithNewline: boolean;
}
```

- 开始时间：`runAsk()` 开始消费 Provider 流之前。
- 首 Token：第一个非空 `text-delta` 被观察到时。
- 总耗时：收到 `finish` 时减开始时间。
- usage：保留 Provider 的规范化 usage 事件。
- Runner 要求恰好一个 `finish` 才成功；流静默 EOF、重复 start/usage/finish、finish 后事件或 usage 算术非法属于 Provider 契约违例，抛安全的 `PROVIDER_INVALID_RESPONSE`。
- Provider 抛出的 `KfcError` 保持身份；未知错误由 CLI 现有安全 presenter 处理。

P1.4 不持久化指标、不上传遥测、不创建通用 Recorder。

## 7. 取消与资源清理

- 请求前 Signal 已取消时，不开始 Provider 消费。
- SIGINT 触发 AbortController，Provider 归一化为 `USER_INTERRUPTED`，CLI 返回 130。
- Runner 不把取消伪造成 finish。
- Provider 负责取消 fetch 和 reader；进程适配负责移除 SIGINT listener。
- P1.4 不增加第二次 Ctrl+C 强制退出或跨请求全局 controller。

## 8. 错误与秘密

- Ask 使用现有 `loadConfig`，凭证优先级和 Base URL 绑定规则不变。
- API Key 只进入 Provider Authorization Header，不进入 Ask Report、stdout、stderr 或计时。
- 配置错误返回 2，Provider 错误返回 3，中断返回 130，未知内部错误返回 1。
- 不打印原始 Provider message、response body、cause 或 stack。

## 9. 计划文件

新增：

- `src/ask/run-ask.ts`
- `src/ask/index.ts`
- `src/provider/create-model-provider.ts`
- `tests/ask/run-ask.test.ts`
- `tests/provider/create-model-provider.test.ts`

修改：

- `src/cli/parse-args.ts`
- `src/cli/help.ts`
- `src/cli/run-cli.ts`
- `src/cli.ts`
- 对应 CLI 测试和公共导出
- README、Provider 文档、TODO 与学习日志

## 10. 测试证据

至少覆盖：

1. `ask` 参数解析、缺失 Prompt、多 positional 和 Help。
2. Provider 工厂精确选择两个协议，不自动探测。
3. Ask Runner 原样流式转发文本，并计算确定性 TTFT、总耗时、usage 与 finish。
4. 空 delta 不触发 TTFT；无文本成功时为 `null`。
5. 重复或缺失生命周期事件被拒绝。
6. ProviderError、配置错误和未知错误使用既有安全退出码，不泄漏测试秘密。
7. AbortSignal 中断传播为 130，不产生成功摘要。
8. stdout 只含正文，stderr 只含摘要或错误。
9. 两个协议适配器、Doctor 和 Quickstart 全量回归。

自动化测试注入 Provider、时钟、配置加载器和输出函数，不访问真实网络或用户配置。

## 11. 验收条件

1. 构建后可通过 `pnpm kfc ask "..."` 进入单轮调用。
2. 两种已实现协议都能通过同一个 Provider 工厂进入 Ask Runner。
3. stdout/stderr、错误码、取消和秘密边界有确定性测试。
4. TTFT、总耗时和 Token 用量由真实 Ask 流产生，而非独立模拟子系统。
5. build、测试类型检查、lint、格式检查和全量测试通过。
6. 不使用真实凭证的自动化验收完成；真实网络调用仍需用户显式授权。
7. 文档、学习日志、TODO 和 LR Machine Snapshot 同步。
