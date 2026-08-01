import type { z } from "zod";

export interface ToolExecutionOptions {
  readonly signal?: AbortSignal;
}

export interface ToolExecutionOutput {
  readonly content: string;
  readonly isError: boolean;
}

export type ToolCapability = "read" | "edit" | "execute";

export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly capability?: ToolCapability;
  readonly enabledByDefault?: boolean;
  /** JSON Schema sent to model providers; inputSchema remains authoritative. */
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly inputSchema: TSchema;
  execute(
    input: z.output<TSchema>,
    options: ToolExecutionOptions,
  ): Promise<ToolExecutionOutput>;
}

export function defineTool<TSchema extends z.ZodType>(
  definition: ToolDefinition<TSchema>,
): ToolDefinition<TSchema> {
  return definition;
}
