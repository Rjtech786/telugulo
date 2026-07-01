import { NextResponse, type NextRequest } from "next/server";
import { runPipeline } from "@/lib/agent/pipeline";
import { runPerformanceAnalysis } from "@/lib/agent/performance";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily generation trigger. The EC2 cron hits this with
 *   Authorization: Bearer $CRON_SECRET
 * Runs the 7-step agent and saves drafts (never auto-publishes).
 *
 * Also piggybacks the Performance agent (Phase B) on this same daily hit —
 * it self-gates on `cost.performance_frequency` (weekly/monthly) and the
 * `performance_analysis` feature flag, so it only does real work on its own
 * cadence without needing a separate EC2 cron entry.
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

  let performance;
  try {
    performance = await runPerformanceAnalysis();
  } catch (e) {
    performance = { status: "error", reason: e instanceof Error ? e.message : "unknown" };
  }

  return NextResponse.json({ ...result, performance });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
