# P2.3 只读工作区工具设计

- **状态：** 已实现并验证
- **日期：** 2026-08-01
- **阶段：** P2.3 只读工作区工具

## 1. 第一性问题

Agent 已能请求并执行注册工具，但真正读取代码会首次接触工作区文件系统。所谓“只读”并不天然安全：`../`、绝对路径、符号链接、`.git`、巨型文件、二进制内容、无限目录和递归搜索都可能越过预期边界或耗尽资源。

P2.3 的目标不是简单封装 `readdir`、`readFile` 和字符串搜索，而是先建立一个所有文件工具必须复用的 Workspace Boundary，再在其上实现三个受限、确定性、可取消的只读工具。

## 2. 已确认方向

- 新增共享 Workspace Boundary，三个工具不得各自实现路径安全。
- 工具路径使用工作区相对、POSIX `/` 分隔格式。
- 使用 `realpath` 校验工作区根和显式目标，防止符号链接逃逸。
- `list_directory` 非递归；显示 Symlink 但不跟随条目。
- `read_file` 只读取受限 UTF-8 普通文件，并按行返回。
- `grep` 首版只做固定字符串搜索，不执行 Shell、不使用正则。
- 递归 grep 不跟随发现的 Symlink，并跳过 `.git` 与 `node_modules`。
- 所有成功与主动失败内容均为稳定 JSON 字符串，只暴露相对路径。
- 测试只使用临时工作区，不读取真实仓库或用户目录。

## 3. 方案比较

### 方案 A：共享 Workspace Boundary + Node fs（采用）

Workspace Boundary 统一解析和校验目标；工具使用 `node:fs/promises` 实现业务行为。

优点：无 Shell 权限、路径规则单一、依赖少，测试可通过临时目录和真实 Symlink 验证。代价是 grep 需要自行遍历和读取文本，性能不如 ripgrep。

### 方案 B：每个工具独立校验路径（拒绝）

初期文件少，但 `..`、Symlink、`.git` 和相对路径输出规则会复制三次并逐渐漂移。

### 方案 C：调用 `find`、`cat`、`rg`（拒绝）

实现简单且性能好，但等价于提前开放进程执行边界，还会引入命令注入、平台差异、超时和输出上限问题，属于 P3 Shell 范围。

## 4. Tool Path 格式

模型提供的路径必须：

- 是非空字符串，最大 1024 个 UTF-16 code units。
- 使用 `/` 作为分隔符；反斜杠拒绝，避免跨平台解释差异。
- 不是绝对路径、Windows drive/UNC 路径或 `~` 路径。
- 不包含 NUL。
- 不包含空 segment、`.` 以外的特殊折叠，且任何 segment 不得为 `..`。
- 任何 segment 不得精确等于 `.git`。
- `.` 只允许作为完整根路径，不允许 `src/./file`。

工具不展开环境变量、Home、Glob 或 URL。输出路径统一转换成 POSIX 相对路径；工作区根显示为 `.`。

## 5. Workspace Boundary

异步工厂：

```ts
const boundary = await WorkspaceBoundary.create(workspaceRoot);
```

创建时：

- workspaceRoot 必须是存在的目录。
- 通过 `realpath` 保存 canonical root。
- 公共错误和 Tool Result 不暴露 canonical absolute path。

解析显式目标时：

1. 校验 Tool Path 格式。
2. 从 canonical root 组合 lexical absolute path。
3. 对目标执行 `realpath`。
4. 使用 `path.relative` 判断 canonical target 仍位于 canonical root 内。
5. 返回内部 absolute path 与安全相对路径。

允许显式请求一个指向工作区内部目标的 Symlink；指向外部的 Symlink 返回 `WORKSPACE_PATH_OUTSIDE`。递归遍历中发现的 Symlink 永不跟随。

Node 文件 API 存在检查后替换目标的 TOCTOU 理论窗口。P2.3 记录该残余风险，不尝试实现平台相关 `openat` 沙箱；P3 权限与沙箱阶段重新评估。

## 6. 内部 Workspace 错误

Workspace Boundary 和工具内部使用只包含 allowlist 字段的错误：

