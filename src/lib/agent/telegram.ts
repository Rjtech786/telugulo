import "server-only";
import { getDecryptedKey } from "@/lib/api-keys";

/**
 * Telegram draft-approval flow (spec §11). The bot is locked to the owner's
 * chat id; it only ever messages that chat and only acts on callbacks from it.
 */

async function api(method: string, token: string, payload: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function creds() {
  const [token, chatId] = await Promise.all([
    getDecryptedKey("telegram_token"),
    getDecryptedKey("telegram_chat"),
  ]);
  if (!token || !chatId) throw new Error("Telegram token/chat not configured");
  return { token, chatId };
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Send the owner a draft with Publish / Edit / Skip buttons. */
export async function notifyDraft(draft: {
  id: string;
  title: string;
  summary: string;
}) {
  const { token, chatId } = await creds();
  await api("sendMessage", token, {
    chat_id: chatId,
    text: `🆕 *కొత్త draft ready*\n\n*${escapeMd(draft.title)}*\n\n${escapeMd(draft.summary)}`,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Publish", callback_data: `pub:${draft.id}` },
          { text: "⛔ Skip", callback_data: `skip:${draft.id}` },
        ],
        [{ text: "✏️ Edit", url: `${site()}/admin/articles/${draft.id}` }],
      ],
    },
  });
}

/** True if an incoming update came from the configured owner chat. */
export async function isOwnerChat(chatId: number | string): Promise<boolean> {
  const stored = await getDecryptedKey("telegram_chat");
  return stored != null && String(stored) === String(chatId);
}

export async function answerCallback(token: string, callbackId: string, text: string) {
  await api("answerCallbackQuery", token, { callback_query_id: callbackId, text });
}

export async function editMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
) {
  await api("editMessageText", token, {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  });
}

export async function getToken() {
  const token = await getDecryptedKey("telegram_token");
  if (!token) throw new Error("Telegram token not configured");
  return token;
}

function escapeMd(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}
