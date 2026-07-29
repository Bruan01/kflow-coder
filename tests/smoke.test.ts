import { describe, expect, it } from "vitest";

import { projectName } from "../src/index.js";

describe("project scaffold", () => {
  it("exports the project identity", () => {
    expect(projectName).toBe("kflow-code");
  });
});
