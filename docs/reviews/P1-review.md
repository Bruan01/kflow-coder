# P1 阶段复盘：单轮模型调用

- **复盘日期：** 2026-07-31
- **状态：** Accepted
- **版本：** `0.1.0`
- **下一阶段：** P2 最小 Agent Loop 与只读工具

## 本阶段交付物

- 协议无关 `ModelProvider`、内部消息和四类流事件。
- `openai-chat-completions` 与 `openai-responses` 两个独立适配器。
- 增量 SSE、typed event Schema、usage、finish reason、timeout、取消和资源清理。
- 认证、额度、限流、上下文、超时、服务不可用和非法响应的结构化安全错误。
- 显式协议配置与 Provider 工厂，不做 URL/模型/失败回退探测。
- 最小 `kfc ask <prompt...>`：单轮 user message、流式 stdout、安全 stderr 摘要与 SIGINT。
- TTFT、总耗时和 Token usage 的真实调用观测。
- DeepSeek V4 Flash 的首个真实网络验收。

## 验收矩阵

| P1 capability             | Evidence                                                       | Result   |
| ------------------------- | -------------------------------------------------------------- | -------- |
| Core Provider contract    | `tests/provider/model-provider.test.ts`                        | passed   |
| Chat Completions adapter  | deterministic SSE fixtures and provider/lifecycle tests        | passed   |
| Responses adapter         | typed SSE fixtures, refusal/reasoning/incomplete/error tests   | passed   |
| Explicit protocol factory | `tests/provider/create-model-provider.test.ts`                 | passed   |
| Safe error normalization  | Provider/Error Presenter tests and redacted failure assertions | passed   |
| Timeout and cancellation  | both adapter lifecycle suites plus Ask interruption tests      | passed   |
| Minimal `kfc ask`         | parser, Ask Runner and CLI stdout/stderr tests                 | passed   |
| Real Provider call        | `docs/experiments/EXP-003-real-kfc-ask-deepseek.md`            | passed   |
| Anthropic Messages        | explicitly deferred by user; not a current completion gate     | deferred |
| Architecture decisions    | ADR-0002, ADR-0003 and ADR-0004                                | passed   |

## 质量与安全证据

```text
pnpm build           passed
pnpm typecheck:tests passed
pnpm test            30 files / 144 tests passed
pnpm lint            passed
pnpm format:check    passed
git diff --check     passed
```

- 自动化测试不访问真实 Provider 或开发者配置。
- 真实调用只通过用户明确授权执行一次低成本 Prompt。
- `config.json` 不含 API Key；私有凭证文件绑定 Base URL 并使用 `0600`。
- stdout 只包含模型正文，stderr 只包含安全指标或错误。
- 原始 Provider message、response body、cause、stack 和 Authorization 不进入公共输出。
- LR Machine 快照使用 allowlist 源码收集器，不保存真实配置或凭证。

## 真实发现

### 模型文本不是协议断言

Prompt 要求准确返回 `KFC_P1_ACCEPTED`，模型实际返回了带前导空格的文本。调用在协议层完全成功：退出码 0、`finish=stop`、usage 完整、SSE 正常结束。

这说明验收必须区分：

- **协议事实：** 状态、事件顺序、finish、usage、退出码。
- **模型行为：** 自然语言是否严格遵从字节格式。

不能用模型文本的偶然空白替代结构化完成证据。

## 为什么暂不实现 Anthropic Messages

Chat Completions 与 Responses 已经证明 Core 可以跨两种不同终止语义工作。当前主路线需要进入 Agent Loop，而不是继续横向增加 Provider。Anthropic Messages 没有真实消费者，也不会改变 P2 的最小工具循环，因此延期比继续扩展更符合“由问题换抽象”的原则。

## 技术债与剩余风险

- Responses 尚未进行真实外部调用，只有官方形状 Fixture。
- DeepSeek 只完成一次成功调用，尚未实测真实认证失败、限流、配额、上下文超限和网络中断。
- 没有重试、退避、请求 ID、持久化日志或指标聚合。
- Prompt 通过 argv 输入，可能进入 Shell history 或进程列表；敏感 Prompt 未来应支持 stdin。
- `kfc ask` 只有单条 user message，没有 system prompt、会话或上下文管理。
- 私有凭证文件虽然是 `0600`，仍属于明文存储。
- TTFT 反映客户端观察时间，也会受到网络、代理缓冲和终端调度影响。

## P2 明确不做

P2 只实现最小受控 Agent Loop 与只读工具。继续不做写文件、Shell、自动 Git、会话持久化、上下文压缩、MCP、Skills、Hooks、Subagents、TUI 和插件系统。

## 进入 P2 的判断

**P1 技术门槛通过。** KFC 已能通过真实配置和真实 Provider 完成单轮调用，并以确定性测试覆盖协议、取消、错误和输出边界。下一步应把模型调用放入一个有最大步数、结构化 Tool Call 和只读工具的受控状态机，而不是继续增加 Provider 或观测基础设施。
