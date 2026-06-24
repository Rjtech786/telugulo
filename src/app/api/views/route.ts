import { NextResponse, type NextRequest } from "next/server";
import { incrementViews } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (typeof id === "string") await incrementViews(id);
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true });
}
