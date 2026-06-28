import { NextResponse, type NextRequest } from "next/server";
import { incrementViews } from "@/lib/articles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Crawlers/preview fetchers rarely run JS, but skip them if they do.
const BOT_RE =
  /bot|crawl|spider|slurp|bing|google|facebook|embed|preview|fetch|curl|wget|headless|lighthouse|monitor|pingdom|uptime/i;

/**
 * Records an organic page view. Skips:
 *  - bots/crawlers (by user-agent), and
 *  - the site owner's own views (any logged-in session) — so testing the
 *    site doesn't inflate the dashboard. Only real, logged-out visitors count.
 */
export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, counted: false });
    }

    // If anyone is logged in, it's the owner/admin — don't count it.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const { id } = await request.json();
    if (typeof id === "string") await incrementViews(id);
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true });
}
