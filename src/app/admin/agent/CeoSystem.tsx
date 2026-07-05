"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  startCeoRun,
  getCeoRunStatus,
  getCeoOverview,
  getV3Panel,
  saveAgentConfigAction,
  setAutoPublish,
  saveSystemSettings,
  startReverify,
  type SystemSettings,
} from "./actions";
import type { PipelineRunRow } from "@/lib/agent/pipelineRuns";
import type { AgentConfig } from "@/lib/agent/agentConfigs";

/**
 * Mission Control (spec §11.6) — dark, live agent-network view of the V3
 * newsroom. CEO in the center, pipeline agents on the inner orbit, Verify
 * reviewers on the outer orbit. Pulses travel along edges during a run,
 * nodes light up by status, clicking a node opens its config side panel.
 */

type AgentRun = {
  id: string;
  trigger: "cron" | "manual";
  status: "running" | "created" | "skipped" | "error" | "draft";
  article_id: string | null;
  article_title: string | null;
  reason: string | null;
  started_at: string;
  finished_at: string | null;
};

type AgentNodeId =
  | "topic_scout"
  | "researcher"
  | "writer"
  | "quality"
  | "seo"
  | "image"
  | "fact_checker"
  | "language_editor"
  | "discover_checker"
  | "fixer";

type AgentMessage = {
  id: string;
  run_id: string;
  agent: "ceo" | AgentNodeId;
  direction: "ceo_to_agent" | "agent_to_ceo";
  status: "working" | "done" | "fixed" | "failed";
  message: string;
  detail: string | null;
  created_at: string;
};

const W = 720;
const H = 540;
const CEO_POS = { x: 360, y: 264 };

const AGENT_META: Record<
  AgentNodeId,
  { label: string; icon: string; x: number; y: number; ring: "pipeline" | "verify"; role: string }
> = {
  // inner orbit — pipeline
  topic_scout: { label: "Topic Scout", icon: "🔍", x: 360, y: 92, ring: "pipeline", role: "Trending topics dhoondta hai — niche filter + duplicate guard ke saath." },
  researcher: { label: "Researcher", icon: "📚", x: 512, y: 172, ring: "pipeline", role: "Live web search se strict facts-table banata hai (real source URLs)." },
  writer: { label: "Writer", icon: "✍️", x: 512, y: 356, ring: "pipeline", role: "Sirf facts-table se outline-first article likhta hai (concrete ending)." },
  quality: { label: "Humanizer", icon: "🧹", x: 360, y: 436, ring: "pipeline", role: "Hard Telugu ko spoken Telugu me simplify karta hai, tone human banata hai." },
  seo: { label: "Verify Hub", icon: "🛡️", x: 208, y: 356, ring: "pipeline", role: "Verify Mode ka control point — teeno reviewers + fixer loop yahan se chalta hai." },
  image: { label: "Image Agent", icon: "🖼️", x: 208, y: 172, ring: "pipeline", role: "1200px+ hero image banata hai (Google Discover requirement)." },
  // outer orbit — Verify ring
  fact_checker: { label: "Fact Checker", icon: "🔎", x: 648, y: 88, ring: "verify", role: "Har claim ko facts-table se match karta hai — unsupported = critical." },
  language_editor: { label: "Language Editor", icon: "🔤", x: 648, y: 432, ring: "verify", role: "Sentence-by-sentence Telugu pass — nonsense/textbook phrases pakadta hai." },
  discover_checker: { label: "Discover Check", icon: "🧭", x: 72, y: 432, ring: "verify", role: "Google Discover checklist score + relevant internal links chunta hai." },
  fixer: { label: "Fixer", icon: "🔧", x: 72, y: 88, ring: "verify", role: "Reviewers ke saare issues ek full-flow rewrite me fix karta hai (max 3 loops)." },
};
const AGENT_IDS = Object.keys(AGENT_META) as AgentNodeId[];

/** Node id → agent_configs key (null = no editable config). */
const CONFIG_KEY: Record<AgentNodeId, string | null> = {
  topic_scout: "topic_scout",
  researcher: "researcher",
  writer: "writer",
  quality: null,
  seo: null,
  image: "image_agent",
  fact_checker: "fact_checker",
  language_editor: "language_editor",
  discover_checker: "discover_checker",
  fixer: "fixer",
};

type NodeStatus = "idle" | "working" | "done" | "fixed" | "failed";

const STATUS_COLOR: Record<NodeStatus, string> = {
  idle: "#34345e",
  working: "#8b7cff",
  done: "#22c55e",
  fixed: "#f59e0b",
  failed: "#ef4444",
};

type Pulse = { id: string; agentId: AgentNodeId; dir: "toAgent" | "toCeo"; color: string };

function pathFor(p: Pulse): string {
  const a = AGENT_META[p.agentId];
  return p.dir === "toAgent"
    ? `M ${CEO_POS.x} ${CEO_POS.y} L ${a.x} ${a.y}`
    : `M ${a.x} ${a.y} L ${CEO_POS.x} ${CEO_POS.y}`;
}

