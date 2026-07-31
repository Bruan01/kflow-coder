# EXP-003：真实 `kfc ask` DeepSeek 验收

- **日期：** 2026-07-31
- **目标：** 证明真实 CLI 能通过本机私有配置和显式协议适配器调用首个目标 Provider，并分离正文、指标与秘密。
- **Provider：** DeepSeek
- **Base URL：** `https://api.deepseek.com`
- **Model：** `deepseek-v4-flash`
- **协议：** `openai-chat-completions`

## 前置检查

执行：

```text
pnpm build
pnpm kfc doctor
```

结果：

```text
✓ Node.js      v24.14.0
✓ Config file  ~/.config/kfc/config.json
✓ Credentials  ~/.config/kfc/credentials.json
✓ Base URL     https://api.deepseek.com
✓ Model        deepseek-v4-flash
✓ API Key      present
```

Doctor 没有联系 Provider，也没有显示凭证值。

## 真实调用

执行最小低成本 Prompt：

```text
pnpm kfc ask "Reply with exactly: KFC_P1_ACCEPTED"
```

观察到的 stdout：

```text
 KFC_P1_ACCEPTED
```

观察到的 stderr：

```text
[kfc] finish=stop ttft=1115ms total=1165ms tokens=95/29/124
```

进程退出码为 `0`。

## 结论

- CLI → 配置/凭证 → 显式协议工厂 → Chat Completions Provider → SSE → Ask Runner → stdout/stderr 的纵向链路真实成立。
- usage、finish reason、TTFT 和总耗时均来自真实流，没有由 Fixture 或独立指标模拟器伪造。
- API Key 未出现在命令、Doctor、正文、摘要或保存证据中。
- 模型在验收标记前返回了一个前导空格，因此自然语言中的“exactly”不能作为字节级协议断言。验收应依赖结构化终止、usage、退出码和包含目标语义，而不是假设模型严格服从格式。
- 本实验只证明 DeepSeek Chat Completions 路径。Responses 仍只有确定性 Fixture 证据；Anthropic Messages 已延期。
