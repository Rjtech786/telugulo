import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx !== -1) env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: active, error: activeErr } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeErr) {
    console.error("Error fetching active run:", activeErr);
    return;
  }

  if (!active) {
    console.log("No active run found in database.");
    return;
  }

  console.log("Active run:", active);

  const { data: messages, error: msgErr } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('run_id', active.id)
    .order('created_at', { ascending: true });

  if (msgErr) {
    console.error("Error fetching messages:", msgErr);
    return;
  }

  console.log(`Timeline messages for run ${active.id}:`);
  for (const msg of messages) {
    console.log(`[${msg.created_at}] [${msg.agent}] [${msg.direction}] [${msg.status}] ${msg.message}`);
    if (msg.detail) {
      console.log(`  Detail: ${msg.detail.slice(0, 300)}...`);
    }
  }
}

main().catch(console.error);
