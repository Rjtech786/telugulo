import { NextResponse, type NextRequest } from "next/server";
import { runPipeline } from "@/lib/agent/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily generation trigger. The EC2 cron hits this with
 *   Authorization: Bearer $CRON_SECRET
 * Runs the 7-step agent and saves drafts (never auto-publishes).
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const qSecret = url.searchParams.get("secret");

  if (!secret || (auth !== `Bearer ${secret}` && qSecret !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPipeline();
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
