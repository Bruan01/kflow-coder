# P2.2 Tool Registry 实施计划

- **设计：** `docs/specs/2026-08-01-p2-2-tool-registry-design.md`
- **目标：** 用纯内存 Registry、Zod 和假工具建立安全参数与执行边界。
- **方法：** 每项行为先写失败测试；不读取文件、不执行 Shell、不调用真实模型。

## 1. 注册错误与 typed Tool

- 新增 ToolRegistryError 及稳定错误码。
- 新增 `defineTool()`，用类型检查证明 execute input 来自 Zod output。
- 拒绝非法 name、description、Schema、execute 和重复名称。

## 2. Registry 基础行为

- 注册和按顺序列出 metadata。
- list 返回快照，不暴露内部 Map。
- 合法 input 经过 `safeParseAsync` 后执行。
- 验证 default、transform 和未知字段剔除。

## 3. 安全失败

- 未知工具 → `TOOL_NOT_FOUND`。
- 参数失败 → `TOOL_INPUT_INVALID` 和安全字段路径。
- 工具 throw 或非法 output → `TOOL_EXECUTION_FAILED`。
- 主动 `{ isError: true }` 结果保留。

## 4. 取消与 Agent 集成

- 请求前、异步校验后和工具 await 后检查 AbortSignal。
- UserInterruptedError 保持身份。
- Registry 直接注入 `runAgent`，验证成功和错误 Tool Result 回灌。

## 5. 验收

更新 Tool/Error/Agent 文档、TODO 和学习日志，随后运行：

```sh
pnpm build
pnpm typecheck:tests
pnpm lint
pnpm format:check
pnpm test
pnpm learning:snapshot -- "P2.2 Tool Registry"
```
