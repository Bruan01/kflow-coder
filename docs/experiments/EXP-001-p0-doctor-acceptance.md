# EXP-001：P0 Doctor 真实验收

- **日期：** 2026-07-29
- **仓库分支：** `main`
- **目标：** 在不读取真实用户配置、不调用 Provider 的前提下，验证 P0 CLI、配置、错误和 Doctor 闭环。

## 受控配置

```text
KFC_CONFIG_PATH=/private/tmp/<nonexistent>.json
KFC_BASE_URL=https://api.deepseek.com
KFC_MODEL=deepseek-v4-flash
KFC_TIMEOUT_MS=60000
KFC_API_KEY=<test-only secret>
```

临时配置文件明确不存在，因此成功结果只能来自环境变量与默认值。测试密钥仅存在于子进程环境，没有写入文件、日志、报告或快照。

## 验收结果

| Command / scenario       | Expected                   | Actual                     |
| ------------------------ | -------------------------- | -------------------------- |
| `pnpm build`             | exit 0                     | passed                     |
| `pnpm lint`              | exit 0                     | passed                     |
| `pnpm format:check`      | exit 0                     | passed                     |
| `pnpm test`              | all pass                   | 15 files / 51 tests passed |
| `pnpm kfc --help`        | usage and doctor command   | passed, exit 0             |
| `pnpm kfc --version`     | package version            | `0.1.0`, exit 0            |
| `pnpm kfc --unknown`     | safe usage error           | exit 1, no stack           |
| Doctor with complete env | all required config passes | exit 0                     |
| Doctor without API Key   | explicit API-key failure   | exit 2                     |

## 成功路径证据

```text
KFC Doctor

✓ Node.js      v24.14.0
! Config file  <temporary path> not found; using environment/defaults
✓ Base URL     https://api.deepseek.com
✓ Model        deepseek-v4-flash
✓ API Key      present
```

## 失败路径证据

```text
KFC Doctor

✓ Node.js      v24.14.0
! Config file  <temporary path> not found; using environment/defaults
✗ API Key      KFC_API_KEY is required
```

失败路径退出码为 `2`。输出不包含测试密钥、Authorization、原始 Error message 或 Stack。

## 结论

P0 的用户可见闭环成立：CLI 能解析命令，配置能从受控来源合并和校验，领域错误能安全表达，Doctor 能把结果转成稳定输出和退出码。该实验不证明 DeepSeek 鉴权、网络、模型、流式或 Tool Calling 可用，这些属于 P1。
