# P1.4 Minimal `kfc ask` 实施计划

- **设计：** `docs/specs/2026-07-31-p1-4-minimal-kfc-ask-design.md`
- **目标：** 连接 CLI、配置、协议工厂和现有 Provider，形成第一个单轮流式调用闭环。
- **方法：** 按公开边界逐个 red-green，不调用真实外部服务。

## 1. CLI 命令

修改 `parse-args.ts`、`help.ts` 及对应测试：

- `ask <prompt...>` 解析为结构化命令。
- 缺失或空 Prompt 返回稳定参数错误。
- 多 positional 使用单空格连接。
- Help 展示命令与示例。

## 2. Ask Runner

新增 `src/ask/run-ask.ts` 与测试：

- 构造单条 user message。
- 原样转发非空文本 delta。
- 记录 TTFT、总耗时、usage、finish reason 和尾部换行状态。
- 拒绝缺失/重复生命周期终端事件。
- 保持 ProviderError 与 UserInterruptedError 身份。

## 3. Provider 工厂

新增 `src/provider/create-model-provider.ts` 与测试：

- 显式协议分派到两个现有 Provider。
- 不读取 URL/模型名，不发网络请求。

## 4. CLI Runner 与进程组装

修改 `run-cli.ts`、`cli.ts` 与测试：

- stdout 实时接收正文并按需补换行。
- stderr 输出安全指标摘要。
- 错误使用统一 presenter。
- 进程层临时绑定 SIGINT，并在所有路径清理。

## 5. 验收与证据

更新 README、Provider 文档、TODO、学习日志与设计状态，随后运行：

```sh
pnpm build
pnpm typecheck:tests
pnpm lint
pnpm format:check
pnpm test
pnpm learning:snapshot -- "P1.4 Minimal kfc ask"
```
