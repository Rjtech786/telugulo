import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Throws if the current request is not an authenticated admin. Call at the top
 * of every Server Action / privileged route — the proxy guards navigation, but
 * Server Actions can be invoked directly, so never rely on it alone.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
