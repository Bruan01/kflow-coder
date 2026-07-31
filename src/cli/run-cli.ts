import type { DoctorReport } from "../doctor/doctor.js";
import { formatDoctorReport } from "../doctor/doctor.js";
import { formatErrorForCli } from "../errors/error-presentation.js";
import type { QuickstartResult } from "../quickstart/quickstart.js";
import { createHelpText } from "./help.js";
import { parseCliArgs } from "./parse-args.js";

export interface CliEnvironment {
  version: string;
  runDoctor(): Promise<DoctorReport>;
  runQuickstart(): Promise<QuickstartResult>;
  writeStdout(text: string): void;
  writeStderr(text: string): void;
}

export async function runCli(
  args: readonly string[],
  environment: CliEnvironment,
): Promise<number> {
  const command = parseCliArgs(args);

  switch (command.type) {
    case "help":
      environment.writeStdout(createHelpText());
      return 0;
    case "version":
      environment.writeStdout(`${environment.version}\n`);
      return 0;
    case "doctor":
      try {
        const report = await environment.runDoctor();
        environment.writeStdout(formatDoctorReport(report));
        return report.exitCode;
      } catch (error) {
        const presentation = formatErrorForCli(error);
        environment.writeStderr(presentation.text);
        return presentation.exitCode;
      }
    case "quickstart":
      try {
        const result = await environment.runQuickstart();
        const write =
          result.exitCode === 0
            ? environment.writeStdout
            : environment.writeStderr;
        write(result.text);
        return result.exitCode;
      } catch (error) {
        const presentation = formatErrorForCli(error);
        environment.writeStderr(presentation.text);
        return presentation.exitCode;
      }
    case "error":
      environment.writeStderr(
        `Error: ${command.message}\nRun 'kfc --help' for usage.\n`,
      );
      return 1;
  }
}
