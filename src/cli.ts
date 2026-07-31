#!/usr/bin/env node

import { readPackageVersion } from "./cli/package-version.js";
import { runCli } from "./cli/run-cli.js";
import { createDoctorDependencies } from "./doctor/create-doctor-dependencies.js";
import { runDoctor } from "./doctor/doctor.js";
import { createQuickstartDependencies } from "./quickstart/create-quickstart-dependencies.js";
import { runQuickstart } from "./quickstart/quickstart.js";

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    version: readPackageVersion(),
    runDoctor: () => runDoctor(createDoctorDependencies()),
    runQuickstart: () => runQuickstart(createQuickstartDependencies()),
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  });
} catch {
  process.stderr.write("Error: Unable to initialize KFC.\n");
  process.exitCode = 1;
}
