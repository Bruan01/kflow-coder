# KFC 共同工具面设计：Codex、pi 与 Claude Code

## 目标

提炼 Codex CLI、pi coding agent 与 Claude Code 的共同本地编程工具能力，
并在 KFC 中以供应商无关的 Tool Registry 统一注册、启用和执行。工具定义继续
由 Zod 输入校验和 `WorkspaceBoundary` 约束，Provider 只接收当前已启用的工具
JSON Schema。

## 调研来源

- OpenAI Codex：读取代码、修改代码、运行命令，以及按权限模式控制自动执行。
  <https://help.openai.com/en/articles/11096431>
- Claude Code：`Read`、`Edit`、`Write`、`Glob`、`Grep`、`Bash` 等内置工具。
  <https://docs.anthropic.com/en/docs/claude-code/tools>
- pi coding agent：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`，
  以及工具 allowlist / exclude 控制。
  <https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent>

## 共同能力矩阵

| KFC 能力组 | KFC 工具         | 必要性                                          | 默认状态 |
| ---------- | ---------------- | ----------------------------------------------- | -------- |
| 观察       | `list_directory` | 建立项目结构认知，避免模型盲猜入口              | 开启     |
| 观察       | `find_files`     | 用 glob 快速定位源文件、测试和配置              | 开启     |
| 观察       | `read_file`      | 读取可引用的代码证据，支持行号和大小限制        | 开启     |
| 观察       | `grep`           | 搜索符号、错误码和调用链，降低上下文成本        | 开启     |
| 验证       | `git_diff`       | 只读检查文件级 Git 变更、增删摘要和会话前脏状态 | 开启     |
| 修改       | `apply_patch`    | 以精确替换修改已有文件，保留可审计边界          | 关闭     |
| 修改       | `write_file`     | 创建新文件；不允许静默覆盖已有文件              | 关闭     |
| 执行       | `shell`          | 运行测试、构建和诊断，闭合“改后验证”循环        | 关闭     |

## 权限与边界

1. `read` 工具只解析工作区内路径，隐藏 `.git`，限制文件、结果和遍历规模。
2. `edit` 工具必须通过 `WorkspaceBoundary`，`apply_patch` 要求目标片段唯一匹配；
   `write_file` 只允许创建不存在的文件。
3. `execute` 工具固定工作目录在工作区内，限制超时、标准输出和标准错误大小，
   取消时终止子进程。它不是操作系统级沙箱，因此默认关闭，显式开启即代表用户
   承担该会话的执行权限。
4. `/tool` 改变 Registry 的 enabled 状态后，下一轮 Agent 请求立即读取最新工具
   定义，不需要重启会话。
5. 工具结果统一为结构化 JSON；工具失败回灌模型，不直接摧毁 Agent Loop。

## 不纳入本轮共同核心

Web、MCP、Skills、Subagents 和浏览器工具不是三者的最小本地工具交集。本轮不注册
这些能力。`git_diff` 是 P3 为“修改后可观察、失败可恢复”新增的只读验证工具，
不执行提交、回滚、分支或其他 Git 写操作。

## 验收证据

- 每个工具有独立 Zod 参数和执行测试。
- Registry 测试验证 capability、默认启用状态、工具开关和模型定义过滤。
- 工作区测试验证路径边界、文件大小、唯一补丁、创建文件、命令超时、输出截断，
  以及 `git_diff` 对已跟踪、未跟踪和会话前脏文件的区分。
- 完整 `build`、`typecheck:tests`、`lint`、`format:check`、`test` 和 `git diff --check`
  通过后，才把本任务标记为完成。
