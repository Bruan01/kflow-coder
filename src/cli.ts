#!/usr/bin/env node

import { readPackageVersion } from "./cli/package-version.js";
import { runCli } from "./cli/run-cli.js";
import { runAsk } from "./ask/run-ask.js";
import { loadConfig } from "./config/load-config.js";
import { createDoctorDependencies } from "./doctor/create-doctor-dependencies.js";
import { runDoctor } from "./doctor/doctor.js";
import { createQuickstartDependencies } from "./quickstart/create-quickstart-dependencies.js";
import { runQuickstart } from "./quickstart/quickstart.js";
import { createModelProvider } from "./provider/create-model-provider.js";

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    version: readPackageVersion(),
    runDoctor: () => runDoctor(createDoctorDependencies()),
    runQuickstart: () => runQuickstart(createQuickstartDependencies()),
    runAsk: async (prompt, onText) => {
      const controller = new AbortController();
      const handleInterrupt = (): void => controller.abort();
      process.once("SIGINT", handleInterrupt);
      try {
        const config = await loadConfig();
        return await runAsk(
          prompt,
          {
            provider: createModelProvider(config.provider),
            onText,
          },
          { signal: controller.signal },
        );
      } finally {
        process.removeListener("SIGINT", handleInterrupt);
      }
    },
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  });
} catch {
  process.stderr.write("Error: Unable to initialize KFC.\n");
  process.exitCode = 1;
}
