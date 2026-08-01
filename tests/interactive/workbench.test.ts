import { describe, expect, it } from "vitest";

import {
  appendAssistantText,
  appendNotice,
  appendToolEvent,
  createWorkbenchState,
  moveCommandMenu,
  moveWorkbenchScroll,
  renderWorkbench,
  setClearConfirmation,
  setCommandMenu,
  setWorkbenchInput,
} from "../../src/interactive/workbench.js";

describe("KFlow workbench renderer", () => {
  it("renders a stable three-region workbench without replaying terminal controls from content", () => {
    let state = createWorkbenchState();
    state = appendAssistantText(state, "Inspecting the workspace.");
    state = appendToolEvent(state, "read_file");
    state = setWorkbenchInput(state, "summarize \u001b[2Jprivate-plan.md");

    const screen = renderWorkbench(state, {
      columns: 84,
      rows: 24,
      color: false,
    });

    expect(screen).toContain("KFLOW");
    expect(screen).toContain("Read-only Agent");
    expect(screen).toContain("Tool  read_file");
    expect(screen).toContain("Working");
    expect(screen).toContain("summarize private-plan.md");
    expect(screen).not.toContain("\u001b[2Jprivate");
  });

  it("keeps the latest transcript entries visible above a fixed status and input region", () => {
    let state = createWorkbenchState();
    for (let index = 0; index < 20; index += 1) {
      state = appendNotice(state, `message-${index}`);
    }

    const screen = renderWorkbench(state, {
      columns: 60,
      rows: 12,
      color: false,
    });

    expect(screen).toContain("message-19");
    expect(screen).not.toContain("message-0");
    expect(screen).toContain("Esc cancel");
    expect(screen).toContain("Enter send");
  });

  it("shows a visible cursor at the configured insertion point", () => {
    const screen = renderWorkbench(
      setWorkbenchInput(createWorkbenchState(), "abc", 1),
      { columns: 60, rows: 12, color: true },
    );

    expect(screen).toContain("a\u001b[7mb\u001b[0mc");
  });

  it("renders colored event hierarchy and a selectable slash command menu", () => {
    let state = createWorkbenchState();
    state = appendToolEvent(state, "read_file");
    state = setCommandMenu(state, true);
    state = moveCommandMenu(state, 1);

    const screen = renderWorkbench(state, {
      columns: 70,
      rows: 20,
      color: true,
    });

    expect(screen).toContain("\u001b[32m  ✓ Tool");
    expect(screen).toContain("清除当前会话上下文和时间线");
    expect(screen).toContain("\u001b[7m");
  });

  it("scrolls the timeline without moving the fixed status and composer", () => {
    let state = createWorkbenchState();
    for (let index = 0; index < 20; index += 1) {
      state = appendNotice(state, `history-${index}`);
    }
    state = moveWorkbenchScroll(state, 8);

    const screen = renderWorkbench(state, {
      columns: 60,
      rows: 12,
      color: false,
    });

    expect(screen).toContain("history-11");
    expect(screen).not.toContain("history-19");
    expect(screen).toContain("Scroll 8 lines");
    expect(screen).toContain("Enter send");
  });

  it("renders a Chinese clear-context confirmation without clearing immediately", () => {
    const screen = renderWorkbench(
      setClearConfirmation(createWorkbenchState(), true),
      { columns: 70, rows: 14, color: false },
    );

    expect(screen).toContain("确认清除当前会话上下文和时间线？");
    expect(screen).toContain("输入 y 确认");
  });
});
