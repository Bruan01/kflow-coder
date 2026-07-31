import { KfcError } from "../../errors/kfc-error.js";
import { ProviderError } from "../../errors/provider-error.js";
import { UserInterruptedError } from "../../errors/user-interrupted-error.js";

export interface ProviderRequestLifecycle {
  readonly signal: AbortSignal;
  normalizeError(error: unknown): KfcError;
  dispose(): void;
}

export function createProviderRequestLifecycle(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): ProviderRequestLifecycle {
  if (callerSignal?.aborted === true) throw new UserInterruptedError();

  const controller = new AbortController();
  let interrupted = false;
  let timedOut = false;
  const handleCallerAbort = (): void => {
    interrupted = true;
    controller.abort();
  };
  callerSignal?.addEventListener("abort", handleCallerAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    normalizeError(error: unknown): KfcError {
      if (interrupted) return new UserInterruptedError();
      if (timedOut) {
        return new ProviderError(
          "PROVIDER_TIMEOUT",
          "Provider request timed out",
        );
      }
      if (error instanceof KfcError) return error;
      return new ProviderError(
        "PROVIDER_SERVICE_UNAVAILABLE",
        "Provider is temporarily unavailable",
        {
          debugDetails: {
            originalType: error instanceof Error ? error.name : typeof error,
          },
          cause: error,
        },
      );
    },
    dispose(): void {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", handleCallerAbort);
      controller.abort();
    },
  };
}
