# EXP-002：DIY Quickstart PTY 验收

- **日期：** 2026-07-29
- **目标：** 证明 `--quickstart` / `--qs` 能在真实终端中生成完全自定义、无秘密、可被 Doctor 读取的 Provider 配置。
- **配置路径：** `/private/tmp/kfc-quickstart-qa.json`（验收后删除）

## 输入

```text
Base URL: https://gateway.example.com/v1
Model: diy-model-v1
Timeout: 45000
Write: yes
```

使用测试专用 `KFC_API_KEY` 环境变量。向导没有询问、打印或写入该值。

## 结果

```text
✓ Provider configuration saved
✓ Node.js
✓ Config file
✓ Base URL: https://gateway.example.com/v1
✓ Model: diy-model-v1
✓ API Key: present
```

生成文件：

```json
{
  "provider": {
    "type": "openai-compatible",
    "baseUrl": "https://gateway.example.com/v1",
    "model": "diy-model-v1",
    "timeoutMs": 45000
  }
}
```

## 安全与失败路径

- 文件权限为 `0600`。
- 文件中没有 `apiKey` 或测试密钥。
- 再次运行时选择不覆盖，退出码为 `130`，原文件保持不变。
- stdin 重定向为非 TTY 时，退出码为 `1`，提示需要交互式终端。
- 临时文件在验收后删除。

## 结论

Quickstart 消除了配置文件位置、JSON 结构和原子写入的手工摩擦，同时没有扩张秘密存储边界。它只生成自定义 OpenAI-compatible 配置，不包含供应商预设，也不验证网络或模型可用性。