- `WORKSPACE_PATH_INVALID`
- `WORKSPACE_PATH_OUTSIDE`
- `PATH_NOT_FOUND`
- `NOT_A_FILE`
- `NOT_A_DIRECTORY`
- `FILE_TOO_LARGE`
- `BINARY_FILE`
- `SEARCH_FILE_LIMIT_REACHED`

工具捕获这些错误并返回 `isError: true` 的 JSON Tool Result。未知 fs error 继续抛出，由 Tool Registry 转换成通用 `TOOL_EXECUTION_FAILED`；不打印 errno message、absolute path 或 stack。

错误 JSON：

```json
{
  "error": {
    "code": "NOT_A_FILE",
    "path": "src"
  }
}
```

path 最多回显前 1024 个 code units，并由 JSON.stringify 转义。

## 7. 可配置限制

默认限制集中定义并允许测试注入更小值：

```ts
interface ReadOnlyToolLimits {
  readonly maxPathLength: number; // 1024
  readonly defaultListEntries: number; // 200
  readonly maxListEntries: number; // 500
  readonly defaultReadLines: number; // 200
  readonly maxReadLines: number; // 500
  readonly maxFileBytes: number; // 1 MiB
  readonly defaultSearchResults: number; // 50
  readonly maxSearchResults: number; // 200
  readonly maxSearchFiles: number; // 2000
  readonly maxPreviewLength: number; // 500
}
```

限制必须是正整数，默认值不得大于对应硬上限。非法限制在工具创建阶段返回结构化定义错误，不开始文件访问。

## 8. `list_directory`

工具定义：

```ts
{
  path: z.string().default("."),
  limit: z.number().int().positive().max(maxListEntries).default(defaultListEntries)
}
```

行为：

- 显式目标必须是目录。
- 只列一层，不递归。
- 使用 `readdir({ withFileTypes: true })`。
- `.git` 条目不返回。
- 按名称使用 Unicode code unit 升序稳定排序。
- entry type 为 `file`、`directory`、`symlink` 或 `other`。
- 不跟随或读取 Symlink 目标。
- 返回前 `limit` 项并设置 truncated。

成功 JSON：

```json
{
  "path": ".",
  "entries": [{ "name": "src", "type": "directory" }],
  "truncated": false
}
```

## 9. `read_file`

工具定义：

```ts
{
  path: z.string(),
  offset: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(maxReadLines).default(defaultReadLines)
}
```

行为：

- canonical target 必须是普通文件。
- stat 和实际读取后都检查 byteLength，防止文件在检查后增长。
- 大于 `maxFileBytes` 返回 `FILE_TOO_LARGE`。
- 包含 NUL 或无法使用 fatal UTF-8 TextDecoder 解码时返回 `BINARY_FILE`。
- 支持 LF、CRLF 和 CR；末尾换行不制造额外空行。
- offset 为 1-based；超过总行数时返回空 lines，而不是错误。
- 最多返回 limit 行。

成功 JSON：

```json
{
  "path": "src/index.ts",
  "totalLines": 42,
  "offset": 1,
  "lines": [{ "number": 1, "text": "export ..." }],
  "truncated": true
}
```

空文件 totalLines 为 0。truncated 表示请求范围之后仍有行。

## 10. `grep`

工具定义：

```ts
{
  query: z.string().min(1).max(512),
  path: z.string().default("."),
  caseSensitive: z.boolean().default(true),
  maxResults: z.number().int().positive().max(maxSearchResults).default(defaultSearchResults)
}
```

行为：

- query 是固定字符串，不作为 RegExp 或 Glob。
- 显式目标可以是普通文件或目录。
- 目录递归使用 Node fs，自行维护队列；目录项按名称排序，保证结果稳定。
- 跳过 `.git`、`node_modules` 和所有遍历发现的 Symlink。
- 每次 fs await、每个目录和每个文件之间检查 AbortSignal。
- 只扫描大小不超过 maxFileBytes 的 UTF-8 文本文件；过大、二进制和解码失败文件计入 skippedFiles，不使整个搜索失败。
- scannedFiles 是实际尝试检查内容的普通文件数量。
- 超过 maxSearchFiles 时返回 `SEARCH_FILE_LIMIT_REACHED` 错误，不继续遍历。
- 匹配按 path、line、同一行出现顺序稳定产生。
- 达到 maxResults 后立即停止，返回 truncated: true。
- preview 是匹配整行去除换行后的文本，最多 maxPreviewLength，超出时追加 `…`。

