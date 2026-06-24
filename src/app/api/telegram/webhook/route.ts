import { NextResponse, type NextRequest } from "next/server";
import {
  isOwnerChat,
  answerCallback,
  editMessageText,
  getToken,
} from "@/lib/agent/telegram";
import { publishArticle, deleteArticle } from "@/lib/articles";

export const dynamic = "force-dynamic";

/**
 * Telegram webhook for the draft-approval buttons. Locked to the owner's chat:
 * callbacks from any other chat are ignored.
 */
export async function POST(request: NextRequest) {
  let update: {
    callback_query?: {
      id: string;
      data?: string;
      message?: { message_id: number; chat: { id: number } };
    };
  };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const cb = update.callback_query;
  if (!cb?.message || !cb.data) return NextResponse.json({ ok: true });

  const chatId = cb.message.chat.id;
  if (!(await isOwnerChat(chatId))) {
    // Silently ignore strangers.
    return NextResponse.json({ ok: true });
  }

  const token = await getToken();
  const [action, id] = cb.data.split(":");

  try {
    if (action === "pub") {
      await publishArticle(id);
      await answerCallback(token, cb.id, "Published ✓");
      await editMessageText(token, chatId, cb.message.message_id, "✅ *Published* — live now.");
    } else if (action === "skip") {
      await deleteArticle(id);
      await answerCallback(token, cb.id, "Skipped");
      await editMessageText(token, chatId, cb.message.message_id, "⛔ *Skipped* — draft discarded.");
    } else {
      await answerCallback(token, cb.id, "Unknown action");
    }
  } catch (e) {
    try {
      await answerCallback(token, cb.id, "Error: " + (e instanceof Error ? e.message : "failed"));
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
