import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Audit-log an important MCP action so changes can be reviewed/reverted. */
export async function logMcpAction(
  action: string,
  params: unknown,
  result: string,
) {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("mcp_action_log")
      .insert({ action, params: params ?? {}, result: result.slice(0, 2000) });
  } catch {
    // best-effort; never block the action on logging
  }
}
