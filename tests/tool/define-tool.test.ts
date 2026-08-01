import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { defineTool } from "../../src/index.js";

describe("defineTool", () => {
  it("infers the execute input from the Zod output type", async () => {
    const tool = defineTool({
      name: "search",
      description: "Search an in-memory fixture",
      inputSchema: z.object({
        query: z.string().trim().min(1),
        limit: z.number().int().positive().default(5),
      }),
      async execute(input) {
        expectTypeOf(input).toEqualTypeOf<{
          query: string;
          limit: number;
        }>();
        return {
          content: `${input.query}:${input.limit}`,
          isError: false,
        };
      },
    });

    await expect(tool.execute({ query: "KFC", limit: 2 }, {})).resolves.toEqual(
      { content: "KFC:2", isError: false },
    );
    expect(tool).toMatchObject({
      name: "search",
      description: "Search an in-memory fixture",
    });
  });
});
