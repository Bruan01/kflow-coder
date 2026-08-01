# P2.3 只读工作区工具实施计划

- **设计：** `docs/specs/2026-08-01-p2-3-read-only-workspace-tools-design.md`
- **目标：** 在统一 canonical workspace 边界上实现目录、文件和固定字符串搜索工具。
- **方法：** 使用临时目录、真实 Symlink 和注入小限制进行 red-green；不读取真实工作区。

## 1. Workspace Boundary

- 路径格式、canonical root、realpath containment。
- `.git`、绝对路径、`..`、反斜杠、NUL 和外部 Symlink。
- 只包含安全 code/path 的内部错误。

## 2. `list_directory`

- 非递归、稳定排序、entry type。
- `.git` 隐藏、limit、truncated 和取消。

## 3. `read_file`

- 普通 UTF-8 文件、行号、offset/limit。
- 空文件、换行格式、大小、二进制和取消。

## 4. `grep`

- 固定字符串、大小写、稳定遍历和单行去重。
- 跳过 Symlink、`.git`、node_modules、大文件和二进制。
- maxResults、maxSearchFiles、preview 和取消。

## 5. 验收

- 三个 Tool Definition 可直接注册到 ToolRegistry。
- 全量 build/typecheck/lint/format/test。
- 文档、学习日志、TODO 和 LR Snapshot 同步。
