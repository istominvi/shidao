import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  DEFAULT_ROUTERAI_MODEL,
  DEFAULT_ROUTERAI_TIMEOUT_MS,
  RouterAiError,
  createRouterAiClient,
} from "./routerai";

const TEST_API_KEY = "test-routerai-key";
const TEST_PROMPT = "Составь план урока";

function successfulResponse(
  content: string | null,
  options: {
    id?: string;
    model?: string;
    provider?: string;
    finishReason?: string | null;
    headers?: HeadersInit;
  } = {},
) {
  return new Response(
    JSON.stringify({
      id: options.id ?? "generation-123",
      model: options.model ?? DEFAULT_ROUTERAI_MODEL,
      provider: options.provider ?? "TestProvider",
      choices: [
        {
          message: { role: "assistant", content },
          finish_reason: options.finishReason ?? "stop",
        },
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 20 },
        completion_tokens_details: { reasoning_tokens: 4 },
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    },
  );
}

test("text completion uses the server key and normalized default config", async () => {
  assert.equal(DEFAULT_ROUTERAI_MODEL, "google/gemini-2.5-flash-lite");
  assert.equal(DEFAULT_ROUTERAI_TIMEOUT_MS, 300_000);
  let capturedInput: RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return successfulResponse("Готовый план", {
      headers: { "x-request-id": "request-header-123" },
    });
  }) as typeof fetch;
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: fetchMock,
  });

  const result = await client.completeText({
    messages: [{ role: "user", content: TEST_PROMPT }],
    maxTokens: 800,
    temperature: 0.4,
  });

  assert.equal(capturedInput, "https://routerai.ru/api/v1/chat/completions");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("authorization"), `Bearer ${TEST_API_KEY}`);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(capturedInit?.cache, "no-store");
  assert.ok(capturedInit?.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    model: DEFAULT_ROUTERAI_MODEL,
    messages: [{ role: "user", content: TEST_PROMPT }],
    max_tokens: 800,
    temperature: 0.4,
  });
  assert.deepEqual(result, {
    text: "Готовый план",
    model: DEFAULT_ROUTERAI_MODEL,
    provider: "TestProvider",
    requestId: "request-header-123",
    finishReason: "stop",
    usage: {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cachedInputTokens: 20,
      reasoningTokens: 4,
    },
  });
});

test("model, base URL and timeout are configurable through injected env", async () => {
  let capturedInput: RequestInfo | URL | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  const fetchMock = (async (input, init) => {
    capturedInput = input;
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return successfulResponse("Ответ", {
      model: "test/alternate-model",
    });
  }) as typeof fetch;
  const client = createRouterAiClient({
    env: {
      ROUTERAI_API_KEY: TEST_API_KEY,
      ROUTERAI_MODEL: "test/alternate-model",
      ROUTERAI_BASE_URL: "https://routerai.test/custom/v1/",
      ROUTERAI_TIMEOUT_MS: "2500",
    },
    fetch: fetchMock,
  });

  const result = await client.completeText({
    messages: [{ role: "user", content: TEST_PROMPT }],
  });

  assert.equal(
    capturedInput,
    "https://routerai.test/custom/v1/chat/completions",
  );
  assert.equal(capturedBody?.model, "test/alternate-model");
  assert.equal(capturedBody?.max_tokens, 16_384);
  assert.equal(result.model, "test/alternate-model");
});

test("JSON completion sends json_schema and validates the parsed value", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const fetchMock = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return successfulResponse(
      JSON.stringify({ title: "Дроби", lessonCount: 4 }),
    );
  }) as typeof fetch;
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: fetchMock,
  });
  const outputSchema = z
    .object({
      title: z.string(),
      lessonCount: z.number().int().positive(),
    })
    .strict();
  const jsonSchema = {
    name: "course_plan",
    description: "План курса",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "lessonCount"],
      properties: {
        title: { type: "string" },
        lessonCount: { type: "integer", minimum: 1 },
      },
    },
  };

  const result = await client.completeJson({
    messages: [{ role: "user", content: TEST_PROMPT }],
    jsonSchema,
    outputSchema,
  });

  assert.deepEqual(capturedBody?.response_format, {
    type: "json_schema",
    json_schema: {
      name: "course_plan",
      description: "План курса",
      strict: true,
      schema: jsonSchema.schema,
    },
  });
  assert.equal(capturedBody?.structured_outputs, true);
  assert.deepEqual(result.value, { title: "Дроби", lessonCount: 4 });
  assert.equal(result.requestId, "generation-123");
});

test("JSON completion rejects output that fails runtime validation", async () => {
  const privateProviderValue = "raw-private-provider-value";
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () =>
      successfulResponse(
        JSON.stringify({ title: privateProviderValue, lessonCount: 0 }),
      )) as typeof fetch,
  });

  await assert.rejects(
    client.completeJson({
      messages: [{ role: "user", content: TEST_PROMPT }],
      jsonSchema: {
        name: "course_plan",
        schema: { type: "object" },
      },
      outputSchema: z.object({
        title: z.string(),
        lessonCount: z.number().int().positive(),
      }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_output");
      assert.equal(error.requestId, "generation-123");
      assert.equal(String(error).includes(privateProviderValue), false);
      return true;
    },
  );
});

