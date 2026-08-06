import { z } from "zod";

export const DEFAULT_ROUTERAI_BASE_URL = "https://routerai.ru/api/v1";
export const DEFAULT_ROUTERAI_MODEL = "google/gemini-2.5-flash-lite";
export const DEFAULT_ROUTERAI_TIMEOUT_MS = 300_000;

const MAX_ROUTERAI_TIMEOUT_MS = 600_000;
const MAX_ROUTERAI_COMPLETION_TOKENS = 16_384;
const MAX_ROUTERAI_MESSAGES = 32;
const MAX_ROUTERAI_MESSAGE_CHARACTERS = 131_072;

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:/-]+$/);

const messageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1),
  })
  .strict();

const completionInputSchema = z
  .object({
    messages: z
      .array(messageSchema)
      .min(1)
      .max(MAX_ROUTERAI_MESSAGES)
      .refine(
        (messages) =>
          messages.reduce(
            (total, message) => total + message.content.length,
            0,
          ) <= MAX_ROUTERAI_MESSAGE_CHARACTERS,
      ),
    maxTokens: z
      .number()
      .int()
      .positive()
      .max(MAX_ROUTERAI_COMPLETION_TOKENS)
      .optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();

const jsonSchemaDefinitionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/),
    description: z.string().trim().min(1).max(1_024).optional(),
    schema: z.record(z.string(), z.unknown()),
    strict: z.boolean().optional(),
  })
  .strict();

const usageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    id: identifierSchema,
    model: identifierSchema,
    provider: z.string().trim().min(1).max(128).nullable().optional(),
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                role: z.literal("assistant").optional(),
                content: z.string().nullable(),
              })
              .passthrough(),
            finish_reason: z.string().max(64).nullable().optional(),
          })
          .passthrough(),
      )
      .min(1),
    usage: usageSchema.nullable().optional(),
  })
  .passthrough();

export type RouterAiEnvironment = Readonly<Record<string, string | undefined>>;

export type RouterAiMessage = z.infer<typeof messageSchema>;

export type RouterAiJsonSchemaDefinition = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type RouterAiErrorCode =
  | "configuration"
  | "invalid_request"
  | "timeout"
  | "aborted"
  | "network"
  | "http"
  | "invalid_response"
  | "invalid_output";

export class RouterAiError extends Error {
  readonly code: RouterAiErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(
    code: RouterAiErrorCode,
    message: string,
    details: {
      status?: number;
      requestId?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "RouterAiError";
    this.code = code;
    this.status = details.status;
    this.requestId = details.requestId;
    this.retryable = details.retryable ?? false;
  }
}

export type RouterAiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
};

type RouterAiCompletionMetadata = {
  model: string;
  provider: string | null;
  requestId: string;
  finishReason: string | null;
  usage: RouterAiTokenUsage;
};

export type RouterAiTextCompletion = RouterAiCompletionMetadata & {
  text: string;
};

export type RouterAiJsonCompletion<T> = RouterAiCompletionMetadata & {
  value: T;
};

export type RouterAiCompletionInput = {
  messages: readonly RouterAiMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type RouterAiJsonCompletionInput<T> = RouterAiCompletionInput & {
  jsonSchema: RouterAiJsonSchemaDefinition;
  outputSchema: z.ZodType<T>;
};

export type RouterAiClientOptions = {
  env?: RouterAiEnvironment;
  fetch?: typeof globalThis.fetch;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export interface RouterAiClient {
  completeText(input: RouterAiCompletionInput): Promise<RouterAiTextCompletion>;
  completeJson<T>(
    input: RouterAiJsonCompletionInput<T>,
  ): Promise<RouterAiJsonCompletion<T>>;
}

type RouterAiConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
};

type ParsedCompletion = RouterAiCompletionMetadata & {
  text: string;
};

function configurationError() {
  return new RouterAiError(
    "configuration",
    "Провайдер ИИ не настроен или настроен неверно.",
  );
}

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new RouterAiError(
      "configuration",
      "RouterAI доступен только в серверном окружении.",
    );
  }
}

function optionalEnvironmentValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseBaseUrl(value: string, allowInsecureHttp: boolean) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (url.protocol === "http:" && !allowInsecureHttp) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw configurationError();
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${pathname}`;
  } catch (error) {
    if (error instanceof RouterAiError) throw error;
    throw configurationError();
  }
}

function parseTimeout(value: number | string) {
  const timeout = typeof value === "number" ? value : Number(value);
  if (
    !Number.isInteger(timeout) ||
    timeout <= 0 ||
    timeout > MAX_ROUTERAI_TIMEOUT_MS
  ) {
    throw configurationError();
  }
  return timeout;
}

function resolveConfig(options: RouterAiClientOptions): RouterAiConfig {
  const env = options.env ?? process.env;
  const nodeEnvironment =
    optionalEnvironmentValue(env.NODE_ENV) ?? process.env.NODE_ENV;
  const apiKey = optionalEnvironmentValue(env.ROUTERAI_API_KEY);
  if (!apiKey) throw configurationError();

  const model =
    optionalEnvironmentValue(options.model) ??
    optionalEnvironmentValue(env.ROUTERAI_MODEL) ??
    DEFAULT_ROUTERAI_MODEL;
  if (!identifierSchema.safeParse(model).success) throw configurationError();

  const baseUrl = parseBaseUrl(
    optionalEnvironmentValue(options.baseUrl) ??
      optionalEnvironmentValue(env.ROUTERAI_BASE_URL) ??
      DEFAULT_ROUTERAI_BASE_URL,
    nodeEnvironment !== "production" ||
      (options.env !== undefined && options.fetch !== undefined),
  );
  const timeoutMs = parseTimeout(
    options.timeoutMs ??
      optionalEnvironmentValue(env.ROUTERAI_TIMEOUT_MS) ??
      DEFAULT_ROUTERAI_TIMEOUT_MS,
  );

  return { apiKey, model, baseUrl, timeoutMs };
}

function safeRequestId(value: string | null | undefined) {
  const result = identifierSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function responseRequestId(response: Response) {
  return (
    safeRequestId(response.headers.get("x-request-id")) ??
    safeRequestId(response.headers.get("x-routerai-request-id"))
  );
}

function normalizedUsage(
  usage: z.infer<typeof usageSchema> | null | undefined,
): RouterAiTokenUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}

function invalidRequestError() {
  return new RouterAiError(
    "invalid_request",
    "Некорректные параметры запроса к ИИ.",
  );
}

class RouterAiClientImplementation implements RouterAiClient {
  constructor(
    private readonly config: RouterAiConfig,
    private readonly fetchImplementation: typeof globalThis.fetch,
  ) {}

  async completeText(
    input: RouterAiCompletionInput,
  ): Promise<RouterAiTextCompletion> {
    return this.request(input);
  }

  async completeJson<T>(
    input: RouterAiJsonCompletionInput<T>,
  ): Promise<RouterAiJsonCompletion<T>> {
    const jsonSchema = jsonSchemaDefinitionSchema.safeParse(input.jsonSchema);
    if (
      !jsonSchema.success ||
      !input.outputSchema ||
      typeof input.outputSchema.safeParse !== "function"
    ) {
      throw invalidRequestError();
    }

    const completion = await this.request(input, {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.data.name,
        ...(jsonSchema.data.description
          ? { description: jsonSchema.data.description }
          : {}),
        strict: jsonSchema.data.strict ?? true,
        schema: jsonSchema.data.schema,
      },
    });

    let value: unknown;
    try {
      value = JSON.parse(completion.text);
    } catch {
      throw new RouterAiError(
        "invalid_output",
        "ИИ вернул ответ, который не соответствует ожидаемой структуре.",
        { requestId: completion.requestId },
      );
    }

    const parsed = (() => {
      try {
        return input.outputSchema.safeParse(value);
      } catch {
        return null;
      }
    })();
    if (!parsed?.success) {
      throw new RouterAiError(
        "invalid_output",
        "ИИ вернул ответ, который не соответствует ожидаемой структуре.",
        { requestId: completion.requestId },
      );
    }

    const { text: _text, ...metadata } = completion;
    return { ...metadata, value: parsed.data };
  }

  private async request(
    input: RouterAiCompletionInput,
    responseFormat?: Record<string, unknown>,
  ): Promise<ParsedCompletion> {
    const parsedInput = completionInputSchema.safeParse({
      messages: input.messages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });
    if (!parsedInput.success) throw invalidRequestError();

    if (input.signal?.aborted) {
      throw new RouterAiError("aborted", "Запрос к ИИ был отменён.");
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    input.signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await this.fetchImplementation(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: parsedInput.data.messages,
            max_tokens:
              parsedInput.data.maxTokens ?? MAX_ROUTERAI_COMPLETION_TOKENS,
            ...(parsedInput.data.temperature === undefined
              ? {}
              : { temperature: parsedInput.data.temperature }),
            ...(responseFormat ? { response_format: responseFormat } : {}),
            ...(responseFormat ? { structured_outputs: true } : {}),
          }),
          cache: "no-store",
          signal: controller.signal,
        },
      );
      const headerRequestId = responseRequestId(response);

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new RouterAiError(
          "http",
          "Провайдер ИИ временно не смог выполнить запрос.",
          {
            status: response.status,
            requestId: headerRequestId,
            retryable:
              response.status === 408 ||
              response.status === 429 ||
              response.status >= 500,
          },
        );
      }

      let rawPayload: unknown;
      try {
        rawPayload = await response.json();
      } catch (error) {
        if (timedOut || input.signal?.aborted) throw error;
        throw new RouterAiError(
          "invalid_response",
          "Провайдер ИИ вернул некорректный ответ.",
          { requestId: headerRequestId },
        );
      }

      const payload = responseSchema.safeParse(rawPayload);
      if (!payload.success) {
        throw new RouterAiError(
          "invalid_response",
          "Провайдер ИИ вернул некорректный ответ.",
          { requestId: headerRequestId },
        );
      }

      const choice = payload.data.choices[0];
      const requestId = headerRequestId ?? payload.data.id;
      if (choice.finish_reason === "length") {
        throw new RouterAiError(
          "invalid_output",
          "ИИ не успел сформировать полный ответ.",
          { requestId },
        );
      }
      if (!choice.message.content) {
        throw new RouterAiError(
          "invalid_output",
          "ИИ не вернул текстовый ответ.",
          { requestId },
        );
      }
      return {
        text: choice.message.content,
        model: payload.data.model,
        provider: payload.data.provider ?? null,
        requestId,
        finishReason: choice.finish_reason ?? null,
        usage: normalizedUsage(payload.data.usage),
      };
    } catch (error) {
      if (error instanceof RouterAiError) throw error;
      if (timedOut) {
        throw new RouterAiError("timeout", "Провайдер ИИ не ответил вовремя.", {
          retryable: true,
        });
      }
      if (input.signal?.aborted) {
        throw new RouterAiError("aborted", "Запрос к ИИ был отменён.");
      }
      throw new RouterAiError(
        "network",
        "Не удалось связаться с провайдером ИИ.",
        { retryable: true },
      );
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

export function createRouterAiClient(
  options: RouterAiClientOptions = {},
): RouterAiClient {
  assertServerRuntime();
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") throw configurationError();
  return new RouterAiClientImplementation(
    resolveConfig(options),
    fetchImplementation,
  );
}
