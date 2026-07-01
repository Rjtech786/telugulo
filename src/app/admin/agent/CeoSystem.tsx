"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "../_ui";
import {
  startCeoRun,
  getCeoRunStatus,
  getCeoOverview,
} from "./actions";

type AgentRun = {
  id: string;
  trigger: "cron" | "manual";
  status: "running" | "created" | "skipped" | "error";
  article_id: string | null;
  article_title: string | null;
  reason: string | null;
  started_at: string;
  finished_at: string | null;
};

type AgentMessage = {
  id: string;
  run_id: string;
  agent: "ceo" | "topic_scout" | "researcher" | "writer" | "quality" | "seo" | "image";
  direction: "ceo_to_agent" | "agent_to_ceo";
  status: "working" | "done" | "fixed" | "failed";
  message: string;
  detail: string | null;
  created_at: string;
};

const AGENT_META: Record<
  Exclude<AgentMessage["agent"], "ceo">,
  { label: string; icon: string; x: number; y: number }
> = {
  topic_scout: { label: "Topic Scout", icon: "🔍", x: 350, y: 66 },
  researcher: { label: "Researcher", icon: "📚", x: 508, y: 158 },
  writer: { label: "Writer", icon: "✍️", x: 508, y: 342 },
  quality: { label: "Quality & Humanizer", icon: "🧹", x: 350, y: 434 },
  seo: { label: "SEO Agent", icon: "📈", x: 192, y: 342 },
  image: { label: "Image Agent", icon: "🖼️", x: 192, y: 158 },
};
const AGENT_IDS = Object.keys(AGENT_META) as (keyof typeof AGENT_META)[];
const CEO_POS = { x: 350, y: 250 };

type NodeStatus = "idle" | "working" | "done" | "fixed" | "failed";

type Pulse = {
  id: string;
  agentId: keyof typeof AGENT_META;
  dir: "toAgent" | "toCeo";
  color: string;
};

function pathFor(p: Pulse): string {
  const a = AGENT_META[p.agentId];
  return p.dir === "toAgent"
    ? `M ${CEO_POS.x} ${CEO_POS.y} L ${a.x} ${a.y}`
    : `M ${a.x} ${a.y} L ${CEO_POS.x} ${CEO_POS.y}`;
}

function colorForStatus(status: string): string {
  if (status === "failed") return "#dc2626";
  if (status === "fixed") return "#d97706";
  if (status === "done") return "#16a34a";
  return "#7c6ce8"; // working / accent
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "abhi";
  if (s < 60) return `${s}s pehle`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m pehle`;
  const h = Math.round(m / 60);
  return `${h}h pehle`;
}

function duration(run: AgentRun): string {
  const end = run.finished_at ? new Date(run.finished_at).getTime() : Date.now();
  const start = new Date(run.started_at).getTime();
  const secs = Math.max(0, Math.round((end - start) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}m ${secs % 60}s`;
}

