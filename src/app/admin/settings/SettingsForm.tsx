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
import { Card, SaveBar, Toggle, Field, selectCls, inputCls } from "../_ui";
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
    <div className="space-y-6">
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
    <Card
      title="AI models — per step"
      desc="Each pipeline step has its own model. Cheap models for discovery/selection; the quality model only for writing — this roughly halves cost."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-mute">
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
                <tr key={step.key} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <div className="font-medium text-ink">{step.label}</div>
                    <div className="text-xs text-ink-mute">{step.hint}</div>
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
        <label className="text-sm font-medium text-ink">Image provider</label>
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
            setTimeout(() => setStatus(null), 3000);
          })
        }
      />
    </Card>
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
    <Card
      title="Feature toggles"
      desc="OFF features are completely dormant — no API calls, zero cost. Enable more as traffic/data builds."
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Toggle
            key={f.key}
            label={f.label}
            hint={f.hint}
            checked={features[f.key]}
            onChange={(v) => setFeatures((s) => ({ ...s, [f.key]: v }))}
          />
        ))}
      </div>
      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveFeatures(features);
            setStatus("Saved ✓");
            setTimeout(() => setStatus(null), 3000);
          })
        }
      />
    </Card>
  );
}

// ─── 3. General ───
function GeneralSection({ initialGeneral }: { initialGeneral: GeneralSettings }) {
  const [g, setG] = useState(initialGeneral);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Card title="General" desc="Publishing cadence, tone, length and run time.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Articles per day">
          <select
            value={g.articles_per_day}
            onChange={(e) => setG({ ...g, articles_per_day: Number(e.target.value) === 2 ? 2 : 1 })}
            className={`${selectCls} block w-full`}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>
        <Field label="Tone">
          <select
            value={g.tone}
            onChange={(e) => setG({ ...g, tone: e.target.value as GeneralSettings["tone"] })}
            className={`${selectCls} block w-full`}
          >
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
          </select>
        </Field>
        <Field label={`Article length: ${g.article_length} words`}>
          <input
            type="range"
            min={400}
            max={1500}
            step={50}
            value={g.article_length}
            onChange={(e) => setG({ ...g, article_length: Number(e.target.value) })}
            className="mt-2 block w-full accent-[var(--color-accent)]"
          />
        </Field>
        <Field label="Daily run time (IST)">
          <input
            type="time"
            value={g.publish_time}
            onChange={(e) => setG({ ...g, publish_time: e.target.value })}
            className={`${inputCls}`}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Toggle
          label="Auto-publish"
          hint="ON = articles go live automatically (no review). OFF = saved as drafts for approval."
          checked={g.auto_publish}
          onChange={(v) => setG({ ...g, auto_publish: v })}
        />
      </div>

      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveGeneral(g);
            setStatus("Saved ✓");
            setTimeout(() => setStatus(null), 3000);
          })
        }
      />
    </Card>
  );
}

// ─── 4. Cost control ───
function CostSection({ initialCost }: { initialCost: CostSettings }) {
  const [c, setC] = useState(initialCost);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Card
      title="Cost control"
      desc="Monthly budget alert, learning examples limit, and how often performance analysis runs."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Monthly budget (₹)">
          <input
            type="number"
            min={0}
            value={c.monthly_budget}
            onChange={(e) => setC({ ...c, monthly_budget: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Learning examples limit">
          <input
            type="number"
            min={0}
            max={10}
            value={c.learning_examples_limit}
            onChange={(e) => setC({ ...c, learning_examples_limit: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Performance analysis">
          <select
            value={c.performance_frequency}
            onChange={(e) =>
              setC({ ...c, performance_frequency: e.target.value as CostSettings["performance_frequency"] })
            }
            className={`${selectCls} block w-full`}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
      </div>
      <SaveBar
        pending={pending}
        status={status}
        onSave={() =>
          start(async () => {
            await saveCost(c);
            setStatus("Saved ✓");
            setTimeout(() => setStatus(null), 3000);
          })
        }
      />
    </Card>
  );
}
