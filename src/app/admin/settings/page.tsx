import {
  getModelMap,
  getImageProvider,
  getFeatures,
  getGeneral,
  getCost,
} from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let content;
  try {
    const [models, imageProvider, features, general, cost] = await Promise.all([
      getModelMap(),
      getImageProvider(),
      getFeatures(),
      getGeneral(),
      getCost(),
    ]);
    content = (
      <SettingsForm
        initialModels={models}
        initialImageProvider={imageProvider}
        initialFeatures={features}
        initialGeneral={general}
        initialCost={cost}
      />
    );
  } catch (e) {
    content = (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
        {e instanceof Error ? e.message : "Failed to load settings"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Settings</h1>
        <p className="text-sm text-neutral-500">
          Control the agent: per-step models, feature toggles, publishing &amp;
          cost. Defaults match the spec — tweak and Save each section.
        </p>
      </div>
      {content}
    </div>
  );
}
