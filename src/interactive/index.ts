export {
  createStartupFrames,
  playStartupAnimation,
} from "./startup-animation.js";
export type {
  StartupAnimationOptions,
  StartupFrameOptions,
} from "./startup-animation.js";
export {
  activitySpinnerFrame,
  startActivityAnimation,
} from "./activity-animation.js";
export type { ActivityAnimationHandle } from "./activity-animation.js";
export { runInteractiveSession } from "./interactive-session.js";
export type {
  InteractiveSessionOptions,
  InteractiveTurnHandlers,
} from "./interactive-session.js";
export { runInteractiveTerminal } from "./run-interactive-terminal.js";
export {
  interactiveCommands,
  interactiveToolDescription,
  interactiveToolLabels,
} from "./catalog.js";
export { getInteractiveTheme, interactiveThemes } from "./themes.js";
export type {
  InteractiveTerminalInput,
  InteractiveTerminalOptions,
  InteractiveRuntimeStatus,
  InteractiveSessionJournal,
  InteractiveTerminalTurnHandlers,
} from "./run-interactive-terminal.js";
export type {
  InteractiveCommandItem,
  InteractiveCommandName,
} from "./catalog.js";
export type { ThemePalette, WorkbenchTheme } from "./themes.js";
export { applyInputKey, createInputEditor } from "./input-editor.js";
export type { InputEditorState, InputKey } from "./input-editor.js";
export {
  appendAssistantText,
  appendNotice,
  appendToolEvent,
  appendToolResult,
  appendUserEvent,
  createWorkbenchState,
  isKnownCommand,
  moveCommandMenu,
  moveThemeMenu,
  moveToolConfirmation,
  moveToolMenu,
  moveWorkbenchScroll,
  renderWorkbench,
  selectedCommand,
  selectedThemeIndex,
  selectedToolConfirmation,
  setCommandMenu,
  setClearConfirmation,
  setToolConfirmation,
  setThemeMenu,
  setToolMenu,
  setWorkbenchActivity,
  setWorkbenchInput,
  setWorkbenchStatus,
  toolConfirmationChoices,
  updateToolApproval,
} from "./workbench.js";
export { projectMarkdown } from "./markdown-projection.js";
export type { MarkdownLine, MarkdownLineKind } from "./markdown-projection.js";
export { sanitizeTerminalText } from "./sanitize-terminal-text.js";
export { describeToolCall } from "./tool-activity.js";
export { summarizeToolResult } from "./tool-result-summary.js";
export type {
  InteractiveSessionInfo,
  WorkbenchEvent,
  WorkbenchRenderOptions,
  WorkbenchState,
  InteractiveToolStatus,
  WorkbenchActivity,
  ToolApprovalState,
  ToolConfirmationChoice,
  ToolConfirmation,
} from "./workbench.js";