function statusBadge(status: AgentRun["status"]) {
  const map: Record<AgentRun["status"], string> = {
    running: "bg-accent/10 text-accent",
    created: "bg-green-50 text-green-700",
    skipped: "bg-neutral-100 text-ink-mute",
    error: "bg-red-50 text-red-700",
  };
  const text: Record<AgentRun["status"], string> = {
    running: "Chal raha hai",
    created: "Publish ho gaya",
    skipped: "Skip",
    error: "Error",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status]}`}>
      {text[status]}
    </span>
  );
}

export function CeoSystem() {
  const [recent, setRecent] = useState<AgentRun[]>([]);
  const [liveRun, setLiveRun] = useState<AgentRun | null>(null);
  const [liveMessages, setLiveMessages] = useState<AgentMessage[]>([]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [starting, setStarting] = useState(false);
  const seenCount = useRef(0);
  const liveRunId = useRef<string | null>(null);

  const applyMessages = useCallback((msgs: AgentMessage[]) => {
    const fresh = msgs.slice(seenCount.current);
    if (fresh.length) {
      const newPulses: Pulse[] = [];
      for (const m of fresh) {
        if (m.agent === "ceo") continue;
        const agentId = m.agent as keyof typeof AGENT_META;
        if (m.direction === "ceo_to_agent") {
          newPulses.push({ id: `${m.id}-out`, agentId, dir: "toAgent", color: colorForStatus("working") });
        } else {
          newPulses.push({ id: `${m.id}-back`, agentId, dir: "toCeo", color: colorForStatus(m.status) });
        }
      }
      if (newPulses.length) {
        setPulses((p) => [...p, ...newPulses]);
        setTimeout(() => {
          setPulses((p) => p.filter((x) => !newPulses.some((n) => n.id === x.id)));
        }, 1100);
      }
    }
    seenCount.current = msgs.length;
    setLiveMessages(msgs);
  }, []);

  const loadOverview = useCallback(async () => {
    const ov = await getCeoOverview();
    setRecent(ov.recent);
    if (ov.active) {
      liveRunId.current = ov.active.id;
      seenCount.current = 0;
      setLiveRun(ov.active);
      applyMessages(ov.activeMessages);
    } else if (!liveRunId.current) {
      setLiveRun(ov.recent[0] ?? null);
    }
  }, [applyMessages]);

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const iv = setInterval(async () => {
      if (liveRunId.current) {
        const { run, messages } = await getCeoRunStatus(liveRunId.current);
        if (run) setLiveRun(run);
        applyMessages(messages);
        if (run && run.status !== "running") {
          liveRunId.current = null;
          const ov = await getCeoOverview();
          setRecent(ov.recent);
        }
      } else {
        // idle — occasionally check if a new run started (e.g. the 8 AM cron)
        const ov = await getCeoOverview();
        setRecent(ov.recent);
        if (ov.active) {
          liveRunId.current = ov.active.id;
          seenCount.current = 0;
          setLiveRun(ov.active);
          applyMessages(ov.activeMessages);
        }
      }
    }, liveRunId.current ? 1500 : 8000);
    return () => clearInterval(iv);
  }, [applyMessages, liveRun?.status]);

  async function runNow() {
    setStarting(true);
    try {
      const { runId } = await startCeoRun();
      liveRunId.current = runId;
      seenCount.current = 0;
      setLiveMessages([]);
      setPulses([]);
      const { run, messages } = await getCeoRunStatus(runId);
      setLiveRun(run);
      applyMessages(messages);
    } finally {
      setStarting(false);
    }
  }

  // Latest status per agent, derived from the live message timeline.
  const nodeStatus: Record<string, NodeStatus> = {};
  for (const id of AGENT_IDS) nodeStatus[id] = "idle";
  for (const m of liveMessages) {
    if (m.agent === "ceo") continue;
    nodeStatus[m.agent] = m.direction === "ceo_to_agent" ? "working" : (m.status as NodeStatus);
  }

  const isRunning = liveRun?.status === "running";
  const ceoText =
    [...liveMessages].reverse().find((m) => m.agent === "ceo")?.message ??
    (isRunning ? "Kaam shuru ho gaya…" : "CEO ready hai — agla run monitor kar raha hoon.");

  return (
    <Card
      title="CEO Agent System"
      desc="Ek CEO agent baaki sab specialist agents ko orchestrate karta hai — daily 8 AM run isi system se chalta hai."
      action={
        <button
          onClick={runNow}
          disabled={starting || isRunning}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50"
        >
          {isRunning ? "Chal raha hai…" : starting ? "Start ho raha…" : "⚡ Abhi run karo"}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Diagram */}
        <div className="rounded-xl border border-line bg-surface/60 p-2">
          <svg viewBox="0 0 700 500" className="w-full select-none">
            {AGENT_IDS.map((id) => {
              const a = AGENT_META[id];
              return (
                <line
                  key={id}
                  x1={CEO_POS.x}
                  y1={CEO_POS.y}
                  x2={a.x}
                  y2={a.y}
                  stroke="#e5e1f7"
                  strokeWidth={2}
                />
              );
            })}

            {pulses.map((p) => (
              <circle key={p.id} r={7} fill={p.color}>
                <animateMotion dur="1.1s" repeatCount="1" path={pathFor(p)} />
              </circle>
            ))}

            {/* CEO node — always "active" */}
            <g>
              <circle
                cx={CEO_POS.x}
                cy={CEO_POS.y}
                r={54}
                fill="white"
                stroke="#7c6ce8"
                strokeWidth={3}
                className="animate-pulse"
                style={{ animationDuration: isRunning ? "1.4s" : "3s" }}
              />
              <text x={CEO_POS.x} y={CEO_POS.y - 8} textAnchor="middle" fontSize="26">
                👑
              </text>
              <text
                x={CEO_POS.x}
                y={CEO_POS.y + 18}
                textAnchor="middle"
                fontSize="13"
                fontWeight={700}
                fill="#1f1a3d"
              >
                CEO
              </text>
            </g>

            {AGENT_IDS.map((id) => {
              const a = AGENT_META[id];
              const st = nodeStatus[id];
              const stroke =
                st === "working"
                  ? "#7c6ce8"
                  : st === "done"
                    ? "#16a34a"
                    : st === "fixed"
                      ? "#d97706"
                      : st === "failed"
                        ? "#dc2626"
                        : "#d8d4ee";
              return (
                <g key={id}>
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={40}
                    fill="white"
                    stroke={stroke}
                    strokeWidth={st === "idle" ? 2 : 3}
                    className={st === "working" ? "animate-pulse" : undefined}
                  />
                  <text x={a.x} y={a.y - 4} textAnchor="middle" fontSize="20">
                    {a.icon}
                  </text>
                  <text x={a.x} y={a.y + 42} textAnchor="middle" fontSize="11" fill="#57517a" fontWeight={600}>
                    {a.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-1 px-2 pb-1 text-sm text-ink-soft">
            <span className="font-semibold text-ink">CEO:</span> {ceoText}
          </p>
        </div>

        {/* Live message log */}
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-white p-3">
          {liveMessages.length === 0 && (
            <p className="text-sm text-ink-mute">Abhi koi activity nahi — &quot;Abhi run karo&quot; dabao ya 8 AM cron ka wait karo.</p>
          )}
          {[...liveMessages].reverse().map((m) => (
            <div key={m.id} className="rounded-lg border border-line/70 px-2.5 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  {m.agent === "ceo" ? "👑 CEO" : `${AGENT_META[m.agent as keyof typeof AGENT_META]?.icon ?? ""} ${AGENT_META[m.agent as keyof typeof AGENT_META]?.label ?? m.agent}`}
                </span>
                <span className="shrink-0 text-ink-mute">{timeAgo(m.created_at)}</span>
              </div>
              <p className="mt-0.5 text-ink-soft">{m.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Run history */}
      {recent.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">Recent runs</h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-ink-mute">
                <tr>
                  <th className="px-3 py-2 font-medium">Kab</th>
                  <th className="px-3 py-2 font-medium">Trigger</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-soft">{timeAgo(r.started_at)}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.trigger === "cron" ? "Daily cron" : "Manual"}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2">
                      {r.article_id ? (
                        <Link href={`/admin/articles/${r.article_id}`} className="font-medium text-accent underline">
                          {r.article_title}
                        </Link>
                      ) : (
                        <span className="text-ink-mute">{r.reason ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{duration(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
