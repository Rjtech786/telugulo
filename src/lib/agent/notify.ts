import "server-only";
import { notifyDraft } from "./telegram";

/**
 * V3 failure notifications (spec §9): WhatsApp Cloud API message to the admin
 * on draft_failed / skipped_*. Envs: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_ADMIN_NUMBER. Falls back to the Telegram draft notifier if
 * WhatsApp isn't configured. Always best-effort — never breaks the pipeline.
 */
export async function notifyPipelineFailure(input: {
  title: string;
  status: string;
  issues: { severity?: string; problem?: string }[];
  articleId?: string;
}): Promise<void> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://telugulo.in";
  const top = input.issues
    .slice(0, 3)
    .map((i, n) => `${n + 1}. ${i.severity ? `[${i.severity}] ` : ""}${i.problem ?? ""}`)
    .join("\n");
  const text = `⚠️ Article publish nahi hua (${input.status})\n\n"${input.title}"\n\n${top || "Details admin panel me."}\n\n${site}/admin/agent`;

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_ADMIN_NUMBER;

  if (token && phoneId && to) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text.slice(0, 4000) },
        }),
      });
      if (res.ok) return;
      console.error("WhatsApp notify failed:", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("WhatsApp notify error:", e instanceof Error ? e.message : e);
    }
  }

  // Fallback: Telegram (only if the owner configured it).
  if (input.articleId) {
    try {
      await notifyDraft({ id: input.articleId, title: `⚠️ FAILED: ${input.title}`, summary: top || input.status });
    } catch {
      // neither channel configured — silent
    }
  }
}
