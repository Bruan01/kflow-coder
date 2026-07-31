import { ProviderError } from "../../errors/provider-error.js";
import { providerErrorResponseSchema } from "./chat-completions-schema.js";

const MAX_ERROR_BODY_BYTES = 16 * 1024;

const QUOTA_CODES = new Set([
  "billing_hard_limit_reached",
  "insufficient_balance",
  "insufficient_quota",
  "quota_exceeded",
]);

const CONTEXT_LIMIT_CODES = new Set([
  "context_length_exceeded",
  "context_limit_exceeded",
  "max_context_length_exceeded",
]);

const RATE_LIMIT_CODES = new Set(["rate_limit_error", "rate_limit_exceeded"]);

const SERVER_ERROR_CODES = new Set(["internal_server_error", "server_error"]);

async function readMachineErrorCode(
  body: ReadableStream<Uint8Array> | null,
): Promise<string | undefined> {
  if (body === null) return undefined;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;
  let complete = false;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        complete = true;
        text += decoder.decode();
        break;
      }

      bytesRead += result.value.byteLength;
      if (bytesRead > MAX_ERROR_BODY_BYTES) return undefined;
      text += decoder.decode(result.value, { stream: true });
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }

  const parsed = providerErrorResponseSchema.safeParse(value);
  if (!parsed.success || typeof parsed.data.error.code !== "string") {
    return undefined;
  }
  return parsed.data.error.code;
}

function providerError(
  code: ConstructorParameters<typeof ProviderError>[0],
  message: string,
  status: number,
  machineCode: string | undefined,
): ProviderError {
  return new ProviderError(code, message, {
    details: { status },
    debugDetails: {
      status,
      ...(machineCode === undefined ? {} : { providerCode: machineCode }),
    },
  });
}

export async function mapHttpError(response: Response): Promise<ProviderError> {
  const machineCode = await readMachineErrorCode(response.body);
  const { status } = response;

  if (machineCode !== undefined && QUOTA_CODES.has(machineCode)) {
    return providerError(
      "PROVIDER_QUOTA_EXCEEDED",
      "Provider quota is exhausted",
      status,
      machineCode,
    );
  }
  if (machineCode !== undefined && CONTEXT_LIMIT_CODES.has(machineCode)) {
    return providerError(
      "PROVIDER_CONTEXT_LIMIT",
      "Provider context limit exceeded",
      status,
      machineCode,
    );
  }
  if (status === 401 || status === 403) {
    return providerError(
      "PROVIDER_AUTHENTICATION_FAILED",
      "Provider authentication failed",
      status,
      machineCode,
    );
  }
  if (status === 402) {
    return providerError(
      "PROVIDER_QUOTA_EXCEEDED",
      "Provider quota is exhausted",
      status,
      machineCode,
    );
  }
  if (status === 408 || status === 504) {
    return providerError(
      "PROVIDER_TIMEOUT",
      "Provider request timed out",
      status,
      machineCode,
    );
  }
  if (status === 429) {
    return providerError(
      "PROVIDER_RATE_LIMITED",
      "Provider rate limit exceeded",
      status,
      machineCode,
    );
  }
  if (status === 500 || status === 502 || status === 503) {
    return providerError(
      "PROVIDER_SERVICE_UNAVAILABLE",
      "Provider is temporarily unavailable",
      status,
      machineCode,
    );
  }
  return providerError(
    "PROVIDER_INVALID_RESPONSE",
    "Provider rejected the request",
    status,
    machineCode,
  );
}

export function mapStreamError(machineCode: string): ProviderError {
  const debugDetails = { providerCode: machineCode };
  if (QUOTA_CODES.has(machineCode)) {
    return new ProviderError(
      "PROVIDER_QUOTA_EXCEEDED",
      "Provider quota is exhausted",
      { debugDetails },
    );
  }
  if (CONTEXT_LIMIT_CODES.has(machineCode)) {
    return new ProviderError(
      "PROVIDER_CONTEXT_LIMIT",
      "Provider context limit exceeded",
      { debugDetails },
    );
  }
  if (RATE_LIMIT_CODES.has(machineCode)) {
    return new ProviderError(
      "PROVIDER_RATE_LIMITED",
      "Provider rate limit exceeded",
      { debugDetails },
    );
  }
  if (SERVER_ERROR_CODES.has(machineCode)) {
    return new ProviderError(
      "PROVIDER_SERVICE_UNAVAILABLE",
      "Provider is temporarily unavailable",
      { debugDetails },
    );
  }
  return new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Provider reported an unsupported error",
    { debugDetails },
  );
}
