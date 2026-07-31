import { ConfigError, type KfcConfig } from "../config/config.js";

export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  status: DoctorCheckStatus;
  label: string;
  detail: string;
}

export interface DoctorReport {
  exitCode: number;
  checks: readonly DoctorCheck[];
}

export interface DoctorDependencies {
  nodeVersion: string;
  configPath: string;
  credentialsPath: string;
  homeDirectory: string;
  configFileExists(path: string): Promise<boolean>;
  credentialsFileExists(path: string): Promise<boolean>;
  loadConfig(): Promise<KfcConfig>;
}

const ISSUE_LABELS: Readonly<Record<string, string>> = {
  "provider.baseUrl": "Base URL",
  "provider.model": "Model",
  "provider.apiKey": "API Key",
  "provider.timeoutMs": "Timeout",
};

function nodeMajor(version: string): number | null {
  const match = version.match(/^v?(\d+)/);
  return match?.[1] ? Number(match[1]) : null;
}

function nodeCheck(version: string): DoctorCheck {
  const major = nodeMajor(version);
  if (major !== null && major >= 22) {
    return { status: "pass", label: "Node.js", detail: version };
  }
  return {
    status: "fail",
    label: "Node.js",
    detail: `${version}; requires Node.js 22 or newer`,
  };
}

export function formatConfigPathForDisplay(
  configPath: string,
  homeDirectory: string,
): string {
  if (configPath === homeDirectory) return "~";
  const prefix = homeDirectory.endsWith("/")
    ? homeDirectory
    : `${homeDirectory}/`;
  return configPath.startsWith(prefix)
    ? `~/${configPath.slice(prefix.length)}`
    : configPath;
}

function configChecks(config: KfcConfig): DoctorCheck[] {
  return [
    { status: "pass", label: "Base URL", detail: config.provider.baseUrl },
    { status: "pass", label: "Model", detail: config.provider.model },
    { status: "pass", label: "API Key", detail: "present" },
  ];
}

function configErrorChecks(error: ConfigError): DoctorCheck[] {
  if (error.issues.length === 0) {
    return [{ status: "fail", label: "Configuration", detail: error.message }];
  }
  return error.issues.map((issue) => ({
    status: "fail",
    label: ISSUE_LABELS[issue.path] ?? issue.path,
    detail: issue.message,
  }));
}

export async function runDoctor(
  dependencies: DoctorDependencies,
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [nodeCheck(dependencies.nodeVersion)];
  const displayConfigPath = formatConfigPathForDisplay(
    dependencies.configPath,
    dependencies.homeDirectory,
  );
  const displayCredentialsPath = formatConfigPathForDisplay(
    dependencies.credentialsPath,
    dependencies.homeDirectory,
  );
  const [configExists, credentialsExist] = await Promise.all([
    dependencies.configFileExists(dependencies.configPath),
    dependencies.credentialsFileExists(dependencies.credentialsPath),
  ]);
  checks.push(
    configExists
      ? { status: "pass", label: "Config file", detail: displayConfigPath }
      : {
          status: "warn",
          label: "Config file",
          detail: `${displayConfigPath} not found; using environment/defaults`,
        },
    credentialsExist
      ? {
          status: "pass",
          label: "Credentials",
          detail: displayCredentialsPath,
        }
      : {
          status: "warn",
          label: "Credentials",
          detail: `${displayCredentialsPath} not found; using environment`,
        },
  );

  let configFailed = false;
  try {
    checks.push(...configChecks(await dependencies.loadConfig()));
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    configFailed = true;
    checks.push(...configErrorChecks(error));
  }

  const nodeFailed = checks[0]?.status === "fail";
  return {
    checks,
    exitCode: configFailed ? 2 : nodeFailed ? 1 : 0,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const symbols: Record<DoctorCheckStatus, string> = {
    pass: "✓",
    warn: "!",
    fail: "✗",
  };
  const labelWidth = report.checks.reduce(
    (width, check) => Math.max(width, check.label.length),
    0,
  );
  const lines = report.checks.map(
    (check) =>
      `${symbols[check.status]} ${check.label.padEnd(labelWidth)}  ${check.detail}`,
  );
  return `KFC Doctor\n\n${lines.join("\n")}\n`;
}
