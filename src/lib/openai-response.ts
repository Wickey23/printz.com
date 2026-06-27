type OpenAiResponseBody = {
  model: string;
  fallbackModel?: string;
  input: unknown;
  max_output_tokens: number;
  tools?: Array<Record<string, unknown>>;
};

type OpenAiFailure = {
  status: number;
  message: string;
  retryableWithBackup: boolean;
};

export function getOpenAiApiKeys() {
  return [process.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY_BACKUP]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

export function openAiKeyMissingMessage() {
  return "OPENAI_API_KEY is not configured.";
}

export async function createOpenAiResponse(body: OpenAiResponseBody) {
  const keys = getOpenAiApiKeys();
  if (!keys.length) throw new Error(openAiKeyMissingMessage());

  let lastError: unknown;
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    try {
      return await createOpenAiResponseWithKey(keys[keyIndex], body);
    } catch (error) {
      lastError = error;
      if (!(error instanceof OpenAiRequestError) || !error.retryableWithBackup || keyIndex === keys.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI request failed.");
}

async function createOpenAiResponseWithKey(openAiKey: string, body: OpenAiResponseBody) {
  const tryRequest = async (model: string) => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: body.input,
        tools: body.tools,
        max_output_tokens: body.max_output_tokens,
      }),
    });

    if (response.ok) return response.json();

    const failure = await parseOpenAiFailure(response);
    throw new OpenAiRequestError(`OpenAI request failed for ${model}: ${failure.message.slice(0, 260)}`, failure);
  };

  try {
    return await tryRequest(body.model);
  } catch (error) {
    if (!body.fallbackModel || body.fallbackModel === body.model) throw error;
    return tryRequest(body.fallbackModel);
  }
}

async function parseOpenAiFailure(response: Response): Promise<OpenAiFailure> {
  const text = await response.text();
  let message = text || "OpenAI request failed.";
  let code = "";
  let type = "";

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string; type?: string } };
    message = parsed.error?.message || message;
    code = parsed.error?.code || "";
    type = parsed.error?.type || "";
  } catch {}

  const combined = `${code} ${type} ${message}`.toLowerCase();
  const retryableWithBackup =
    response.status === 429 ||
    combined.includes("insufficient_quota") ||
    combined.includes("quota") ||
    combined.includes("rate_limit") ||
    combined.includes("rate limit") ||
    combined.includes("billing") ||
    combined.includes("credits");

  return { status: response.status, message, retryableWithBackup };
}

class OpenAiRequestError extends Error {
  status: number;
  retryableWithBackup: boolean;

  constructor(message: string, failure: OpenAiFailure) {
    super(message);
    this.name = "OpenAiRequestError";
    this.status = failure.status;
    this.retryableWithBackup = failure.retryableWithBackup;
  }
}
