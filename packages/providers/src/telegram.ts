import { htmlEscape } from "@radar/core";
import { ProviderError } from "./errors";

export function formatAlertHtml(input: { title: string; body: string; link?: string | null }): string {
  const lines = input.body.split("\n").map((line) => htmlEscape(line));
  const link = input.link ? `\n<a href="${htmlEscape(input.link)}">Open candidate</a>` : "";
  return `<b>${htmlEscape(input.title)}</b>\n${lines.join("\n")}${link}`;
}

export async function telegramCall(token: string, method: string, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  if (!token) throw new ProviderError("Telegram bot token is not configured.", "unconfigured", false);
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string; result?: unknown } | null;
  if (!response.ok || !payload?.ok) {
    throw new ProviderError(payload?.description || `Telegram ${method} failed.`, "http", response.status >= 500, null, response.status);
  }
  return payload.result;
}

export async function sendTelegramMessage(token: string, chatId: string, html: string, fetchImpl?: typeof fetch): Promise<void> {
  await telegramCall(token, "sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }, fetchImpl);
}
