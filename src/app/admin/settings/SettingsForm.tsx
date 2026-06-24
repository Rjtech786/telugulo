"use client";

import { useState, useTransition } from "react";
import {
  PIPELINE_STEPS,
  TEXT_PROVIDERS,
  TEXT_MODELS,
  IMAGE_PROVIDERS,
  FEATURES,
  type TextProvider,
  type ImageProvider,
  type FeatureKey,
  type GeneralSettings,
  type CostSettings,
} from "@/lib/config";
import type { ModelMap } from "@/lib/settings";
import { saveModels, saveFeatures, saveGeneral, saveCost } from "./actions";

type Props = {
  initialModels: ModelMap;
  initialImageProvider: ImageProvider;
  initialFeatures: Record<FeatureKey, boolean>;
  initialGeneral: GeneralSettings;
  initialCost: CostSettings;
};

export function SettingsForm(props: Props) {
  return (
    <div className="space-y-8">
      <ModelsSection
        initialModels={props.initialModels}
        initialImageProvider={props.initialImageProvider}
      />
      <FeaturesSection initialFeatures={props.initialFeatures} />
      <GeneralSection initialGeneral={props.initialGeneral} />
      <CostSection initialCost={props.initialCost} />
    </div>
  );
}

// ─── Shared bits ───
function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mb-4 text-sm text-neutral-500">{desc}</p>
      {children}
    </section>
  );
}

function SaveBar({
  onSave,
  pending,
  status,
}: {
  onSave: () => void;
  pending: boolean;
  status: string | null;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        onClick={onSave}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {status && <span className="text-xs text-green-600 dark:text-green-400">{status}</span>}
    </div>
  );
}

const selectCls =
  "rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

// ─── 1. Per-step models ───
function ModelsSection({
  initialModels,
  initialImageProvider,
}: {
  initialModels: ModelMap;
  initialImageProvider: ImageProvider;
}) {
  const [models, setModels] = useState<ModelMap>(initialModels);
  const [imageProvider, setImageProvider] = useState(initialImageProvider);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function setProvider(step: keyof ModelMap, provider: TextProvider) {
    const firstModel = TEXT_MODELS[provider][0].id;
    setModels((m) => ({ ...m, [step]: { provider, model: firstModel } }));
  }
  function setModel(step: keyof ModelMap, model: string) {
    setModels((m) => ({ ...m, [step]: { ...m[step], model } }));
  }

  return (
    <Section
      title="AI models — per step"
      desc="Each pipeline step has its own model. Cheap (Haiku) for discovery/selection/learning; quality (Opus) only for writing & angle — this roughly halves cost."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr>
              <th className="pb-2 pr-4 font-medium">Step</th>
              <th className="pb-2 pr-4 font-medium">Provider</th>
              <th className="pb-2 font-medium">Model</th>
            </tr>
          </thead>
          <tbody>
            {PIPELINE_STEPS.map((step) => {
              const choice = models[step.key];
              return (
                <tr key={step.key} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{step.label}</div>
                    <div className="text-xs text-neutral-500">{step.hint}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={choice.provider}
                      onChange={(e) => setProvider(step.key, e.target.value as TextProvider)}
                      className={selectCls}
                    >
                      {TEXT_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <select
                      value={choice.model}
                      onChange={(e) => setModel(step.key, e.target.value)}
                      className={selectCls}
                    >
                      {TEXT_MODELS[choice.provider].map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm font-medium">Image provider</label>
        <select
          value={imageProvider}
          onChange={(e) => setImageProvider(e.target.value as ImageProvider)}
          className={selectCls}
        >
          {IMAGE_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveModels(models, imageProvider);
            setStatus("Saved ✓");
          })
        }
      />
    </Section>
  );
}

// ─── 2. Feature toggles ───
function FeaturesSection({
  initialFeatures,
}: {
  initialFeatures: Record<FeatureKey, boolean>;
}) {
  const [features, setFeatures] = useState(initialFeatures);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Section
      title="Feature toggles"
      desc="OFF features are completely dormant — no API calls, zero cost. Start with core only; enable more as traffic/data builds."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <label
            key={f.key}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
          >
            <span>
              <span className="text-sm font-medium">{f.label}</span>
              <span className="block text-xs text-neutral-500">{f.hint}</span>
            </span>
            <input
              type="checkbox"
              checked={features[f.key]}
              onChange={(e) =>
                setFeatures((s) => ({ ...s, [f.key]: e.target.checked }))
              }
              className="h-5 w-5 accent-neutral-900 dark:accent-white"
            />
          </label>
        ))}
      </div>
      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveFeatures(features);
            setStatus("Saved ✓");
          })
        }
      />
    </Section>
  );
}

// ─── 3. General ───
function GeneralSection({ initialGeneral }: { initialGeneral: GeneralSettings }) {
  const [g, setG] = useState(initialGeneral);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Section title="General" desc="Publishing cadence, tone, length and time.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Articles per day</label>
          <select
            value={g.articles_per_day}
            onChange={(e) => setG({ ...g, articles_per_day: Number(e.target.value) === 2 ? 2 : 1 })}
            className={`${selectCls} mt-1 block`}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Tone</label>
          <select
            value={g.tone}
            onChange={(e) => setG({ ...g, tone: e.target.value as GeneralSettings["tone"] })}
            className={`${selectCls} mt-1 block`}
          >
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">
            Article length: {g.article_length} words
          </label>
          <input
            type="range"
            min={400}
            max={1500}
            step={50}
            value={g.article_length}
            onChange={(e) => setG({ ...g, article_length: Number(e.target.value) })}
            className="mt-2 block w-full accent-neutral-900 dark:accent-white"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Publish time (IST)</label>
          <input
            type="time"
            value={g.publish_time}
            onChange={(e) => setG({ ...g, publish_time: e.target.value })}
            className={`${selectCls} mt-1 block`}
          />
        </div>
      </div>
      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveGeneral(g);
            setStatus("Saved ✓");
          })
        }
      />
    </Section>
  );
}

// ─── 4. Cost control ───
function CostSection({ initialCost }: { initialCost: CostSettings }) {
  const [c, setC] = useState(initialCost);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Section
      title="Cost control"
      desc="Monthly budget alert, learning examples limit, and how often performance analysis runs."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Monthly budget (₹)</label>
          <input
            type="number"
            min={0}
            value={c.monthly_budget}
            onChange={(e) => setC({ ...c, monthly_budget: Number(e.target.value) })}
            className={`${selectCls} mt-1 block w-full`}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Learning examples limit</label>
          <input
            type="number"
            min={0}
            max={10}
            value={c.learning_examples_limit}
            onChange={(e) =>
              setC({ ...c, learning_examples_limit: Number(e.target.value) })
            }
            className={`${selectCls} mt-1 block w-full`}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Performance analysis</label>
          <select
            value={c.performance_frequency}
            onChange={(e) =>
              setC({ ...c, performance_frequency: e.target.value as CostSettings["performance_frequency"] })
            }
            className={`${selectCls} mt-1 block w-full`}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveCost(c);
            setStatus("Saved ✓");
          })
        }
      />
    </Section>
  );
}