test("request timeout aborts fetch and returns a typed retryable error", async () => {
  const fetchMock = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    })) as typeof fetch;
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: fetchMock,
    timeoutMs: 5,
  });

  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "timeout");
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test("caller abort is distinct from a provider timeout", async () => {
  const controller = new AbortController();
  const fetchMock = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
      controller.abort();
    })) as typeof fetch;
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: fetchMock,
  });

  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
      signal: controller.signal,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "aborted");
      assert.equal(error.retryable, false);
      return true;
    },
  );
});

test("truncated completion is rejected with its safe request id", async () => {
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () =>
      successfulResponse("Неполный ответ", {
        id: "truncated-generation-123",
        finishReason: "length",
      })) as typeof fetch,
  });

  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_output");
      assert.equal(error.requestId, "truncated-generation-123");
      return true;
    },
  );
});

test("OpenAI-compatible null message content is a typed invalid output", async () => {
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () =>
      successfulResponse(null, {
        id: "refused-generation-123",
      })) as typeof fetch,
  });

  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_output");
      assert.equal(error.requestId, "refused-generation-123");
      return true;
    },
  );
});

test("missing optional provider metadata and usage receive safe defaults", async () => {
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () =>
      new Response(
        JSON.stringify({
          id: "generation-with-minimal-metadata",
          model: DEFAULT_ROUTERAI_MODEL,
          choices: [
            {
              message: { role: "assistant", content: "Ответ" },
              finish_reason: "stop",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )) as typeof fetch,
  });

  const result = await client.completeText({
    messages: [{ role: "user", content: TEST_PROMPT }],
  });

  assert.equal(result.provider, null);
  assert.deepEqual(result.usage, {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  });
});

test("HTTP errors never expose the key, prompt or provider body", async () => {
  const providerBodySecret = "provider-body-secret";
  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () =>
      new Response(
        JSON.stringify({
          error: { message: `${providerBodySecret}: ${TEST_PROMPT}` },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": "safe-request-429",
          },
        },
      )) as typeof fetch,
  });

  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "http");
      assert.equal(error.status, 429);
      assert.equal(error.requestId, "safe-request-429");
      assert.equal(error.retryable, true);
      const serialized = [
        error.message,
        error.stack ?? "",
        JSON.stringify(error),
      ].join("\n");
      assert.equal(serialized.includes(TEST_API_KEY), false);
      assert.equal(serialized.includes(TEST_PROMPT), false);
      assert.equal(serialized.includes(providerBodySecret), false);
      return true;
    },
  );
});

test("network and response validation errors discard unsafe raw details", async () => {
  const networkSecret = "unsafe-network-error";
  const networkClient = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () => {
      throw new Error(`${networkSecret}: ${TEST_PROMPT}`);
    }) as typeof fetch,
  });
  await assert.rejects(
    networkClient.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "network");
      assert.equal(String(error).includes(networkSecret), false);
      assert.equal(String(error).includes(TEST_PROMPT), false);
      return true;
    },
  );

  const responseSecret = "unsafe-response-value";
  const responseClient = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: (async () =>
      new Response(JSON.stringify({ unexpected: responseSecret }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  });
  await assert.rejects(
    responseClient.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_response");
      assert.equal(String(error).includes(responseSecret), false);
      return true;
    },
  );
});

test("missing key and invalid public input fail before fetch", async () => {
  let fetchCalls = 0;
  const fetchMock = (async () => {
    fetchCalls += 1;
    return successfulResponse("unused");
  }) as typeof fetch;

  assert.throws(
    () => createRouterAiClient({ env: {}, fetch: fetchMock }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "configuration");
      return true;
    },
  );
  assert.throws(
    () =>
      createRouterAiClient({
        env: { ROUTERAI_API_KEY: TEST_API_KEY },
        fetch: fetchMock,
        timeoutMs: 600_001,
      }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "configuration");
      return true;
    },
  );

  const client = createRouterAiClient({
    env: { ROUTERAI_API_KEY: TEST_API_KEY },
    fetch: fetchMock,
  });
  await assert.rejects(
    client.completeText({ messages: [] }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: TEST_PROMPT }],
      maxTokens: 16_385,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
  await assert.rejects(
    client.completeText({
      messages: Array.from({ length: 33 }, () => ({
        role: "user" as const,
        content: "x",
      })),
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
  await assert.rejects(
    client.completeText({
      messages: [{ role: "user", content: "x".repeat(131_073) }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
  assert.equal(fetchCalls, 0);
});

test("production custom HTTP base URL requires injected test dependencies", () => {
  assert.throws(
    () =>
      createRouterAiClient({
        env: { NODE_ENV: "production", ROUTERAI_API_KEY: TEST_API_KEY },
        baseUrl: "http://routerai.test/api/v1",
      }),
    (error: unknown) => {
      assert.ok(error instanceof RouterAiError);
      assert.equal(error.code, "configuration");
      return true;
    },
  );

  assert.doesNotThrow(() =>
    createRouterAiClient({
      env: { NODE_ENV: "production", ROUTERAI_API_KEY: TEST_API_KEY },
      fetch: (async () => successfulResponse("unused")) as typeof fetch,
      baseUrl: "http://routerai.test/api/v1",
    }),
  );
});
