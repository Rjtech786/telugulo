import { NextResponse, type NextRequest } from "next/server";
import { recordAdClick, getAdLink } from "@/lib/ads";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Tracks an ad click then redirects to the destination. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.redirect(SITE.url);

  const link = await getAdLink(id);
  try {
    await recordAdClick(id);
  } catch {
    // best-effort
  }
  return NextResponse.redirect(link || SITE.url);
}
