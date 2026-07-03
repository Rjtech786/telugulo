import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPipeline } from "@/lib/agent/pipeline";
import { runPerformanceAnalysis } from "@/lib/agent/performance";
import { getGeneral } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Owner-configurable run time: the EC2 cron now hits this every 30 minutes,
 * and we only actually run when IST now is inside [publish_time,
 * publish_time+30min) and no cron run happened yet today (IST). `?force=1`
 * (or the old once-a-day cron) bypasses the schedule check but never the
 * once-per-day guard.
 */
async function cronGate(force: boolean): Promise<{ due: boolean; reason: string }> {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  // Once-per-day guard (always on for cron triggers).
  const startOfTodayIST = new Date(ist);
  startOfTodayIST.setUTCHours(0, 0, 0, 0);
  const sinceISO = new Date(startOfTodayIST.getTime() - IST_OFFSET_MS).toISOString();
  const supabase = createAdminClient();
  const { data: todayRun } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("trigger", "cron")
    .gte("started_at", sinceISO)
    .limit(1)
    .maybeSingle();
  if (todayRun) return { due: false, reason: "Already ran today (cron)" };

  if (force) return { due: true, reason: "forced" };

  const general = await getGeneral();
  const m = /^(\d{1,2}):(\d{2})$/.exec(general.publish_time || "08:00");
  const target = m ? Number(m[1]) * 60 + Number(m[2]) : 8 * 60;
  if (nowMin >= target && nowMin < target + 30) {
    return { due: true, reason: `scheduled (${general.publish_time} IST)` };
  }
  return {
    due: false,
    reason: `Not scheduled time yet (runs at ${general.publish_time} IST; now ${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")} IST)`,
  };
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const qSecret = url.searchParams.get("secret");

  if (!secret || (auth !== `Bearer ${secret}` && qSecret !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = await cronGate(url.searchParams.get("force") === "1");
  if (!gate.due) {
    return NextResponse.json({ status: "skipped", reason: gate.reason });
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
