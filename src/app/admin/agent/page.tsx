import { getGeneral } from "@/lib/settings";
import { AgentClient } from "./AgentClient";
import { CeoSystem } from "./CeoSystem";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const general = await getGeneral();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">AI Agent</h1>
        <p className="text-sm text-ink-soft">
          CEO agent + specialist team har din 8 AM ko khud article banate hain — neeche
          live dekho. Apne topic se manual draft bhi bana sakte ho.
        </p>
      </div>
      <CeoSystem />
      <AgentClient defaultLength={general.article_length} />
    </div>
  );
}
