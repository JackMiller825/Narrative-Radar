import { ProviderError } from "./errors";

export async function completeJson(opts: {
  apiKey?: string;
  model?: string;
  system: string;
  user: string;
  fetchImpl?: typeof fetch;
}): Promise<unknown> {
  if (!opts.apiKey || !opts.model) {
    throw new ProviderError("Text generation is not configured. Set OPENAI_API_KEY and OPENAI_TEXT_MODEL.", "unconfigured", false);
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!response.ok) throw new ProviderError(`Text model returned ${response.status}.`, response.status === 429 ? "rate_limited" : "http", response.status === 429 || response.status >= 500, null, response.status);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("Text model returned no content.", "malformed", false);
  try {
    return JSON.parse(content);
  } catch {
    throw new ProviderError("Text model returned invalid JSON.", "malformed", true);
  }
}

export async function generateImage(opts: {
  apiKey?: string;
  model?: string;
  size?: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): Promise<{ b64: string }> {
  if (!opts.apiKey || !opts.model || !opts.size) {
    throw new ProviderError("Image generation is not configured. Set OPENAI_API_KEY, OPENAI_IMAGE_MODEL, and OPENAI_IMAGE_SIZE to values your account documents.", "unconfigured", false);
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: opts.model, prompt: opts.prompt, size: opts.size, n: 1 }),
  });
  if (response.status === 400) throw new ProviderError("The image provider rejected the prompt or size.", "http", false, null, 400);
  if (!response.ok) throw new ProviderError(`Image model returned ${response.status}.`, response.status === 429 ? "rate_limited" : "http", response.status >= 500 || response.status === 429, null, response.status);
  const body = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError("Image model did not return base64 image data. URL-only responses are not stored.", "malformed", false);
  return { b64 };
}
