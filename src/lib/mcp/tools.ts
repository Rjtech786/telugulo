import "server-only";
import { SITE } from "@/lib/site";
import {
  SETTINGS_KEYS,
  PIPELINE_STEPS,
  TEXT_PROVIDERS,
  TEXT_MODELS,
  type GeneralSettings,
  type StepKey,
  type TextProvider,
} from "@/lib/config";
import {
  listArticles,
  getArticle,
  publishArticle,
  unpublishArticle,
} from "@/lib/articles";
import {
  generateArticleForTopic,
  reviseDraft,
} from "@/lib/agent/pipeline";
import {
  getGeneral,
  getCost,
  getAgentInstructions,
  setAgentInstructions,
  hasCustomAgentInstructions,
  getResearchSettings,
  setResearchSettings,
  getQualityRules,
  setQualityRules,
  getModelMap,
  writeSetting,
} from "@/lib/settings";
import { addSkillNote, listSkillNotes } from "@/lib/agent/skills";
import {
  listAgentConfigs,
  getAgentConfig,
  updateAgentConfig,
  getAgentSkillNotes,
  isAgentKey,
} from "@/lib/agent/agentConfigs";
import { AGENT_KEYS, type ModelTier } from "@/lib/config";
import {
  getTrafficOverview,
  getTopArticlesByRange,
  daysAgoISO,
} from "@/lib/analytics";
import { logMcpAction } from "@/lib/mcp/log";

type Json = Record<string, unknown>;
type ToolResult = { text: string; data?: unknown };

export type McpTool = {
  name: string;
  description: string;
  readOnly?: boolean;
  inputSchema: Json;
  handler: (args: Json) => Promise<ToolResult>;
};

const obj = (properties: Json, required: string[] = []): Json => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const str = (description: string): Json => ({ type: "string", description });
const num = (description: string): Json => ({ type: "number", description });
const bool = (description: string): Json => ({ type: "boolean", description });

const adminLink = (id: string) => `${SITE.url}/admin/articles/${id}`;

// MCP "task" names → internal pipeline step keys (for model control).
const TASK_TO_STEP: Record<string, StepKey> = {
  discovery: "khoj",
  selection: "chunaav",
  research: "research",
  angle: "angle",
  writing: "writing",
  self_check: "self_check",
};

