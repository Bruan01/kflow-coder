# EXP-006：P3 读取—修改—Diff—测试—解释闭环

- 日期：2026-08-01
- 工作区：临时 Git 仓库（位于系统临时目录，实验结束后删除）
- 目的：在不修改 KFC 当前仓库和 `testforkfc/` 的前提下，验收 P3 的最小真实工具闭环。

## 任务轨迹

1. 创建并提交 `message.txt` 与 `check.mjs`，建立干净 Git 基线。
2. `read_file(message.txt)`：读取 1 行 `before`。
3. 启用并执行 `apply_patch`：把 `before` 精确替换为 `after`。
4. `git_diff`：只读报告 1 个文件、`+1/-1`，没有返回完整 patch 内容，并把该修改标为本会话产生。
5. 启用并执行 `shell`：运行 `node check.mjs`，退出码为 0。
6. 依据结构化结果解释：读取成功、修改成功、Diff 已核对、测试通过；若后续失败，恢复路径是再次检查 `git_diff`，而不是自动 `reset`。

## 结果摘要

```json
{
  "read": { "isError": false, "lines": 1 },
  "patch": { "isError": false, "workspaceChange": "changed" },
  "diff": {
    "isError": false,
    "files": 1,
    "additions": 1,
    "deletions": 1,
    "sessionFiles": 1
  },
  "test": { "isError": false, "exitCode": 0 }
}
```

## 证据与边界

- 自动化覆盖：`tests/tool/workspace/git-diff-tool.test.ts` 覆盖已跟踪修改、未跟踪文件、会话前已有脏文件和非 Git 目录。
- 交互覆盖：`tests/interactive/run-interactive-terminal.test.ts` 覆盖修改结果产生后本轮失败的已完成/失败/恢复说明。
- `git_diff` 使用固定参数数组调用 Git，不经过 Shell，不执行提交、回滚、删除或分支操作。
- 当前仓库的既有未跟踪目录 `testforkfc/` 未被读取、修改、加入暂存或提交。
