import { KfcError } from "./kfc-error.js";

export interface ErrorPresentationOptions {
  debug?: boolean;
}

export interface ErrorPresentation {
  exitCode: number;
  text: string;
}

const SENSITIVE_KEY =
  /api[-_]?key|authorization|token|secret|password|credential/i;

function sanitizeDebugValue(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
): unknown {
  if (key && SENSITIVE_KEY.test(key)) {
    return "[REDACTED]";
  }
  if (value instanceof Error) {
    return { name: value.name };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDebugValue(item, undefined, seen));
  }
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeDebugValue(childValue, childKey, seen),
      ]),
    );
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function publicIssueLines(error: KfcError): string[] {
  const issues = error.details?.issues;
  if (!Array.isArray(issues)) return [];

  return issues.flatMap((issue) => {
    if (typeof issue !== "object" || issue === null) return [];
    const path = "path" in issue ? String(issue.path) : "config";
    const message =
      "message" in issue ? String(issue.message) : "Invalid value";
    return [`  - ${path}: ${message}`];
  });
}

export function normalizeUnknownError(error: unknown): KfcError {
  if (error instanceof KfcError) {
    return error;
  }

  return new KfcError({
    category: "internal",
    code: "INTERNAL_ERROR",
    message: "Unexpected internal error",
    exitCode: 1,
    retryable: false,
    debugDetails: {
      originalType: error instanceof Error ? error.name : typeof error,
    },
    cause: error,
  });
}

export function formatErrorForCli(
  error: unknown,
  options: ErrorPresentationOptions = {},
): ErrorPresentation {
  const normalized = normalizeUnknownError(error);
  const lines = [
    `Error [${normalized.code}]: ${normalized.message}`,
    ...publicIssueLines(normalized),
  ];

  if (options.debug) {
    const debug = {
      category: normalized.category,
      exitCode: normalized.exitCode,
      retryable: normalized.retryable,
      details: sanitizeDebugValue(
        normalized.debugDetails ?? {},
        undefined,
        new WeakSet(),
      ),
    };
    lines.push("Debug:", JSON.stringify(debug, null, 2));
  }

  return {
    exitCode: normalized.exitCode,
    text: `${lines.join("\n")}\n`,
  };
}
