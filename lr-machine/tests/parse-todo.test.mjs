import { describe, expect, it } from "vitest";

import { parseTodo } from "../lib/parse-todo.mjs";

const fixture = `# TODO

## P0：工程骨架

- [x] **P0.1 定义范围**：写愿景。
- [ ] **P0.2 初始化工程**：建立工具链。

## P1：模型调用

- [ ] 定义 Provider。

## 当前唯一任务

**P0.2 初始化工程**：建立最小 TypeScript 项目。
`;

describe("parseTodo", () => {
  it("extracts phase progress, verification, and current task", () => {
    const result = parseTodo(fixture, new Set(["P0.1"]));

    expect(result.phases).toHaveLength(2);
    expect(result.phases[0]).toMatchObject({
      id: "P0",
      completed: 1,
      verified: 1,
      total: 2,
    });
    expect(result.currentTask).toMatchObject({ id: "P0.2" });
    expect(result.totals).toEqual({
      total: 3,
      completed: 1,
      verified: 1,
      completionPercent: 33,
      verificationPercent: 33,
    });
  });
});
