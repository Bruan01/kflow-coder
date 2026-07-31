# P1.3 OpenAI Responses Provider 实施计划

- **设计：** `docs/specs/2026-07-31-p1-3-openai-responses-provider-design.md`
- **目标：** 在不扩张 Core `ModelProvider` 的前提下，将 OpenAI Responses 流严格投影为文本、usage 与 finish。
- **方法：** 每一组行为先写失败测试，再做最小实现；不调用真实外部服务。

## 1. Responses 外部 Schema

新增：

- `src/provider/openai-compatible/responses-schema.ts`
- `tests/provider/openai-compatible/responses-schema.test.ts`

先测试：

- 文本、拒绝、lifecycle、reasoning 和终端事件的官方形状可解析。
- 非负整数 `sequence_number`、文本位置、usage 与状态字段受到约束。
- 未知、缺字段和类型错误事件被拒绝。

再实现判别联合 Schema，并只导出 Provider 状态机需要的类型。

定向验证：

```sh
pnpm vitest run tests/provider/openai-compatible/responses-schema.test.ts
pnpm typecheck:tests
```

## 2. Responses 请求与成功流

新增：

- `src/provider/openai-compatible/openai-responses-provider.ts`
- `tests/provider/openai-compatible/openai-responses-provider.test.ts`
- `tests/fixtures/provider/openai-responses/openai-text-completed.sse`
- `tests/fixtures/provider/openai-responses/openai-refusal-completed.sse`

先测试：

- `POST <baseUrl>/responses` 的 Header 与请求体精确匹配。
- 普通文本和拒绝文本映射为 `text-delta`。
- reasoning/lifecycle 事件不会进入 Core。
- completed 与 incomplete 映射 usage 和 finish。

再实现：

- 复用 `decodeSseData` 与 `mapHttpError`。
- 校验严格递增的 sequence number。
- 跟踪唯一可见文本位置和 done 状态。
- 以 completed/incomplete 为成功终止，不接受 `[DONE]`。

定向验证：

```sh
pnpm vitest run tests/provider/openai-compatible/openai-responses-provider.test.ts
```

## 3. 失败状态与生命周期

修改或新增：

- `src/provider/openai-compatible/error-mapping.ts`
- 必要时新增最小共享 request lifecycle helper
- `tests/provider/openai-compatible/provider-lifecycle.test.ts`
- `tests/provider/openai-compatible/openai-responses-provider.test.ts`

先测试：

- EOF、非法 JSON、重复/倒序 sequence、多文本位置、done 后 delta、意外工具事件失败。
- response.failed/error 按受控机器码映射，未知码不泄漏原文。
- 请求前取消、fetch/stream 期间取消、timeout 与消费者提前退出均释放资源。
- Chat Completions 生命周期测试保持通过。

再实现流内错误码映射及两个适配器已经证明需要的最小共享生命周期逻辑。若提取会扩大接口或降低可读性，则保留协议内编排，只共享纯错误分类函数。

## 4. 公开导出与配置选择

修改：

- `src/provider/openai-compatible/index.ts`
- `src/config/config.ts`
- `src/config/schema.ts`
- `src/config/load-config.ts`
- 对应配置测试

先测试：

- 文件与 `KFC_PROTOCOL` 接受 `openai-responses`。
- 缺省协议仍是 `openai-chat-completions`。
- 其他协议继续产生稳定 `CONFIG_INVALID`。

再扩展 `ProviderProtocol` 与 Zod 枚举，不改变配置优先级或秘密边界。

## 5. Quickstart 协议选择

修改：

- `src/quickstart/quickstart.ts`
- `tests/quickstart/quickstart.test.ts`
- 必要的 Quickstart 文档测试

先测试：

- 默认选择 Chat Completions。
- 可显式选择 Responses。
- 非法值会重新询问，不会写入文件。
- 预览包含协议但不包含 API Key。

再增加基于现有 `ask` 接口的协议问题，不加入供应商预设。

## 6. 文档与学习证据

行为验证通过后更新：

- `docs/provider.md`
- `docs/configuration.md`
- `docs/quickstart.md`
- `docs/specs/2026-07-31-p1-3-openai-responses-provider-design.md`
- `TODO.md`
- `docs/learning-log.md`

记录真实失败证据、状态机不变量与 Core 未扩张的结论。最后生成不可变 LR Machine Snapshot。

## 7. 完整验收

按顺序运行：

```sh
pnpm build
pnpm typecheck:tests
pnpm lint
pnpm format:check
pnpm test
pnpm learning:snapshot -- "P1.3 OpenAI Responses Provider"
```

完成标准：所有命令通过，Snapshot 已生成，设计状态改为“已实现并验证”，TODO 勾选 P1.3；任何未执行的真实网络验收必须明确保留为后续项。