export const TOOLS: McpTool[] = [
  // ─── Content ───
  {
    name: "telugulo_write_article",
    description:
      "Generate a NEW draft article on a specific topic, on demand (skips the daily RSS discovery). Saves as a DRAFT for review — never auto-publishes. Returns the draft id/title/slug.",
    inputSchema: obj(
      {
        topic: str("What the article should be about, e.g. 'OpenAI's new India data center'."),
        category: str("Optional: ai | mobile | apps | gadgets | internet | tech."),
        length_words: num("Optional target length (400-1500)."),
        force_local_angle: bool("Optional: require a genuine Telugu/AP/Telangana/India angle."),
      },
      ["topic"],
    ),
    handler: async (a) => {
      const topic = String(a.topic || "").trim();
      if (!topic) throw new Error("topic is required");
      const draft = await generateArticleForTopic(topic, {
        category: a.category ? String(a.category) : undefined,
        lengthWords: a.length_words ? Number(a.length_words) : undefined,
        forceLocalAngle: Boolean(a.force_local_angle),
      });
      await logMcpAction("write_article", { topic }, `draft ${draft.id}`);
      return {
        text: `Draft created: "${draft.title}"\nSlug: ${draft.slug}\nReview/edit: ${adminLink(draft.id)}\nIt is a DRAFT — call telugulo_publish_article to publish.`,
        data: draft,
      };
    },
  },
  {
    name: "telugulo_list_drafts",
    description: "List all pending draft articles (id, title, created date).",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const drafts = await listArticles("draft");
      const rows = drafts.map((d) => ({
        id: d.id,
        title: d.title,
        created_at: d.created_at,
        category: d.category,
      }));
      const text = rows.length
        ? rows.map((d) => `• ${d.title}\n  id: ${d.id} · ${d.category ?? "?"} · ${d.created_at?.slice(0, 10)}`).join("\n")
        : "No pending drafts.";
      return { text, data: rows };
    },
  },
  {
    name: "telugulo_get_article",
    description: "Get one article's full content (any status) for review.",
    readOnly: true,
    inputSchema: obj({ id: str("Article id (UUID).") }, ["id"]),
    handler: async (a) => {
      const article = await getArticle(String(a.id));
      if (!article) throw new Error(`Article ${a.id} not found — call telugulo_list_drafts for valid ids.`);
      return {
        text: `Title: ${article.title}\nStatus: ${article.status}\nCategory: ${article.category}\nSlug: ${article.slug}\n\n${article.body ?? ""}`,
        data: article,
      };
    },
  },
  {
    name: "telugulo_update_draft",
    description:
      "Revise an article's body with an AI edit per a plain-language instruction (e.g. 'make the intro shorter', 'add a local Telugu angle', 'add a section on pricing').",
    inputSchema: obj(
      { id: str("Article id (UUID)."), instruction: str("What to change.") },
      ["id", "instruction"],
    ),
    handler: async (a) => {
      const id = String(a.id);
      const instruction = String(a.instruction || "").trim();
      if (!instruction) throw new Error("instruction is required");
      const res = await reviseDraft(id, instruction);
      await logMcpAction("update_draft", { id, instruction }, "revised");
      return { text: `Revised "${res.title}". Review: ${adminLink(res.id)}`, data: res };
    },
  },
  {
    name: "telugulo_publish_article",
    description:
      "Publish a draft article (makes it live on telugulo.in). IMPORTANT: pass confirm=true to actually publish.",
    inputSchema: obj(
      { id: str("Article id (UUID)."), confirm: bool("Must be true to publish.") },
      ["id"],
    ),
    handler: async (a) => {
      const id = String(a.id);
      const article = await getArticle(id);
      if (!article) throw new Error(`Article ${id} not found.`);
      if (!a.confirm) {
        return {
          text: `This will PUBLISH "${article.title}" live on telugulo.in. Re-call with confirm=true to proceed.`,
          data: { id, title: article.title, pending_confirmation: true },
        };
      }
      await publishArticle(id);
      await logMcpAction("publish_article", { id }, "published");
      return { text: `Published "${article.title}" → ${SITE.url}/${article.slug}/`, data: { id } };
    },
  },
  {
    name: "telugulo_unpublish_article",
    description: "Set a published article back to draft (removes it from the live site).",
    inputSchema: obj({ id: str("Article id (UUID).") }, ["id"]),
    handler: async (a) => {
      const id = String(a.id);
      await unpublishArticle(id);
      await logMcpAction("unpublish_article", { id }, "unpublished");
      return { text: `Article ${id} is now a draft (offline).`, data: { id } };
    },
  },

  // ─── Agent skills / instructions ───
  {
    name: "telugulo_get_agent_instructions",
    description:
      "Show the AI agent's current writing instructions (the rules every article follows) and whether they are custom or the built-in default.",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const [text, custom] = await Promise.all([
        getAgentInstructions(),
        hasCustomAgentInstructions(),
      ]);
      return {
        text: `Source: ${custom ? "CUSTOM (set via MCP)" : "built-in default"}\n\n${text}`,
        data: { custom, instructions: text },
      };
    },
  },
  {
    name: "telugulo_update_agent_instructions",
    description:
      "Replace the AI agent's writing instructions. Affects ALL future articles. Provide the full instruction text. IMPORTANT: pass confirm=true to apply.",
    inputSchema: obj(
      {
        instruction_text: str("The full writing rules / system instructions for the agent."),
        confirm: bool("Must be true to apply."),
      },
      ["instruction_text"],
    ),
    handler: async (a) => {
      const text = String(a.instruction_text || "").trim();
      if (text.length < 20) throw new Error("instruction_text is too short — provide the full rules.");
      if (!a.confirm) {
        return {
          text: `This will change how EVERY future article is written. Preview:\n\n${text.slice(0, 500)}${text.length > 500 ? "…" : ""}\n\nRe-call with confirm=true to apply.`,
          data: { pending_confirmation: true },
        };
      }
      await setAgentInstructions(text);
      await logMcpAction("update_agent_instructions", { length: text.length }, "updated");
      return { text: "Agent instructions updated. All future articles will follow them. Tip: telugulo_test_article to verify.", data: { ok: true } };
    },
  },
  {
    name: "telugulo_update_style_setting",
    description:
      "Update one generation/style setting. keys: article_length (400-1500), tone (friendly|professional|casual), articles_per_day (1|2), auto_publish (true|false).",
    inputSchema: obj(
      { key: str("Setting key."), value: { description: "New value (string/number/boolean).", type: ["string", "number", "boolean"] } },
      ["key", "value"],
    ),
    handler: async (a) => {
      const key = String(a.key);
      const general = await getGeneral();
      const next: GeneralSettings = { ...general };
      switch (key) {
        case "article_length":
          next.article_length = Math.min(1500, Math.max(400, Number(a.value) || general.article_length));
          break;
        case "tone": {
          const t = String(a.value);
          if (!["friendly", "professional", "casual"].includes(t)) throw new Error("tone must be friendly|professional|casual");
          next.tone = t as GeneralSettings["tone"];
          break;
        }
        case "articles_per_day":
          next.articles_per_day = Number(a.value) === 2 ? 2 : 1;
          break;
        case "auto_publish":
          next.auto_publish = a.value === true || a.value === "true";
          break;
        default:
          throw new Error("Unknown key. Allowed: article_length, tone, articles_per_day, auto_publish.");
      }
      await writeSetting(SETTINGS_KEYS.general, next);
      await logMcpAction("update_style_setting", { key, value: a.value }, "updated");
      return { text: `Setting "${key}" updated.`, data: next };
    },
  },
  {
    name: "telugulo_test_article",
    description:
      "Generate ONE test draft with the CURRENT instructions so you can verify the rules work before they apply broadly. Saves as a draft (not published).",
    inputSchema: obj({ topic: str("Topic for the test article.") }, ["topic"]),
    handler: async (a) => {
      const topic = String(a.topic || "").trim();
      if (!topic) throw new Error("topic is required");
      const draft = await generateArticleForTopic(topic, {});
      await logMcpAction("test_article", { topic }, `draft ${draft.id}`);
      return { text: `Test draft: "${draft.title}"\nReview: ${adminLink(draft.id)}`, data: draft };
    },
  },
  {
    name: "telugulo_add_skill_note",
    description:
      "Add a reusable skill note to the agent's learning memory (applied to future articles). Example: problem_type='article too short', solution_note='expand with background + a local angle'.",
    inputSchema: obj(
      {
        problem_type: str("The recurring problem."),
        solution_note: str("How the agent should handle it."),
        agent_key: str(`Optional: scope to one agent (${AGENT_KEYS.join("|")}). Default 'all'.`),
      },
      ["problem_type", "solution_note"],
    ),
    handler: async (a) => {
      const agentKey = a.agent_key ? String(a.agent_key) : "all";
      if (agentKey !== "all" && !isAgentKey(agentKey)) {
        throw new Error(`Unknown agent_key. Use 'all' or one of: ${AGENT_KEYS.join(", ")}`);
      }
      const id = await addSkillNote(String(a.problem_type), String(a.solution_note), agentKey);
      await logMcpAction("add_skill_note", { problem_type: a.problem_type, agent_key: agentKey }, id);
      const all = await listSkillNotes(20);
      return { text: `Skill note added (agent: ${agentKey}). ${all.length} note(s) total.`, data: { id } };
    },
  },

  // ─── V3 per-agent configs (spec §11.5) ───
  {
    name: "telugulo_list_agents",
    description: "List all V3 newsroom agents with enabled state, model tier and last update.",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const configs = await listAgentConfigs();
      const text = configs.length
        ? configs.map((c) => `• ${c.agent_key} (${c.display_name ?? ""}) — ${c.enabled ? "ON" : "OFF"} · tier: ${c.model_tier} · updated ${c.updated_at?.slice(0, 10)}`).join("\n")
        : "No agent configs yet — run the 0009 migration.";
      return { text, data: { agents: configs } };
    },
  },
  {
    name: "telugulo_get_agent_config",
    description: `Get one agent's config (instructions, model tier, enabled) + its scoped skill notes. agent_key: ${AGENT_KEYS.join("|")}.`,
    readOnly: true,
    inputSchema: obj({ agent_key: str("Which agent.") }, ["agent_key"]),
    handler: async (a) => {
      const key = String(a.agent_key);
      if (!isAgentKey(key)) throw new Error(`Unknown agent_key. Use one of: ${AGENT_KEYS.join(", ")}`);
      const [cfg, notes] = await Promise.all([getAgentConfig(key), getAgentSkillNotes(key, 20)]);
      if (!cfg) throw new Error(`No config for ${key} — run the 0009 migration.`);
      return {
        text: `${cfg.display_name ?? key} — ${cfg.enabled ? "ON" : "OFF"} · tier: ${cfg.model_tier}\n\nINSTRUCTIONS:\n${cfg.instructions ?? "(none)"}\n\nSKILL NOTES:\n${notes.map((n) => `- ${n}`).join("\n") || "(none)"}`,
        data: { config: cfg, skill_notes: notes },
      };
    },
  },
  {
    name: "telugulo_update_agent_config",
    description:
      "Replace ONE agent's own instructions (its layer on top of the shared newsroom rules). IMPORTANT: pass confirm=true to apply.",
    inputSchema: obj(
      {
        agent_key: str(`Which agent (${AGENT_KEYS.join("|")}).`),
        instructions: str("The agent-specific instructions."),
        confirm: bool("Must be true to apply."),
      },
      ["agent_key", "instructions"],
    ),
    handler: async (a) => {
      const key = String(a.agent_key);
      if (!isAgentKey(key)) throw new Error(`Unknown agent_key. Use one of: ${AGENT_KEYS.join(", ")}`);
      const instructions = String(a.instructions || "").trim();
      if (!a.confirm) {
        return {
          text: `This will change how the "${key}" agent behaves on every future run. Preview:\n\n${instructions.slice(0, 400)}\n\nRe-call with confirm=true to apply.`,
          data: { pending_confirmation: true },
        };
      }
      await updateAgentConfig(key, { instructions });
      await logMcpAction("update_agent_config", { agent_key: key, length: instructions.length }, "updated");
      return { text: `Instructions for "${key}" updated — applies from the next run.`, data: { ok: true } };
    },
  },
  {
    name: "telugulo_toggle_agent",
    description: "Turn one V3 agent on/off (e.g. disable fact_checker temporarily).",
    inputSchema: obj(
      { agent_key: str(`Which agent (${AGENT_KEYS.join("|")}).`), enabled: bool("true = on, false = off.") },
      ["agent_key", "enabled"],
    ),
    handler: async (a) => {
      const key = String(a.agent_key);
      if (!isAgentKey(key)) throw new Error(`Unknown agent_key. Use one of: ${AGENT_KEYS.join(", ")}`);
      await updateAgentConfig(key, { enabled: Boolean(a.enabled) });
      await logMcpAction("toggle_agent", { agent_key: key, enabled: a.enabled }, "updated");
      return { text: `Agent "${key}" is now ${a.enabled ? "ENABLED" : "DISABLED"}.`, data: { ok: true } };
    },
  },
  {
    name: "telugulo_set_agent_model",
    description: "Move one agent between model tiers. tier: cheap | mid | best.",
    inputSchema: obj(
      { agent_key: str(`Which agent (${AGENT_KEYS.join("|")}).`), tier: str("cheap | mid | best.") },
      ["agent_key", "tier"],
    ),
    handler: async (a) => {
      const key = String(a.agent_key);
      if (!isAgentKey(key)) throw new Error(`Unknown agent_key. Use one of: ${AGENT_KEYS.join(", ")}`);
      const tier = String(a.tier) as ModelTier;
      if (!["cheap", "mid", "best"].includes(tier)) throw new Error("tier must be cheap | mid | best");
      await updateAgentConfig(key, { model_tier: tier });
      await logMcpAction("set_agent_model", { agent_key: key, tier }, "updated");
      return { text: `Agent "${key}" moved to the ${tier} model tier.`, data: { ok: true } };
    },
  },

  // ─── Research / quality / models ───
  {
    name: "telugulo_get_research_settings",
    description: "Show how the agent researches before writing (how many sources it reads + depth).",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const r = await getResearchSettings();
      return {
        text: `Sources read per article: ${r.min_sources}\nDepth: ${r.depth}`,
        data: r,
      };
    },
  },
  {
    name: "telugulo_update_research_settings",
    description:
      "Update research rules so the agent reads real sources before writing. min_sources e.g. 4-5; depth = basic | deep.",
    inputSchema: obj({
      min_sources: num("How many real sources to read (1-8)."),
      depth: str("basic | deep (how much text per source)."),
    }),
    handler: async (a) => {
      const next = await setResearchSettings({
        min_sources: a.min_sources != null ? Number(a.min_sources) : undefined,
        depth: a.depth === "basic" ? "basic" : a.depth === "deep" ? "deep" : undefined,
      });
      await logMcpAction("update_research_settings", a, "updated");
      return { text: `Research: ${next.min_sources} sources, ${next.depth} depth.`, data: next };
    },
  },
  {
    name: "telugulo_get_quality_rules",
    description: "Show the current article quality rules (length, facts-only, local-angle, anti-slop, self-check).",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const q = await getQualityRules();
      return {
        text: `Length: ${q.min_words}-${q.max_words} words\nFacts-only: ${q.facts_only}\nLocal angle required: ${q.require_local_angle}\nBan AI-slop: ${q.ban_ai_slop}\nSelf-check: ${q.self_check}`,
        data: q,
      };
    },
  },
  {
    name: "telugulo_update_quality_rules",
    description:
      "Update article quality rules. Any subset of: min_words, max_words, facts_only, require_local_angle, ban_ai_slop, self_check. IMPORTANT: pass confirm=true to apply.",
    inputSchema: obj({
      min_words: num("Minimum words (e.g. 600)."),
      max_words: num("Maximum words (e.g. 900)."),
      facts_only: bool("Only facts from sources — no hallucination."),
      require_local_angle: bool("Require a genuine Telugu/India angle."),
      ban_ai_slop: bool("Strip generic/robotic AI phrasing."),
      self_check: bool("Run the self-critique editing pass."),
      confirm: bool("Must be true to apply."),
    }),
    handler: async (a) => {
      if (!a.confirm) {
        return {
          text: "This changes how ALL future articles are written/checked. Re-call with confirm=true to apply.",
          data: { pending_confirmation: true },
        };
      }
      const next = await setQualityRules({
        min_words: a.min_words as number | undefined,
        max_words: a.max_words as number | undefined,
        facts_only: a.facts_only as boolean | undefined,
        require_local_angle: a.require_local_angle as boolean | undefined,
        ban_ai_slop: a.ban_ai_slop as boolean | undefined,
        self_check: a.self_check as boolean | undefined,
      });
      await logMcpAction("update_quality_rules", a, "updated");
      return { text: "Quality rules updated. Tip: telugulo_test_article to verify.", data: next };
    },
  },
  {
    name: "telugulo_get_models",
    description: "Show which AI model is used for each task (discovery, research, writing, self_check).",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const map = await getModelMap();
      const rows = Object.entries(TASK_TO_STEP).map(([task, step]) => ({
        task,
        provider: map[step].provider,
        model: map[step].model,
      }));
      return {
        text: rows.map((r) => `${r.task}: ${r.provider} / ${r.model}`).join("\n"),
        data: rows,
      };
    },
  },
  {
    name: "telugulo_update_model",
    description:
      "Set the AI model for one task. task: discovery|selection|research|angle|writing|self_check. provider: claude|openai|gemini. model: e.g. gpt-4.1, claude-sonnet-4-6, gemini-2.5-pro.",
    inputSchema: obj(
      {
        task: str("Which step."),
        provider: str("claude | openai | gemini."),
        model: str("Model id for that provider."),
      },
      ["task", "provider", "model"],
    ),
    handler: async (a) => {
      const step = TASK_TO_STEP[String(a.task)];
      if (!step) throw new Error(`Unknown task. Use one of: ${Object.keys(TASK_TO_STEP).join(", ")}`);
      const provider = String(a.provider) as TextProvider;
      if (!TEXT_PROVIDERS.some((p) => p.id === provider)) {
        throw new Error("provider must be claude | openai | gemini");
      }
      const model = String(a.model);
      if (!TEXT_MODELS[provider].some((m) => m.id === model)) {
        const ids = TEXT_MODELS[provider].map((m) => m.id).join(", ");
        throw new Error(`Unknown model for ${provider}. Available: ${ids}`);
      }
      const map = await getModelMap();
      map[step] = { provider, model };
      const clean = Object.fromEntries(PIPELINE_STEPS.map((s) => [s.key, map[s.key]]));
      await writeSetting(SETTINGS_KEYS.models, clean);
      await logMcpAction("update_model", a, "updated");
      return { text: `Model for "${a.task}" set to ${provider} / ${model}.`, data: { task: a.task, provider, model } };
    },
  },
  {
    name: "telugulo_list_skill_notes",
    description: "List the agent's learned skill notes (self-learning memory).",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const notes = await listSkillNotes(50);
      const text = notes.length
        ? notes.map((n) => `• ${n.problem_type} → ${n.solution_note}`).join("\n")
        : "No skill notes yet.";
      return { text, data: notes };
    },
  },

  // ─── Info ───
  {
    name: "telugulo_get_stats",
    description: "Blog stats: published/draft counts, views today/yesterday/7-day, and top articles this week.",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const [published, drafts, traffic, top] = await Promise.all([
        listArticles("published"),
        listArticles("draft"),
        getTrafficOverview(14).catch(() => null),
        getTopArticlesByRange(daysAgoISO(7), 5).catch(() => []),
      ]);
      const data = {
        published: published.length,
        drafts: drafts.length,
        views_today: traffic?.today ?? 0,
        views_yesterday: traffic?.yesterday ?? 0,
        views_last7: traffic?.last7 ?? 0,
        top_week: top.map((t) => ({ title: t.title, views: t.views })),
      };
      const text =
        `Published: ${data.published} · Drafts: ${data.drafts}\n` +
        `Views — today: ${data.views_today}, yesterday: ${data.views_yesterday}, 7-day: ${data.views_last7}\n` +
        (data.top_week.length
          ? `Top this week:\n${data.top_week.map((t, i) => `  ${i + 1}. ${t.title} (${t.views})`).join("\n")}`
          : "No traffic yet.");
      return { text, data };
    },
  },
  {
    name: "telugulo_get_cost",
    description: "Current month's estimated AI spend vs the configured monthly budget.",
    readOnly: true,
    inputSchema: obj({}),
    handler: async () => {
      const [cost, published] = await Promise.all([getCost(), listArticles("published")]);
      const since = Date.now() - 30 * 86_400_000;
      const recent = published.filter(
        (p) => p.published_at && new Date(p.published_at).getTime() >= since,
      ).length;
      const estimate = recent * 6; // ~₹6 per article (text + low-cost image)
      return {
        text: `Monthly budget: ₹${cost.monthly_budget}\nEstimated spend (last 30d): ~₹${estimate} (${recent} articles × ~₹6)\nNote: estimate only — real provider spend isn't metered in-app.`,
        data: { budget: cost.monthly_budget, estimate, articles_30d: recent },
      };
    },
  },
];

export const TOOLS_BY_NAME: Record<string, McpTool> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
);
