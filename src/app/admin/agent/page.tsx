import { getGeneral } from "@/lib/settings";
import { AgentClient } from "./AgentClient";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const general = await getGeneral();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">AI Agent</h1>
        <p className="text-sm text-ink-soft">
          Article generate karo — apne topic se ya aaj ke trending se. Drafts ban&apos;te
          hain; Articles me review karke publish karo.
        </p>
      </div>
      <AgentClient defaultLength={general.article_length} />
    </div>
  );
}
