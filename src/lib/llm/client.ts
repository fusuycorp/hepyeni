import type { LlmPrompt } from "./prompt";

export const LLM_API_URL_DEFAULT = "https://api.openai.com/v1";
export const LLM_MODEL_DEFAULT = "gpt-4o-mini";
export const LLM_TIMEOUT_MS = 8000;
export const LLM_MAX_TOKENS = 1500;
export const LLM_TEMPERATURE = 0.2;
export const LLM_RETRY_DELAY_MS = 400;
export const LLM_MAX_ATTEMPTS = 2;

export interface LlmClientConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export function resolveLlmConfig(
  env: Record<string, string | undefined>,
): LlmClientConfig | null {
  const apiKey = env.LLM_API_KEY?.trim();
  if (!apiKey) return null;
  const apiUrl = (env.LLM_API_URL?.trim() || LLM_API_URL_DEFAULT).replace(/\/+$/, "");
  const model = env.LLM_MODEL?.trim() || LLM_MODEL_DEFAULT;
  return { apiUrl, apiKey, model };
}

export function getLlmConfig(): LlmClientConfig | null {
  return resolveLlmConfig(process.env as Record<string, string | undefined>);
}

export function buildChatBody(
  system: string,
  user: string,
  config: LlmClientConfig,
): Record<string, unknown> {
  return {
    model: config.model,
    temperature: LLM_TEMPERATURE,
    max_tokens: LLM_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

export type LlmErrorKind = "http" | "timeout" | "network";

export class LlmClientError extends Error {
  kind: LlmErrorKind;
  status?: number;

  constructor(message: string, kind: LlmErrorKind, status?: number) {
    super(message);
    this.name = "LlmClientError";
    this.kind = kind;
    this.status = status;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchChatJson(
  fetchImpl: typeof fetch,
  config: LlmClientConfig,
  system: string,
  user: string,
): Promise<string | null> {
  const res = await fetchImpl(`${config.apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(buildChatBody(system, user, config)),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new LlmClientError(`LLM API responded with HTTP ${res.status}`, "http", res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new LlmClientError("LLM API returned a malformed response", "network");
  }

  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

/**
 * Talk to any OpenAI-compatible chat completions endpoint (OpenAI, Groq,
 * OpenRouter, Together, local Ollama). One retry on transient failures
 * (429/408/5xx/network/timeout); 400s and malformed payloads fail fast.
 * `fetchImpl` / `retryDelayMs` are injectable for tests only.
 */
function classifyError(err: unknown): { kind: LlmErrorKind; retryable: boolean } {
  if (err instanceof Error && err.name === "AbortError") {
    return { kind: "timeout", retryable: true };
  }
  if (err instanceof LlmClientError) {
    return {
      kind: err.kind,
      retryable: err.kind === "network" || isRetryableStatus(err.status ?? 0),
    };
  }
  return { kind: "network", retryable: true };
}

/**
 * Talk to any OpenAI-compatible chat completions endpoint (OpenAI, Groq,
 * OpenRouter, Together, local Ollama). One retry on transient failures
 * (429/408/5xx/network/timeout); 400s and malformed payloads fail fast.
 * `fetchImpl` / `retryDelayMs` are injectable for tests only.
 */
export async function chatJson(
  config: LlmClientConfig,
  system: string,
  user: string,
  fetchImpl: typeof fetch = fetch,
  retryDelayMs: number = LLM_RETRY_DELAY_MS,
): Promise<string | null> {
  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchChatJson(fetchImpl, config, system, user);
    } catch (err) {
      const { kind, retryable } = classifyError(err);
      const finalError =
        err instanceof LlmClientError
          ? err
          : new LlmClientError("Failed to reach the LLM API", kind);

      if (!retryable || attempt === LLM_MAX_ATTEMPTS) {
        throw finalError;
      }

      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // Unreachable: the failure path always throws.
  throw new LlmClientError("Failed to reach the LLM API", "network");
}