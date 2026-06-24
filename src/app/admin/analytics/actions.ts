"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { generateWeeklyInsights } from "@/lib/insights";

export async function runAnalysis() {
  await requireAdmin();
  const res = await generateWeeklyInsights();
  revalidatePath("/admin/analytics");
  return res;
}
