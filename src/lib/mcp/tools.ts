import "server-only";
import { SITE } from "@/lib/site";
import { SETTINGS_KEYS, type GeneralSettings } from "@/lib/config";
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
  writeSetting,
} from "@/lib/settings";
import { addSkillNote, listSkillNotes } from "@/lib/agent/skills";
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
      { problem_type: str("The recurring problem."), solution_note: str("How the agent should handle it.") },
      ["problem_type", "solution_note"],
    ),
    handler: async (a) => {
      const id = await addSkillNote(String(a.problem_type), String(a.solution_note));
      await logMcpAction("add_skill_note", { problem_type: a.problem_type }, id);
      const all = await listSkillNotes(20);
      return { text: `Skill note added. The agent now has ${all.length} note(s).`, data: { id } };
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
