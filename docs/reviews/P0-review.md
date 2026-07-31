# P0 阶段复盘：工程骨架与边界

- **复盘日期：** 2026-07-29
- **状态：** Accepted
- **版本：** `0.1.0`
- **下一阶段：** P1 单轮 DeepSeek 调用

## 本阶段交付物

- Node.js 22+、pnpm、严格 TypeScript、Vitest、ESLint 和 Prettier 工程。
- `kfc --help`、`kfc --version` 与 `kfc doctor`。
- 环境变量、XDG 用户配置文件、Zod 校验和明确优先级。
- 环境变量专用 API Key 与配置脱敏。
- `KfcError`、ConfigError、ProviderError、用户中断和安全 CLI 展示。
- LR Machine 实时进度、学习日志、核心源码和不可变 HTML 快照。
- Vision、配置、错误、Doctor、学习日志、实验记录和三份 ADR。

## 验收矩阵

| P0 task          | Evidence                                            | Result |
| ---------------- | --------------------------------------------------- | ------ |
| P0.1 范围        | `docs/vision.md`                                    | passed |
| P0.2 工程        | build/test/lint/format scripts and lockfile         | passed |
| P0.3 CLI         | help/version/unknown-option tests and real commands | passed |
| P0.4 配置        | environment/file precedence and redaction tests     | passed |
| P0.5 错误        | unified error, exit-code, retry and leakage tests   | passed |
| P0.6 Doctor      | EXP-001 success/failure CLI evidence                | passed |
| P0.7 ADR         | ADR-0001 plus ADR index                             | passed |
| P0.8 质量门      | build, 63 tests, lint, format and diff check        | passed |
| P0.9 复盘        | `docs/reviews/P0-review.md` and 10/10 evidence      | passed |
| P0.10 Quickstart | EXP-002 PTY, 0600 atomic write, no-key storage      | passed |

## 质量与安全证据

```text
pnpm build         passed
pnpm test          17 files / 63 tests passed
pnpm lint          passed
pnpm format:check  passed
git diff --check   passed
```

- Word 路线文档未被 Git 跟踪并被 `.gitignore` 命中。
- 没有真实 `.env`、私钥或凭证文件。
- `.env.example` 中 `KFC_API_KEY` 为空。
- 非测试和非快照文件中未发现疑似硬编码 API Key 或 Bearer Token。
- Doctor 与 Error Presenter 的失败输出无密钥和 Stack。
- LR Machine 只读、仅监听本机，并拒绝路径穿越和写请求。

## 真实失败案例

### 失败

P0.3 首次严格构建时，TypeScript 无法识别 `process` 与 `node:*` 模块。虽然已经安装 `@types/node`，`tsconfig.json` 没有显式启用 Node 类型。更危险的是编译器仍写出了 `dist/cli.js`，使程序看似能够运行，但构建退出码实际为失败。

### 根因

- 依赖存在不代表编译器自动加载对应类型。
- 没有启用 `noEmitOnError`，错误构建仍可能产生新输出。

### 修复

```json
{
  "types": ["node"],
  "noEmitOnError": true
}
```

### 验证

重新运行 build、真实 CLI 和全量测试均通过。该失败说明退出码比“文件是否生成”更可信。

## 必须回答的问题

### CLI 参数解析与核心逻辑为什么分开？

终端参数、stdout/stderr 和退出码是适配层；命令、配置、Doctor 报告和错误是领域行为。分开后可以用普通数据测试 Core，也能在未来 Web、IDE 或 MCP 接口中复用，而不把 `process` 传播到所有模块。

### 哪些错误展示给用户，哪些只进入调试信息？

用户看到稳定 code、安全 message 和可行动的 public details。请求 ID、尝试次数等结构化信息可以进入显式 Debug。未知 message、Stack、cause、Provider 原始响应、Authorization 和密钥默认不可信，不能直接展示。

### 为什么首版不做 TUI、Monorepo 和插件系统？

它们不参与验证最小 Agent 闭环，却会引入渲染、包边界、版本与扩展协议。当前单进程和少量模块没有暴露必须使用这些结构的问题；提前实现只会增加无法由真实任务验证的抽象。

## 技术债与剩余风险

- 尚未发起真实 Provider 请求，Provider 错误码只是预定义契约。
- 没有流式事件、AbortController、重试和 Token/延迟观测。
- `util.parseArgs` 尚未经历多层子命令压力。
- Debug 只支持安全结构化字段，没有持久化日志和受控 Stack。
- LR Machine 没有热更新；历史快照故意保持不可变。
- P0 变更尚未形成独立的本地 Git 检查点提交。

## 下一阶段明确不做

P1 只完成单轮模型调用、流式输出、取消、错误映射和观测。仍不做工具、Agent Loop、写文件、Shell、MCP、Skills、Hooks、Subagents、TUI 或插件系统。

## 进入 P1 的判断

**技术门槛通过。** CLI、配置、错误、Doctor、测试和文档证据足以支撑一个 OpenAI-compatible Provider。进入 P1 前建议创建本地 P0 检查点提交，以便后续 Diff、回滚和实验比较；是否提交和推送由用户决定。
