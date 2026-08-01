import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  AgentError,
  ToolRegistry,
  UserInterruptedError,
  defineTool,
  type ToolDefinition,
  type ToolExecutionOutput,
  type ToolMetadata,
} from "../../src/index.js";

function fixtureTool(name: string, description = `${name} description`) {
  return defineTool({
    name,
    description,
    inputSchema: z.object({ value: z.string() }),
    async execute(input) {
      return { content: input.value, isError: false };
    },
  });
}

describe("ToolRegistry registration", () => {
  it("preserves registration order and returns metadata snapshots", () => {
    const registry = new ToolRegistry([fixtureTool("first")]);
    registry.register(fixtureTool("second"));

    const listed = registry.list();
    expect(listed).toEqual([
      { name: "first", description: "first description", capability: "read" },
      {
        name: "second",
        description: "second description",
        capability: "read",
      },
    ]);

    (listed as ToolMetadata[]).push({
      name: "fake",
      description: "fake",
      capability: "read",
    });
    expect(registry.list()).toEqual([
      { name: "first", description: "first description", capability: "read" },
      {
        name: "second",
        description: "second description",
        capability: "read",
      },
    ]);
  });

  it("filters disabled tools from model definitions and blocks their execution", async () => {
    const execute = vi.fn(async () => ({ content: "unused", isError: false }));
    const registry = new ToolRegistry([
      defineTool({
        name: "search",
        description: "Search fixtures",
        inputSchema: z.object({}),
        execute,
      }),
    ]);

    expect(registry.listToolStatuses()).toEqual([
      {
        name: "search",
        description: "Search fixtures",
        capability: "read",
        enabled: true,
      },
    ]);
    expect(registry.setEnabled("search", false)).toBe(true);
    expect(registry.listModelDefinitions()).toEqual([]);
    await expect(
      registry.execute({ id: "call_disabled", name: "search", input: {} }),
    ).resolves.toEqual({
      toolCallId: "call_disabled",
      content: JSON.stringify({
        error: { code: "TOOL_DISABLED", tool: "search" },
      }),
      isError: true,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(registry.setEnabled("search", true)).toBe(true);
    expect(registry.listModelDefinitions()).toHaveLength(1);
    expect(registry.setEnabled("missing", false)).toBe(false);
  });

  it("rejects duplicate names without replacing the original tool", () => {
    const registry = new ToolRegistry([fixtureTool("search", "original")]);

    expect(() =>
      registry.register(fixtureTool("search", "replacement")),
    ).toThrow(expect.objectContaining({ code: "TOOL_NAME_DUPLICATE" }));
    expect(registry.list()).toEqual([
      { name: "search", description: "original", capability: "read" },
    ]);
  });

  it.each([
    ["blank name", fixtureTool("   ")],
    ["untrimmed name", fixtureTool(" search")],
    ["blank description", fixtureTool("search", "   ")],
    ["null definition", null as unknown as ToolDefinition],
    [
      "invalid schema",
      {
        name: "invalid-schema",
        description: "Invalid schema",
        inputSchema: {},
        execute: async () => ({ content: "unused", isError: false }),
      } as unknown as ToolDefinition,
    ],
    [
      "invalid execute",
      {
        name: "invalid-execute",
        description: "Invalid execute",
        inputSchema: z.object({}),
        execute: null,
      } as unknown as ToolDefinition,
    ],
  ])("rejects an invalid definition with %s", (_label, tool) => {
    expect(() => new ToolRegistry([tool])).toThrow(
      expect.objectContaining({ code: "TOOL_DEFINITION_INVALID" }),
    );
  });
});

describe("ToolRegistry execution", () => {
  it("executes with the parsed Zod output and preserves the Tool Call ID", async () => {
    const receivedInputs: unknown[] = [];
    const execute = vi.fn(async (input: { query: string; limit: number }) => {
      receivedInputs.push(input);
      return {
        content: `${input.query}:${input.limit}`,
        isError: false,
      };
    });
    const registry = new ToolRegistry([
      defineTool({
        name: "search",
        description: "Search fixtures",
        inputSchema: z.object({
          query: z
            .string()
            .trim()
            .transform((value) => value.toUpperCase()),
          limit: z.number().int().positive().default(5),
        }),
        execute,
      }),
    ]);

    await expect(
      registry.execute({
        id: "call_1",
        name: "search",
        input: { query: "  kfc ", extra: "must be removed" },
      }),
    ).resolves.toEqual({
      toolCallId: "call_1",
      content: "KFC:5",
      isError: false,
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(receivedInputs).toEqual([{ query: "KFC", limit: 5 }]);
  });

  it("returns a structured result for an unknown tool", async () => {
    const registry = new ToolRegistry();

    await expect(
      registry.execute({ id: "call_missing", name: "missing", input: {} }),
    ).resolves.toEqual({
      toolCallId: "call_missing",
      content: JSON.stringify({
        error: { code: "TOOL_NOT_FOUND", tool: "missing" },
      }),
      isError: true,
    });
  });

  it("returns deduplicated input paths without executing or leaking values", async () => {
    const execute = vi.fn(async () => ({ content: "unused", isError: false }));
    const registry = new ToolRegistry([
      defineTool({
        name: "validate",
        description: "Validate input",
        inputSchema: z.object({
          query: z
            .string()
            .min(3, "zod-secret-message")
            .regex(/^safe/, "second-secret-message"),
        }),
        execute,
      }),
    ]);

    const result = await registry.execute({
      id: "call_invalid",
      name: "validate",
      input: { query: "raw-secret-value" },
    });

    expect(result).toEqual({
      toolCallId: "call_invalid",
      content: JSON.stringify({
        error: {
          code: "TOOL_INPUT_INVALID",
          tool: "validate",
          paths: ["query"],
        },
      }),
      isError: true,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(result.content).not.toContain("raw-secret-value");
    expect(result.content).not.toContain("zod-secret-message");
    expect(result.content).not.toContain("second-secret-message");
  });

  it("preserves an intentional structured tool error", async () => {
    const registry = new ToolRegistry([
      defineTool({
        name: "intentional-error",
        description: "Return a safe error",
        inputSchema: z.object({}),
        async execute() {
          return { content: "safe tool error", isError: true };
        },
      }),
    ]);

    await expect(
      registry.execute({
        id: "call_error",
        name: "intentional-error",
        input: {},
      }),
    ).resolves.toEqual({
      toolCallId: "call_error",
      content: "safe tool error",
      isError: true,
    });
  });

  it.each([
    ["Error", () => new Error("error-secret")],
    ["KfcError", () => new AgentError("AGENT_INVALID_OPTIONS", "kfc-secret")],
    ["string", () => "string-secret"],
  ])(
    "converts a thrown %s without leaking it",
    async (_label, createFailure) => {
      const registry = new ToolRegistry([
        defineTool({
          name: "fail",
          description: "Fail safely",
          inputSchema: z.object({}),
          async execute() {
            throw createFailure();
          },
        }),
      ]);

      const result = await registry.execute({
        id: "call_fail",
        name: "fail",
        input: {},
      });

      expect(result).toEqual({
        toolCallId: "call_fail",
        content: JSON.stringify({
          error: { code: "TOOL_EXECUTION_FAILED", tool: "fail" },
        }),
        isError: true,
      });
      expect(result.content).not.toMatch(
        /error-secret|kfc-secret|string-secret/,
      );
    },
  );

  it("converts an invalid runtime output shape", async () => {
    const registry = new ToolRegistry([
      defineTool({
        name: "invalid-output",
        description: "Return an invalid shape",
        inputSchema: z.object({}),
        async execute() {
          return {
            content: 42,
            isError: "no",
          } as unknown as ToolExecutionOutput;
        },
      }),
    ]);

    await expect(
      registry.execute({
        id: "call_invalid_output",
        name: "invalid-output",
        input: {},
      }),
    ).resolves.toEqual({
      toolCallId: "call_invalid_output",
      content: JSON.stringify({
        error: {
          code: "TOOL_EXECUTION_FAILED",
          tool: "invalid-output",
        },
      }),
      isError: true,
    });
  });

  it("does not execute when the signal is already aborted", async () => {
    const execute = vi.fn(async () => ({ content: "unused", isError: false }));
    const registry = new ToolRegistry([
      defineTool({
        name: "known",
        description: "Known tool",
        inputSchema: z.object({}),
        execute,
      }),
    ]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      registry.execute(
        { id: "call_abort", name: "known", input: {} },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(UserInterruptedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("stops after asynchronous validation when cancellation occurs", async () => {
    let releaseValidation: (() => void) | undefined;
    let markValidationStarted: (() => void) | undefined;
    const validationStarted = new Promise<void>((resolve) => {
      markValidationStarted = resolve;
    });
    const validationGate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const execute = vi.fn(async () => ({ content: "unused", isError: false }));
    const registry = new ToolRegistry([
      defineTool({
        name: "async-validate",
        description: "Validate asynchronously",
        inputSchema: z.object({
          value: z.string().refine(async () => {
            markValidationStarted?.();
            await validationGate;
            return true;
          }),
        }),
        execute,
      }),
    ]);
    const controller = new AbortController();
    const pending = registry.execute(
      {
        id: "call_validate_abort",
        name: "async-validate",
        input: { value: "ok" },
      },
      { signal: controller.signal },
    );

    await validationStarted;
    controller.abort();
    releaseValidation?.();

    await expect(pending).rejects.toBeInstanceOf(UserInterruptedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("stops after tool execution when cancellation occurs", async () => {
    let releaseExecution: (() => void) | undefined;
    let markExecutionStarted: (() => void) | undefined;
    const executionStarted = new Promise<void>((resolve) => {
      markExecutionStarted = resolve;
    });
    const executionGate = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });
    const registry = new ToolRegistry([
      defineTool({
        name: "slow",
        description: "Resolve after cancellation",
        inputSchema: z.object({}),
        async execute() {
          markExecutionStarted?.();
          await executionGate;
          return { content: "late", isError: false };
        },
      }),
    ]);
    const controller = new AbortController();
    const pending = registry.execute(
      { id: "call_slow", name: "slow", input: {} },
      { signal: controller.signal },
    );

    await executionStarted;
    controller.abort();
    releaseExecution?.();

    await expect(pending).rejects.toBeInstanceOf(UserInterruptedError);
  });

  it("preserves a UserInterruptedError thrown by a tool", async () => {
    const interruption = new UserInterruptedError();
    const registry = new ToolRegistry([
      defineTool({
        name: "interrupt",
        description: "Interrupt execution",
        inputSchema: z.object({}),
        async execute() {
          throw interruption;
        },
      }),
    ]);

    await expect(
      registry.execute({ id: "call_interrupt", name: "interrupt", input: {} }),
    ).rejects.toBe(interruption);
  });
});
