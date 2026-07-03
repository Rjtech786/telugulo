import { NextResponse, type NextRequest } from "next/server";
import { recordGenuineAdView } from "@/lib/ads";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Crawlers/preview fetchers rarely run JS, but skip them if they do.
const BOT_RE =
  /bot|crawl|spider|slurp|bing|google|facebook|embed|preview|fetch|curl|wget|headless|lighthouse|monitor|pingdom|uptime/i;

/**
 * Records a genuine ad impression — a real browser actually rendered the ad.
 * Skips bots/crawlers and the logged-in owner, same as /api/views. This is
 * deliberately NOT called during SSR/SSG (that used to massively overcount
 * views on every build/ISR regeneration).
 */
export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const { id, placement } = await request.json();
    if (typeof id === "string") {
      await recordGenuineAdView(id, typeof placement === "string" ? placement : null);
    }
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true });
}
