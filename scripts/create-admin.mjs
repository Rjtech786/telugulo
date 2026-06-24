// Creates (or updates) the admin user for the Telugulo dashboard.
//
// Usage:
//   node scripts/create-admin.mjs <email> <password>
//
// Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // skip email verification — single trusted admin
});

if (error) {
  // If the user already exists, update the password instead.
  if (error.code === "email_exists" || /already/i.test(error.message)) {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === email);
    if (existing) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password },
      );
      if (updErr) {
        console.error("Failed to update password:", updErr.message);
        process.exit(1);
      }
      console.log(`✓ Admin password updated for ${email}`);
      process.exit(0);
    }
  }
  console.error("Failed to create admin:", error.message);
  process.exit(1);
}

console.log(`✓ Admin user created: ${data.user.email}`);
