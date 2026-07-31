import { ProviderError } from "../errors/provider-error.js";
import { UserInterruptedError } from "../errors/user-interrupted-error.js";
import type {
  ModelFinishReason,
  ModelProvider,
  ModelStreamOptions,
  ModelTokenUsage,
} from "../provider/model-provider.js";

export interface AskReport {
  readonly timeToFirstTokenMs: number | null;
  readonly totalDurationMs: number;
  readonly usage?: ModelTokenUsage;
  readonly finishReason: ModelFinishReason;
  readonly endedWithNewline: boolean;
}

export interface AskDependencies {
  readonly provider: ModelProvider;
  readonly onText: (delta: string) => void;
  readonly now?: () => number;
}

function invalidResponse(): ProviderError {
  return new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Provider returned an invalid event stream",
  );
}

function isValidUsage(usage: ModelTokenUsage): boolean {
  return (
    Number.isInteger(usage.inputTokens) &&
    usage.inputTokens >= 0 &&
    Number.isInteger(usage.outputTokens) &&
    usage.outputTokens >= 0 &&
    Number.isInteger(usage.totalTokens) &&
    usage.totalTokens === usage.inputTokens + usage.outputTokens
  );
}

export async function runAsk(
  prompt: string,
  dependencies: AskDependencies,
  options: ModelStreamOptions = {},
): Promise<AskReport> {
  if (options.signal?.aborted === true) throw new UserInterruptedError();

  const now = dependencies.now ?? (() => performance.now());
  const startedAt = now();
  let firstTokenAt: number | undefined;
  let usage: ModelTokenUsage | undefined;
  let finishReason: ModelFinishReason | undefined;
  let finishedAt: number | undefined;
  let endedWithNewline = false;
  let started = false;
  let usageSeen = false;
  let finishSeen = false;

  for await (const event of dependencies.provider.stream(
    { messages: [{ role: "user", content: prompt }] },
    options,
  )) {
    if (finishSeen) throw invalidResponse();

    if (event.type === "start") {
      if (started) throw invalidResponse();
      started = true;
      continue;
    }
    if (!started) throw invalidResponse();

    if (event.type === "text-delta") {
      if (event.delta !== "") {
        firstTokenAt ??= now();
        endedWithNewline = event.delta.endsWith("\n");
        dependencies.onText(event.delta);
      }
    } else if (event.type === "usage") {
      if (usageSeen || !isValidUsage(event.usage)) throw invalidResponse();
      usageSeen = true;
      usage = event.usage;
    } else if (event.type === "finish") {
      finishSeen = true;
      finishReason = event.reason;
      finishedAt = now();
    } else {
      throw invalidResponse();
    }
  }

  if (
    !started ||
    !finishSeen ||
    finishReason === undefined ||
    finishedAt === undefined
  ) {
    throw invalidResponse();
  }

  return {
    timeToFirstTokenMs:
      firstTokenAt === undefined ? null : firstTokenAt - startedAt,
    totalDurationMs: finishedAt - startedAt,
    ...(usage === undefined ? {} : { usage }),
    finishReason,
    endedWithNewline,
  };
}