成功 JSON：

```json
{
  "query": "loadConfig",
  "path": "src",
  "matches": [
    {
      "path": "src/config/load-config.ts",
      "line": 151,
      "preview": "export async function loadConfig..."
    }
  ],
  "scannedFiles": 12,
  "skippedFiles": 1,
  "truncated": false
}
```

同一行无论 query 出现多少次，只返回一个 match，避免重复消耗结果预算。

## 11. 取消语义

- Tool Registry 已在工具执行前后检查取消。
- 三个真实工具仍必须在内部循环和每个文件系统 await 后检查 Signal。
- 已取消时抛 `UserInterruptedError`，不能返回部分成功或错误 Tool Result。
- grep 达到 maxResults 是正常截断；达到 maxSearchFiles 是资源上限错误；两者不能混淆。

P2.3 不增加 wall-clock timeout。工具 timeout 将在后续 P2 安全边界中统一设计，避免三个工具各建 timer。

## 12. 工具创建与 Registry 集成

异步工厂：

```ts
const tools = await createReadOnlyWorkspaceTools({
  workspaceRoot,
  limits,
});
const registry = new ToolRegistry(tools);
```

返回顺序固定为：

1. `list_directory`
2. `read_file`
3. `grep`

工具描述和 Zod input 保持协议无关。P2.3 不把它们接到真实 Provider Tool Calling，也不新增 Agent CLI 命令。

## 13. 模块边界

计划新增：

- `src/tool/workspace/workspace-boundary.ts`
- `src/tool/workspace/workspace-error.ts`
- `src/tool/workspace/limits.ts`
- `src/tool/workspace/list-directory-tool.ts`
- `src/tool/workspace/read-file-tool.ts`
- `src/tool/workspace/grep-tool.ts`
- `src/tool/workspace/create-read-only-tools.ts`
- 对应 `tests/tool/workspace/` 测试。

修改：

- `src/tool/index.ts` 公共导出。
- README、Tool Registry 文档、ADR/TODO 和学习日志。

不修改 Agent Loop、Provider 协议适配器、CLI 或权限系统。

## 14. 测试证据

至少覆盖：

1. root realpath、相对路径和 POSIX 输出。
2. 绝对路径、`..`、反斜杠、NUL、`.git`、超长路径。
3. 内部 Symlink 显式读取成功、外部 Symlink 拒绝。
4. list 排序、类型、`.git` 隐藏、limit 和 truncated。
5. read LF/CRLF/CR、offset、limit、空文件和末尾换行。
6. read 非文件、过大文件、NUL、非法 UTF-8。
7. grep 单文件/目录、大小写、稳定顺序和单行去重。
8. grep 跳过 `.git`、node_modules、Symlink、过大与二进制文件。
9. grep maxResults 截断与 maxSearchFiles 错误。
10. list/read/grep 请求前及执行中取消。
11. 所有错误无 absolute path、errno message 或 stack。
12. Tool Registry 使用三个定义执行，Agent Loop 仍无需修改。
13. 所有 P0-P2.2 测试回归。

## 15. 验收条件

1. 三个工具只能访问 canonical workspace root 内目标。
2. 没有 Shell、child_process、第三方 glob/grep 依赖。
3. 成功和已知失败只包含相对路径与 allowlist 字段。
4. 文件、行、目录、搜索和 preview 限制均有反例测试。
5. Symlink 和 `.git` 策略有真实临时目录测试。
6. 不写入、删除或创建工作区内容；测试创建仅发生在临时 Fixture 准备阶段。
7. build、测试类型检查、lint、格式检查和全量测试通过。
8. 设计、ADR/文档、学习日志、TODO 和 LR Machine Snapshot 同步。
