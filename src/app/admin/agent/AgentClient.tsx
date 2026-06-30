"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/site";
import type { PipelineResult } from "@/lib/agent/pipeline";
import { Card, Field, Toggle, inputCls, selectCls } from "../_ui";
import { generateFromTopic, runTrendingAgent, type TopicResult } from "./actions";

const LENGTHS = [400, 600, 800, 1000, 1200, 1500];

export function AgentClient({ defaultLength }: { defaultLength: number }) {
  const router = useRouter();

  // ── Topic mode ──
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [length, setLength] = useState(
    LENGTHS.includes(defaultLength) ? defaultLength : 800,
  );
  const [local, setLocal] = useState(false);
  const [topicPending, startTopic] = useTransition();
  const [topicRes, setTopicRes] = useState<TopicResult | null>(null);

  // ── Trending mode ──
  const [trendPending, startTrend] = useTransition();
  const [trendRes, setTrendRes] = useState<PipelineResult | null>(null);

  function genTopic() {
    setTopicRes(null);
    startTopic(async () => {
      const r = await generateFromTopic({
        topic,
        category,
        length_words: length,
        force_local_angle: local,
      });
      setTopicRes(r);
      if (r.ok) {
        setTopic("");
        router.refresh();
      }
    });
  }

  function genTrending() {
    setTrendRes(null);
    startTrend(async () => {
      const r = await runTrendingAgent();
      setTrendRes(r);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Topic → article ── */}
      <Card
        title="Topic se article likhwao"
        desc="Apni marzi ka topic do — AI us par ek draft likhega (review ke baad publish karo)."
      >
        <Field label="Topic" hint="Kis ke baare me article? e.g. 'WhatsApp ka naya AI feature'.">
          <input
            className={inputCls}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic likho…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && topic.trim() && !topicPending) genTopic();
            }}
          />
        </Field>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select
              className={`${selectCls} block w-full`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Auto (AI decide kare)</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Length (words)">
            <select
              className={`${selectCls} block w-full`}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            >
              {LENGTHS.map((l) => (
                <option key={l} value={l}>
                  {l} words
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Toggle
            label="Telugu / local angle force karo"
            hint="Article me AP/Telangana/India angle zaroor daale (agar genuine ho)."
            checked={local}
            onChange={setLocal}
          />
        </div>

        <button
          onClick={genTopic}
          disabled={topicPending || !topic.trim()}
          className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
        >
          {topicPending ? "Likh raha hoon… (~1 min)" : "✨ Draft generate karo"}
        </button>

        {topicRes && (
          <div
            className={
              "mt-4 rounded-xl border px-4 py-3 text-sm " +
              (topicRes.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700")
            }
          >
            {topicRes.ok ? (
              <>
                ✓ Draft ban gaya: <strong>{topicRes.title}</strong>
                <div className="mt-1">
                  <Link href={`/admin/articles/${topicRes.id}`} className="font-medium text-accent underline">
                    Review &amp; publish →
                  </Link>
                </div>
              </>
            ) : (
              <>Error: {topicRes.error}</>
            )}
          </div>
        )}
      </Card>

      {/* ── Trending → article ── */}
      <Card
        title="Aaj ke trending se article"
        desc="Agent khud tech/AI RSS feeds se aaj ka best topic chunkar draft likhega (jaise daily cron karta hai)."
      >
        <button
          onClick={genTrending}
          disabled={trendPending}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50"
        >
          {trendPending ? "Generating… (1–2 min)" : "⚡ Trending se generate karo"}
        </button>

        {trendRes && (
          <div
            className={
              "mt-4 rounded-xl border px-4 py-3 text-sm " +
              (trendRes.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-line bg-surface text-ink-soft")
            }
          >
            <div className="font-medium text-ink">
              {trendRes.status === "created" && `✓ ${trendRes.drafts.length} draft ban gaya`}
              {trendRes.status === "skipped" && `Skip: ${trendRes.reason}`}
              {trendRes.status === "error" && `Error: ${trendRes.reason}`}
            </div>
            {trendRes.drafts.length > 0 && (
              <ul className="mt-2 space-y-1">
                {trendRes.drafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/articles/${d.id}`} className="font-medium text-accent underline">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {trendRes.log.length > 0 && (
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-xs text-ink-mute">
                {trendRes.log.join("\n")}
              </pre>
            )}
          </div>
        )}
      </Card>

      <p className="text-sm text-ink-soft">
        Banaye gaye drafts{" "}
        <Link href="/admin/articles" className="font-medium text-accent underline">
          Articles
        </Link>{" "}
        me review &amp; publish karo. Agent ke writing rules{" "}
        <Link href="/admin/settings" className="font-medium text-accent underline">
          AI Settings
        </Link>{" "}
        me badal sakte ho.
      </p>
    </div>
  );
}
