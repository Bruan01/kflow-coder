import { describe, expect, it, vi } from "vitest";

import type { DoctorReport } from "../../src/doctor/doctor.js";
import { runCli } from "../../src/cli/run-cli.js";

function createHarness(version = "0.1.0", doctorReport?: DoctorReport) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const runDoctor = vi.fn(
    async () =>
      doctorReport ?? {
        exitCode: 0,
        checks: [
          { status: "pass" as const, label: "Node.js", detail: "v24.14.0" },
        ],
      },
  );
  const runQuickstart = vi.fn(async () => ({
    exitCode: 0,
    text: "Quickstart complete\n",
  }));
  return {
    stdout,
    stderr,
    runDoctor,
    runQuickstart,
    environment: {
      version,
      runDoctor,
      runQuickstart,
      writeStdout: (text: string) => stdout.push(text),
      writeStderr: (text: string) => stderr.push(text),
    },
  };
}

describe("runCli", () => {
  it("prints help to stdout and exits successfully", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["--help"], harness.environment);

    expect(exitCode).toBe(0);
    expect(harness.stderr).toEqual([]);
    expect(harness.stdout.join("")).toContain("Usage:");
    expect(harness.stdout.join("")).toContain("doctor");
    expect(harness.stdout.join("")).toContain("--quickstart");
    expect(harness.runDoctor).not.toHaveBeenCalled();
    expect(harness.runQuickstart).not.toHaveBeenCalled();
  });

  it("prints the injected package version", async () => {
    const harness = createHarness("9.8.7");

    const exitCode = await runCli(["--version"], harness.environment);

    expect(exitCode).toBe(0);
    expect(harness.stdout).toEqual(["9.8.7\n"]);
    expect(harness.stderr).toEqual([]);
  });

  it("runs doctor and prints the formatted report", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["doctor"], harness.environment);

    expect(exitCode).toBe(0);
    expect(harness.runDoctor).toHaveBeenCalledOnce();
    expect(harness.stdout.join("")).toContain("KFC Doctor");
    expect(harness.stdout.join("")).toContain("✓ Node.js");
  });

  it.each([["--quickstart"], ["--qs"]])(
    "runs the interactive setup for %j",
    async (...args) => {
      const harness = createHarness();

      const exitCode = await runCli(args, harness.environment);

      expect(exitCode).toBe(0);
      expect(harness.runQuickstart).toHaveBeenCalledOnce();
      expect(harness.stdout).toEqual(["Quickstart complete\n"]);
    },
  );

  it("prints understandable argument errors to stderr", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["--unknown"], harness.environment);

    expect(exitCode).toBe(1);
    expect(harness.stdout).toEqual([]);
    expect(harness.stderr.join("")).toBe(
      "Error: Unknown option: --unknown\nRun 'kfc --help' for usage.\n",
    );
    expect(harness.stderr.join("")).not.toContain("at ");
  });

  it("uses the unified safe presenter when doctor throws", async () => {
    const harness = createHarness();
    harness.runDoctor.mockRejectedValueOnce(
      new Error("private secret from dependency"),
    );

    const exitCode = await runCli(["doctor"], harness.environment);

    expect(exitCode).toBe(1);
    expect(harness.stdout).toEqual([]);
    expect(harness.stderr.join("")).toContain("INTERNAL_ERROR");
    expect(harness.stderr.join("")).not.toContain(
      "private secret from dependency",
    );
  });
});