function colorForStatus(status: string): string {
  return STATUS_COLOR[(status as NodeStatus) in STATUS_COLOR ? (status as NodeStatus) : "working"] ?? "#8b7cff";
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "abhi";
  if (s < 60) return `${s}s pehle`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m pehle`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h pehle`;
  return `${Math.round(h / 24)}d pehle`;
}

function duration(run: AgentRun): string {
  const end = run.finished_at ? new Date(run.finished_at).getTime() : Date.now();
  const secs = Math.max(0, Math.round((end - new Date(run.started_at).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}m ${secs % 60}s`;
}

const RUN_BADGE: Record<AgentRun["status"], { cls: string; text: string }> = {
  running: { cls: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30", text: "Chal raha hai" },
  created: { cls: "bg-green-500/15 text-green-300 border-green-400/30", text: "Published" },
  draft: { cls: "bg-amber-500/15 text-amber-300 border-amber-400/30", text: "Draft (verify fail)" },
  skipped: { cls: "bg-slate-500/20 text-slate-300 border-slate-400/20", text: "Skip" },
  error: { cls: "bg-red-500/15 text-red-300 border-red-400/30", text: "Error" },
};

// ─── Demo data (design preview without a live run) ───
const DEMO_MESSAGES: AgentMessage[] = (
  [
    ["topic_scout", "done", "18 candidate topics RSS se mile."],
    ["topic_scout", "done", 'Topic final: "Google Gemini 3 India launch" (niche + duplicate check pass)'],
    ["researcher", "done", "9 facts + 4 real source(s) ka facts table ready."],
    ["writer", "done", '"Gemini 3 భారత్‌లో లాంచ్" likh diya (~810 words).'],
    ["quality", "fixed", "Simplified 3 hard words, fixed one broken sentence."],
    ["fact_checker", "done", "Loop 1: saare claims facts-table se match hue (9/10)."],
    ["language_editor", "fixed", 'Loop 1: 2 textbook phrases mile — "వేదిక" → platform.'],
    ["discover_checker", "done", "Loop 1: headline entity-rich hai, 1 internal link add kiya (8/10)."],
    ["fixer", "done", "Fixer ne corrected version de diya — dobara check."],
    ["seo", "done", "Verify PASS (fact 9/10, language 8/10, discover 9/10, 2 loop)."],
    ["image", "working", "Image agent header image bana raha hai…"],
  ] as [AgentNodeId, AgentMessage["status"], string][]
).map(([agent, status, message], i) => ({
  id: `demo-${i}`,
  run_id: "demo",
  agent,
  direction: "agent_to_ceo" as const,
  status,
  message,
  detail: null,
  created_at: new Date(Date.now() - (12 - i) * 30000).toISOString(),
}));

const DEMO_RUN: AgentRun = {
  id: "demo",
  trigger: "manual",
  status: "running",
  article_id: null,
  article_title: null,
  reason: null,
  started_at: new Date(Date.now() - 6 * 60000).toISOString(),
  finished_at: null,
};

const DEMO_V3: {
  configs: AgentConfig[];
  pipelineRuns: PipelineRunRow[];
  autoPublish: boolean;
  system: { systemOn: boolean; publishTime: string; minWords: number; maxWords: number };
} = {
  autoPublish: true,
  system: { systemOn: true, publishTime: "08:00", minWords: 600, maxWords: 900 },
  configs: AGENT_IDS.filter((a) => CONFIG_KEY[a]).map((a) => ({
    agent_key: CONFIG_KEY[a]!,
    display_name: AGENT_META[a].label,
    instructions: AGENT_META[a].role,
    model_tier: "mid",
    enabled: true,
    updated_at: new Date().toISOString(),
  })) as AgentConfig[],
  pipelineRuns: [
    { final_status: "published", reviewer_scores: { fact: 9, language: 8, discover: 9, loops: 2 } },
    { final_status: "published", reviewer_scores: { fact: 9, language: 9, discover: 8, loops: 1 } },
    { final_status: "draft_failed", article_id: "demo-a1", reviewer_scores: { fact: 6, language: 7, discover: 7, loops: 3 }, failure_report: { failed_validators: [{ name: "script_purity", detail: 'Foreign char "خ"' }] } },
    { final_status: "skipped_duplicate" },
    { final_status: "published", reviewer_scores: { fact: 10, language: 9, discover: 9, loops: 1 } },
    { final_status: "skipped_off_niche" },
    { final_status: "published", reviewer_scores: { fact: 8, language: 9, discover: 8, loops: 2 } },
  ].map((r, i) => {
    const defaultLogs = [
      { stage: "Topic Scout", summary: "RSS candidates discovered: 12. Finalised: Google Gemini 3 India launch.", ms: 3800, output_tokens: 85 },
      { stage: "Duplicate Guard", summary: "Niche classification and duplicate check passed.", ms: 1900, output_tokens: 30 },
      { stage: "Researcher", summary: "Found 12 facts from 5 web sources with Gemini search grounding.", ms: 12400, output_tokens: 410 },
      { stage: "Writer", summary: "Completed outline-first draft generation (850 words).", ms: 24600, word_count: 850, output_tokens: 1520 },
      { stage: "Verify Mode", summary: "Review loop 1: fact 9/10, language 8/10, discover 9/10.", ms: 15300, output_tokens: 720 },
      { stage: "Fixer", summary: "Fixer loop 2: resolved language issues, inserted 2 internal links.", ms: 8900, output_tokens: 490 },
      { stage: "Publish Gate", summary: "Hard code validators passed. Auto-published.", ms: 1200, output_tokens: 0 }
    ];
    return {
      id: `pr-${i}`,
      article_id: null,
      trigger: i % 2 ? "cron" : "manual",
      stage_logs: r.final_status === "published" ? defaultLogs : [],
      facts_table: null,
      hard_validator_results: null,
      failure_report: null,
      ...r,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    };
  }) as PipelineRunRow[],
};

export function CeoSystem({ demo = false }: { demo?: boolean }) {
  const [recent, setRecent] = useState<AgentRun[]>([]);
  const [liveRun, setLiveRun] = useState<AgentRun | null>(demo ? DEMO_RUN : null);
  const [liveMessages, setLiveMessages] = useState<AgentMessage[]>(demo ? DEMO_MESSAGES : []);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<AgentNodeId | "ceo" | null>(null);
  const [selectedRun, setSelectedRun] = useState<PipelineRunRow | null>(null);
  const [runTab, setRunTab] = useState<"overview" | "timeline">("overview");
  const seenCount = useRef(0);
  const liveRunId = useRef<string | null>(null);

  const [v3, setV3] = useState<typeof DEMO_V3 | null>(demo ? DEMO_V3 : null);
  const [cfgDraft, setCfgDraft] = useState({ instructions: "", model_tier: "mid", enabled: true });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [sysDraft, setSysDraft] = useState<SystemSettings | null>(null);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysMsg, setSysMsg] = useState<string | null>(null);
  const [reverifying, setReverifying] = useState(false);

  const loadV3 = useCallback(async () => {
    if (demo) return;
    try {
      setV3(await getV3Panel());
    } catch {
      /* migration not applied yet */
    }
  }, [demo]);
  useEffect(() => {
    loadV3();
  }, [loadV3]);

  const applyMessages = useCallback((msgs: AgentMessage[]) => {
    const fresh = msgs.slice(seenCount.current);
    if (fresh.length) {
      const newPulses: Pulse[] = [];
      for (const m of fresh) {
        if (m.agent === "ceo") continue;
        const agentId = m.agent as AgentNodeId;
        if (!AGENT_META[agentId]) continue;
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
    if (demo) return;
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
  }, [applyMessages, demo]);

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (demo) return;
    const iv = setInterval(async () => {
      if (liveRunId.current) {
        const { run, messages } = await getCeoRunStatus(liveRunId.current);
        if (run) setLiveRun(run);
        applyMessages(messages);
        if (run && run.status !== "running") {
          liveRunId.current = null;
          const ov = await getCeoOverview();
          setRecent(ov.recent);
          loadV3();
        }
      } else {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyMessages, liveRun?.status, demo]);

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

  async function reverifyNow(articleId: string) {
    setReverifying(true);
    try {
      const { runId } = await startReverify(articleId);
      liveRunId.current = runId;
      seenCount.current = 0;
      setLiveMessages([]);
      setPulses([]);
      setSelectedRun(null);
      const { run, messages } = await getCeoRunStatus(runId);
      setLiveRun(run);
      applyMessages(messages);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setReverifying(false);
    }
  }

  // Latest status + failure count per agent from the live timeline.
  const nodeStatus: Record<string, NodeStatus> = {};
  const failCount: Record<string, number> = {};
  for (const id of AGENT_IDS) {
    nodeStatus[id] = "idle";
    failCount[id] = 0;
  }
  for (const m of liveMessages) {
    if (m.agent === "ceo" || !AGENT_META[m.agent as AgentNodeId]) continue;
    nodeStatus[m.agent] = m.direction === "ceo_to_agent" ? "working" : (m.status as NodeStatus);
    if (m.status === "failed" && m.direction === "agent_to_ceo") failCount[m.agent]++;
  }

  const isRunning = liveRun?.status === "running";
  const ceoText =
    [...liveMessages].reverse().find((m) => m.agent === "ceo")?.message ??
    (isRunning ? "Kaam shuru ho gaya…" : "CEO ready — agla run monitor kar raha hoon.");

  const selCfgKey = selected && selected !== "ceo" ? CONFIG_KEY[selected] : selected === "ceo" ? "ceo" : null;
  const selCfg = selCfgKey && v3 ? v3.configs.find((c) => c.agent_key === selCfgKey) ?? null : null;

  function selectAgent(id: AgentNodeId | "ceo") {
    setSelected((cur) => (cur === id ? null : id));
    setCfgMsg(null);
    const key = id === "ceo" ? "ceo" : CONFIG_KEY[id];
    const c = key && v3 ? v3.configs.find((x) => x.agent_key === key) : null;
    if (c) {
      setCfgDraft({ instructions: c.instructions ?? "", model_tier: c.model_tier ?? "mid", enabled: c.enabled });
    }
  }

  const runBlockColor = (r: PipelineRunRow) =>
    r.final_status === "published"
      ? "bg-gradient-to-b from-green-400 to-green-600"
      : r.final_status === "draft_failed" || r.final_status === "error"
        ? "bg-gradient-to-b from-red-400 to-red-600"
        : r.final_status
          ? "bg-gradient-to-b from-amber-400 to-amber-600"
          : "bg-gradient-to-b from-indigo-400 to-indigo-600 animate-pulse";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#26264d] bg-[#0b0b1c] text-slate-200 shadow-[0_20px_60px_-20px_rgba(80,60,220,0.35)]">
      <style>{`
        @keyframes mc-dash { to { stroke-dashoffset: -24; } }
        @keyframes mc-glow { 0%,100% { opacity:.55; } 50% { opacity:1; } }
        @keyframes mc-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#151533] via-[#191945] to-[#151533] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c6ce8] to-[#4f3fd8] text-lg shadow-[0_0_20px_rgba(124,108,232,0.6)]">
            🛰️
          </span>
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-white">
              Mission Control <span className="text-[#8b7cff]">· CEO Newsroom</span>
            </h2>
            <p className="text-xs text-slate-400">
              10 AI agents · Verify Mode gate · daily 8 AM auto-run
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
              (isRunning
                ? "border-green-400/40 bg-green-500/10 text-green-300"
                : "border-slate-500/30 bg-slate-500/10 text-slate-300")
            }
          >
            <span
              className={"h-1.5 w-1.5 rounded-full " + (isRunning ? "bg-green-400" : "bg-slate-400")}
              style={isRunning ? { animation: "mc-glow 1.2s ease-in-out infinite" } : undefined}
            />
            {isRunning ? "LIVE RUN" : "STANDBY"}
          </span>
          {v3 && (
            <button
              onClick={async () => {
                const next = !v3.autoPublish;
                setV3({ ...v3, autoPublish: next });
                if (!demo) await setAutoPublish(next);
              }}
              title="Publish gate ka global switch"
              className={
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                (v3.autoPublish
                  ? "border-green-400/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                  : "border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20")
              }
            >
              Auto-publish {v3.autoPublish ? "ON" : "OFF"}
            </button>
          )}
          <button
            onClick={runNow}
            disabled={starting || isRunning || demo}
            className="rounded-lg bg-gradient-to-r from-[#7c6ce8] to-[#5b46e0] px-4 py-2 text-sm font-bold text-white shadow-[0_0_24px_rgba(124,108,232,0.45)] transition hover:brightness-110 disabled:opacity-50"
          >
            {isRunning ? "⏳ Chal raha hai…" : starting ? "Start…" : "⚡ Abhi run karo"}
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ─── Agent network graph ─── */}
        <div
          className="relative"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(124,108,232,0.14) 0%, rgba(11,11,28,0) 55%), radial-gradient(circle at 15% 20%, rgba(60,180,255,0.05), transparent 40%), radial-gradient(circle at 85% 80%, rgba(255,80,180,0.05), transparent 40%)",
          }}
        >
          {/* starfield dots */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(rgba(148,140,220,0.18) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full select-none">
            <defs>
              <filter id="mc-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="mc-ceo" cx="50%" cy="40%">
                <stop offset="0%" stopColor="#2a2a5e" />
                <stop offset="100%" stopColor="#151533" />
              </radialGradient>
            </defs>

            {/* orbits */}
            <circle cx={CEO_POS.x} cy={CEO_POS.y} r={172} fill="none" stroke="#8b7cff" strokeOpacity={0.14} strokeDasharray="3 7" />
            <circle cx={CEO_POS.x} cy={CEO_POS.y} r={252} fill="none" stroke="#67e8f9" strokeOpacity={0.1} strokeDasharray="2 9" />
            <text x={CEO_POS.x + 180} y={CEO_POS.y - 158} fontSize="9.5" fill="#8b7cff" opacity={0.75} fontWeight={700} letterSpacing="2">PIPELINE</text>
            <text x={CEO_POS.x + 216} y={CEO_POS.y - 226} fontSize="9.5" fill="#67e8f9" opacity={0.75} fontWeight={700} letterSpacing="2">VERIFY RING</text>

            {/* edges */}
            {AGENT_IDS.map((id) => {
              const a = AGENT_META[id];
              const st = nodeStatus[id];
              const active = st !== "idle";
              return (
                <line
                  key={id}
                  x1={CEO_POS.x}
                  y1={CEO_POS.y}
                  x2={a.x}
                  y2={a.y}
                  stroke={active ? STATUS_COLOR[st] : "#26264d"}
                  strokeOpacity={active ? 0.75 : 0.55}
                  strokeWidth={active ? 1.8 : 1.2}
                  strokeDasharray={st === "working" ? "5 7" : undefined}
                  style={st === "working" ? { animation: "mc-dash 0.8s linear infinite" } : undefined}
                />
              );
            })}

            {/* pulses */}
            {pulses.map((p) => (
              <circle key={p.id} r={5.5} fill={p.color} filter="url(#mc-glow)">
                <animateMotion dur="1.1s" repeatCount="1" path={pathFor(p)} />
              </circle>
            ))}

            {/* CEO node */}
            <g onClick={() => selectAgent("ceo")} style={{ cursor: "pointer" }}>
              <circle cx={CEO_POS.x} cy={CEO_POS.y} r={60} fill="none" stroke="#8b7cff" strokeOpacity={0.35} strokeWidth={1}
                style={{ animation: isRunning ? "mc-glow 1.4s ease-in-out infinite" : undefined }} />
              <circle cx={CEO_POS.x} cy={CEO_POS.y} r={50} fill="url(#mc-ceo)" stroke={selected === "ceo" ? "#c4b5fd" : "#8b7cff"} strokeWidth={selected === "ceo" ? 3 : 2.2} filter="url(#mc-glow)" />
              <text x={CEO_POS.x} y={CEO_POS.y - 6} textAnchor="middle" fontSize="24">👑</text>
              <text x={CEO_POS.x} y={CEO_POS.y + 18} textAnchor="middle" fontSize="12" fontWeight={800} fill="#e2e0ff" letterSpacing="1.5">CEO</text>
            </g>

            {/* agent nodes */}
            {AGENT_IDS.map((id) => {
              const a = AGENT_META[id];
              const st = nodeStatus[id];
              const stroke = st === "idle" ? (a.ring === "verify" ? "#1f4b5e" : "#34345e") : STATUS_COLOR[st];
              const isSel = selected === id;
              return (
                <g key={id} onClick={() => selectAgent(id)} style={{ cursor: "pointer" }}>
                  {st === "working" && (
                    <circle cx={a.x} cy={a.y} r={42} fill="none" stroke={STATUS_COLOR.working} strokeOpacity={0.5} strokeWidth={1}
                      style={{ animation: "mc-glow 1.1s ease-in-out infinite" }} />
                  )}
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={34}
                    fill="#141430"
                    stroke={isSel ? "#c4b5fd" : stroke}
                    strokeWidth={isSel ? 3 : st === "idle" ? 1.6 : 2.6}
                    filter={st !== "idle" ? "url(#mc-glow)" : undefined}
                  />
                  <text x={a.x} y={a.y + 1} textAnchor="middle" fontSize="19">{a.icon}</text>
                  <text x={a.x} y={a.y + 52} textAnchor="middle" fontSize="10.5" fill={isSel ? "#c4b5fd" : "#a5a3c8"} fontWeight={700}>
                    {a.label}
                  </text>
                  {/* status dot */}
                  <circle cx={a.x + 24} cy={a.y - 24} r={5} fill={STATUS_COLOR[st]} stroke="#0b0b1c" strokeWidth={2} />
                  {/* failure badge */}
                  {failCount[id] > 0 && (
                    <g>
                      <circle cx={a.x - 26} cy={a.y - 24} r={8.5} fill="#ef4444" stroke="#0b0b1c" strokeWidth={2} />
                      <text x={a.x - 26} y={a.y - 20.5} textAnchor="middle" fontSize="10" fontWeight={800} fill="white">
                        {failCount[id]}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* CEO ticker line */}
          <div className="relative border-t border-white/10 bg-black/25 px-4 py-2.5 text-[13px] backdrop-blur">
            <span className="font-bold text-[#c4b5fd]">👑 CEO:</span>{" "}
            <span className="text-slate-300">{ceoText}</span>
          </div>
        </div>

        {/* ─── Side panel: agent config OR live ticker ─── */}
        <div className="flex max-h-[560px] flex-col border-t border-white/10 bg-[#101024] lg:border-l lg:border-t-0">
          {selected ? (
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl ring-1 ring-white/10">
                    {selected === "ceo" ? "👑" : AGENT_META[selected].icon}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {selected === "ceo" ? "CEO (Orchestrator)" : AGENT_META[selected].label}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {selected === "ceo"
                        ? "Poore run ko orchestrate karta hai + final verdict deta hai."
                        : AGENT_META[selected].role}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white">
                  ✕
                </button>
              </div>

              {selected !== "ceo" && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <span className="text-slate-400">Live status: </span>
                  <span className="font-semibold" style={{ color: STATUS_COLOR[nodeStatus[selected]] }}>
                    {nodeStatus[selected]}
                  </span>
                  {(() => {
                    const last = [...liveMessages].reverse().find((m) => m.agent === selected);
                    return last ? <p className="mt-1 text-slate-300">{last.message}</p> : null;
                  })()}
                </div>
              )}

              {selCfg ? (
                <>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Instructions (is agent ki layer)
                    <textarea
                      rows={7}
                      value={cfgDraft.instructions}
                      onChange={(e) => setCfgDraft({ ...cfgDraft, instructions: e.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12.5px] font-normal normal-case tracking-normal text-slate-200 outline-none focus:border-[#8b7cff]"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      Model:
                      <select
                        value={cfgDraft.model_tier}
                        onChange={(e) => setCfgDraft({ ...cfgDraft, model_tier: e.target.value })}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="cheap">cheap</option>
                        <option value="mid">mid</option>
                        <option value="best">best</option>
                      </select>
                    </label>
                    <button
                      onClick={() => setCfgDraft({ ...cfgDraft, enabled: !cfgDraft.enabled })}
                      className={
                        "relative inline-flex h-5 w-9 items-center rounded-full transition " +
                        (cfgDraft.enabled ? "bg-green-500" : "bg-slate-600")
                      }
                      title={cfgDraft.enabled ? "Enabled" : "Disabled"}
                    >
                      <span
                        className={
                          "inline-block h-4 w-4 transform rounded-full bg-white transition " +
                          (cfgDraft.enabled ? "translate-x-[18px]" : "translate-x-0.5")
                        }
                      />
                    </button>
                    <span className="text-xs text-slate-400">{cfgDraft.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!selCfgKey) return;
                        setCfgSaving(true);
                        setCfgMsg(null);
                        try {
                          if (!demo) await saveAgentConfigAction(selCfgKey, cfgDraft);
                          setCfgMsg("Saved ✓ — agle run se lagoo");
                          loadV3();
                        } catch (e) {
                          setCfgMsg(e instanceof Error ? e.message : "Save failed");
                        } finally {
                          setCfgSaving(false);
                        }
                      }}
                      disabled={cfgSaving}
                      className="rounded-lg bg-gradient-to-r from-[#7c6ce8] to-[#5b46e0] px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {cfgSaving ? "Saving…" : "Save"}
                    </button>
                    {cfgMsg && <span className="text-[11px] font-medium text-green-400">{cfgMsg}</span>}
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                  Is node ki alag config nahi hai — ye pipeline ka fixed step hai.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Live activity</span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8b7cff]" style={{ animation: "mc-glow 1.4s infinite" }} />
                  auto-refresh
                </span>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
                {liveMessages.length === 0 && (
                  <p className="px-1 pt-2 text-xs text-slate-500">
                    Abhi koi activity nahi — “⚡ Abhi run karo” dabao ya 8 AM cron ka wait karo.
                  </p>
                )}
                {[...liveMessages].reverse().map((m) => {
                  const meta = m.agent === "ceo" ? null : AGENT_META[m.agent as AgentNodeId];
                  const color = m.agent === "ceo" ? "#c4b5fd" : STATUS_COLOR[m.status as NodeStatus] ?? "#8b7cff";
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-1.5 text-xs"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-200">
                          {m.agent === "ceo" ? "👑 CEO" : `${meta?.icon ?? ""} ${meta?.label ?? m.agent}`}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(m.created_at)}</span>
                      </div>
                      <p className="mt-0.5 leading-snug text-slate-400">{m.message}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Run history strip + reports ─── */}
      <div className="space-y-4 border-t border-white/10 bg-[#0d0d20] px-5 py-4">
        {/* Newsroom system settings: ON/OFF, run time, word range */}
        {v3 && (() => {
          const sys = sysDraft ?? v3.system;
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Newsroom</span>
              <button
                onClick={() => { setSysMsg(null); setSysDraft({ ...sys, systemOn: !sys.systemOn }); }}
                className={
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition " +
                  (sys.systemOn
                    ? "border-green-400/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                    : "border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20")
                }
              >
                <span className={"h-1.5 w-1.5 rounded-full " + (sys.systemOn ? "bg-green-400" : "bg-red-400")} />
                System {sys.systemOn ? "ON" : "OFF"}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                Daily run (IST):
                <input
                  type="time"
                  value={sys.publishTime}
                  onChange={(e) => { setSysMsg(null); setSysDraft({ ...sys, publishTime: e.target.value }); }}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200 [color-scheme:dark]"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                Words:
                <input
                  type="number" min={300} max={2000} step={50}
                  value={sys.minWords}
                  onChange={(e) => { setSysMsg(null); setSysDraft({ ...sys, minWords: Number(e.target.value) }); }}
                  className="w-[70px] rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
                />
                –
                <input
                  type="number" min={300} max={2000} step={50}
                  value={sys.maxWords}
                  onChange={(e) => { setSysMsg(null); setSysDraft({ ...sys, maxWords: Number(e.target.value) }); }}
                  className="w-[70px] rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
                />
              </label>
              <button
                onClick={async () => {
                  if (!sysDraft) return;
                  setSysSaving(true);
                  setSysMsg(null);
                  try {
                    if (!demo) await saveSystemSettings(sysDraft);
                    setSysMsg("Saved ✓");
                    setV3({ ...v3, system: sysDraft });
                    setSysDraft(null);
                  } catch (e) {
                    setSysMsg(e instanceof Error ? e.message : "Save failed");
                  } finally {
                    setSysSaving(false);
                  }
                }}
                disabled={sysSaving || !sysDraft}
                className="rounded-lg bg-gradient-to-r from-[#7c6ce8] to-[#5b46e0] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {sysSaving ? "Saving…" : "Save"}
              </button>
              {sysMsg && <span className="text-[11px] font-medium text-green-400">{sysMsg}</span>}
            </div>
          );
        })()}

        {v3 && v3.pipelineRuns.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Last {v3.pipelineRuns.length} runs
              </span>
              <span className="text-[10px] text-slate-500">🟩 published · 🟥 failed verify · 🟨 skipped — block dabao report ke liye</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {v3.pipelineRuns.map((r) => {
                const s = r.reviewer_scores;
                const avg = s ? (((s.fact ?? 0) + (s.language ?? 0) + (s.discover ?? 0)) / 3).toFixed(1) : null;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRun(selectedRun?.id === r.id ? null : r);
                      setRunTab("overview");
                    }}
                    title={`${r.final_status ?? "running"} · ${timeAgo(r.created_at)}`}
                    className={
                      `flex h-11 w-11 flex-col items-center justify-center rounded-lg text-[9px] font-bold text-white/90 shadow-inner transition hover:scale-110 hover:shadow-[0_0_14px_rgba(124,108,232,0.5)] ${runBlockColor(r)} ` +
                      (selectedRun?.id === r.id ? "ring-2 ring-[#c4b5fd]" : "")
                    }
                  >
                    {avg ?? "—"}
                    <span className="text-[7.5px] font-medium opacity-80">{s?.loops ? `${s.loops}L` : ""}</span>
                  </button>
                );
              })}
            </div>
            {selectedRun && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3 text-xs">
                {/* Tabs */}
                <div className="mb-3 flex border-b border-white/5 pb-2">
                  <button
                    onClick={() => setRunTab("overview")}
                    className={`pb-1 pr-4 font-bold tracking-tight uppercase text-[10px] ${
                      runTab === "overview" ? "text-[#c4b5fd] border-b border-[#8b7cff]" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Overview & Report
                  </button>
                  <button
                    onClick={() => setRunTab("timeline")}
                    className={`pb-1 font-bold tracking-tight uppercase text-[10px] ${
                      runTab === "timeline" ? "text-[#c4b5fd] border-b border-[#8b7cff]" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Timeline & Costs 💰
                  </button>
                </div>

                {runTab === "overview" ? (
                  <>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        selectedRun.final_status === "published"
                          ? "border-green-400/40 text-green-300"
                          : selectedRun.final_status === "draft_failed" || selectedRun.final_status === "error"
                            ? "border-red-400/40 text-red-300"
                            : "border-amber-400/40 text-amber-300"
                      }`}>
                        {selectedRun.final_status === "draft_failed" ? "Draft (failed verify)" : selectedRun.final_status ?? "running"}
                      </span>
                      <span className="text-slate-400">{timeAgo(selectedRun.created_at)} · trigger: {selectedRun.trigger ?? "—"}</span>
                      {selectedRun.reviewer_scores && (
                        <span className="text-slate-300">
                          fact {selectedRun.reviewer_scores.fact ?? "—"} · language {selectedRun.reviewer_scores.language ?? "—"} · discover{" "}
                          {selectedRun.reviewer_scores.discover ?? "—"} · {selectedRun.reviewer_scores.loops ?? 0} loop(s)
                        </span>
                      )}
                      {(selectedRun.final_status === "draft_failed" || selectedRun.final_status === "error") &&
                        selectedRun.article_id && (
                          <button
                            onClick={() => reverifyNow(selectedRun.article_id!)}
                            disabled={reverifying || isRunning || demo}
                            className="ml-auto rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-[11px] font-bold text-white shadow-[0_0_14px_rgba(245,158,11,0.4)] transition hover:brightness-110 disabled:opacity-50"
                          >
                            {reverifying ? "Start…" : "🛡️ Re-verify karo"}
                          </button>
                        )}
                    </div>
                    {selectedRun.failure_report != null && (
                      <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 text-[10.5px] leading-relaxed text-slate-400">
                        {JSON.stringify(selectedRun.failure_report, null, 2)}
                      </pre>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const logs = selectedRun.stage_logs ?? [];
                      if (logs.length === 0) {
                        return <p className="text-slate-500 py-1">Is run ke detailed stage logs available nahi hain.</p>;
                      }
                      const totalMs = logs.reduce((sum, l) => sum + (l.ms ?? 0), 0);
                      const maxMs = Math.max(...logs.map((l) => l.ms ?? 0), 1);
                      const totalTokens = logs.reduce((sum, l) => sum + (l.output_tokens ?? 0), 0);
                      const cost = totalTokens * 0.005; // average ₹0.005 per output token
                      return (
                        <>
                          <div className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2 text-[11px] text-slate-300 font-semibold">
                            <span>⏱️ Duration: {(totalMs / 1000).toFixed(1)}s</span>
                            <span>💵 Est. Cost: ~₹{cost.toFixed(2)} ({totalTokens} tokens)</span>
                          </div>
                          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                            {logs.map((log, idx) => {
                              const pct = ((log.ms ?? 0) / maxMs) * 100;
                              return (
                                <div key={idx} className="space-y-1 rounded border border-white/5 bg-white/[0.02] p-2">
                                  <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-200">
                                    <span>⚙️ {log.stage}</span>
                                    <span>
                                      {log.ms ? `${(log.ms / 1000).toFixed(1)}s` : ""}
                                      {log.output_tokens ? ` · ${log.output_tokens} tkn` : ""}
                                      {log.word_count ? ` · ${log.word_count} words` : ""}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-snug">{log.summary}</p>
                                  {log.ms ? (
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-[#7c6ce8] to-[#67e8f9] rounded-full"
                                        style={{ width: `${Math.max(3, pct)}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Agent Benchmarks Card */}
            {v3 && v3.pipelineRuns.length > 0 && (() => {
              const successRuns = v3.pipelineRuns.filter((r) => r.final_status === "published");
              const totalRuns = v3.pipelineRuns.length;
              const uptime = totalRuns ? Math.round((successRuns.length / totalRuns) * 100) : 0;

              let factSum = 0, langSum = 0, discSum = 0, loopSum = 0, scoreCount = 0;
              for (const r of successRuns) {
                if (r.reviewer_scores) {
                  factSum += r.reviewer_scores.fact ?? 0;
                  langSum += r.reviewer_scores.language ?? 0;
                  discSum += r.reviewer_scores.discover ?? 0;
                  loopSum += r.reviewer_scores.loops ?? 0;
                  scoreCount++;
                }
              }
              const avgFact = scoreCount ? (factSum / scoreCount).toFixed(1) : "—";
              const avgLang = scoreCount ? (langSum / scoreCount).toFixed(1) : "—";
              const avgDisc = scoreCount ? (discSum / scoreCount).toFixed(1) : "—";
              const avgLoops = scoreCount ? (loopSum / scoreCount).toFixed(1) : "—";

              return (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#c4b5fd] flex items-center gap-1.5">
                      📈 Agent Performance Benchmarks
                    </span>
                    <span className="text-[10px] text-slate-400">calculated from last {totalRuns} runs</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-center">
                    <div className="rounded-lg bg-black/20 p-2 border border-white/5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Success Rate</div>
                      <div className="text-base font-bold text-green-400 mt-0.5">{uptime}%</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2 border border-white/5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Avg Fact Check</div>
                      <div className="text-base font-bold text-cyan-400 mt-0.5">{avgFact}/10</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2 border border-white/5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Avg Telugu Purity</div>
                      <div className="text-base font-bold text-indigo-400 mt-0.5">{avgLang}/10</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2 border border-white/5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Avg Discover Score</div>
                      <div className="text-base font-bold text-pink-400 mt-0.5">{avgDisc}/10</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2 border border-white/5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Avg Fix Loops</div>
                      <div className="text-base font-bold text-amber-400 mt-0.5">{avgLoops} L</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* recent agent runs (article links) */}
        {recent.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Kab</th>
                  <th className="px-3 py-2 font-semibold">Trigger</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Article</th>
                  <th className="px-3 py-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-2 text-slate-400">{timeAgo(r.started_at)}</td>
                    <td className="px-3 py-2 text-slate-400">{r.trigger === "cron" ? "Daily cron" : "Manual"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${RUN_BADGE[r.status].cls}`}>
                        {RUN_BADGE[r.status].text}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.article_id ? (
                        <Link href={`/admin/articles/${r.article_id}`} className="font-medium text-[#a99df5] underline decoration-[#a99df5]/40 hover:text-white">
                          {r.article_title}
                        </Link>
                      ) : (
                        <span className="text-slate-500">{r.reason ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{duration(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
