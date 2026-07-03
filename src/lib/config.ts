/**
 * Shared dashboard config: pipeline steps, AI providers/models, credential
 * fields, feature toggles, and defaults. Pure constants — safe to import in
 * both Server and Client Components (no secrets here).
 */

// ─── Text AI providers + their selectable models ───
export type TextProvider = "claude" | "openai" | "gemini";

export const TEXT_PROVIDERS: { id: TextProvider; label: string }[] = [
  { id: "claude", label: "Claude (Anthropic)" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Gemini (Google)" },
];

export const TEXT_MODELS: Record<
  TextProvider,
  { id: string; label: string; tier: "cheap" | "medium" | "quality" }[]
> = {
  claude: [
    { id: "claude-haiku-4-5", label: "Haiku 4.5 — cheap", tier: "cheap" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — medium", tier: "medium" },
    { id: "claude-opus-4-8", label: "Opus 4.8 — quality", tier: "quality" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini — cheap", tier: "cheap" },
    { id: "gpt-4o", label: "GPT-4o — medium", tier: "medium" },
    { id: "gpt-4.1", label: "GPT-4.1 — quality", tier: "quality" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "2.5 Flash — cheap", tier: "cheap" },
    { id: "gemini-2.5-pro", label: "2.5 Pro — quality", tier: "quality" },
  ],
};

// ─── Image AI providers ───
export type ImageProvider = "imagen" | "dalle";
export const IMAGE_PROVIDERS: { id: ImageProvider; label: string }[] = [
  { id: "imagen", label: "Imagen (Google)" },
  { id: "dalle", label: "OpenAI (gpt-image-1)" },
];

// ─── 7-step agent pipeline + extra agents (spec §4, §8.3) ───
export type StepKey =
  | "khoj"
  | "chunaav"
  | "research"
  | "angle"
  | "writing"
  | "self_check"
  | "quality_check"
  | "seo_check"
  | "ceo"
  | "learning"
  | "performance"
  | "ads"
  // V3 Verify Mode steps
  | "niche_filter"
  | "dup_check"
  | "facts_extract"
  | "fact_check"
  | "language_edit"
  | "discover_check"
  | "fixer";

// ─── V3 agent keys (per-agent configs in `agent_configs`) ───
export const AGENT_KEYS = [
  "topic_scout",
  "dup_guard",
  "researcher",
  "writer",
  "fact_checker",
  "language_editor",
  "discover_checker",
  "fixer",
  "image_agent",
  "ceo",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

export type ModelTier = "cheap" | "mid" | "best";
/** Map an agent tier to the closest model tier in TEXT_MODELS. */
export const TIER_TO_MODEL_TIER: Record<ModelTier, "cheap" | "medium" | "quality"> = {
  cheap: "cheap",
  mid: "medium",
  best: "quality",
};

export const PIPELINE_STEPS: {
  key: StepKey;
  label: string;
  hint: string;
  defaultProvider: TextProvider;
  defaultModel: string;
}[] = [
  { key: "khoj", label: "Khoj (discovery)", hint: "simple — list topics", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  { key: "chunaav", label: "Chunaav (selection)", hint: "simple judgement", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  { key: "research", label: "Research", hint: "summarizing sources", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  { key: "angle", label: "Angle", hint: "needs some thinking", defaultProvider: "claude", defaultModel: "claude-sonnet-4-6" },
  { key: "writing", label: "Writing", hint: "THE real work — quality = traffic", defaultProvider: "claude", defaultModel: "claude-opus-4-8" },
  { key: "self_check", label: "Self-check", hint: "editorial review", defaultProvider: "claude", defaultModel: "claude-sonnet-4-6" },
  { key: "quality_check", label: "Quality & Humanizer agent", hint: "checks meaning/human tone, simplifies hard Telugu, auto-fixes", defaultProvider: "claude", defaultModel: "claude-sonnet-4-6" },
  { key: "seo_check", label: "SEO agent", hint: "checks + auto-fixes title/meta/slug/headings", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  { key: "ceo", label: "CEO agent", hint: "orchestrates all agents, final verdict", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  // V3 steps default to providers the owner actually has keys for (openai +
  // gemini; no claude key) — otherwise every call silently falls back to the
  // cheapest gemini model and verify quality collapses.
  { key: "niche_filter", label: "Niche filter (V3)", hint: "on-niche classification", defaultProvider: "gemini", defaultModel: "gemini-2.5-flash" },
  { key: "dup_check", label: "Duplicate guard (V3)", hint: "semantic dup check", defaultProvider: "gemini", defaultModel: "gemini-2.5-flash" },
  { key: "facts_extract", label: "Facts table (V3)", hint: "structure research into facts", defaultProvider: "openai", defaultModel: "gpt-4o" },
  { key: "fact_check", label: "Fact Checker (V3)", hint: "claims vs facts table", defaultProvider: "openai", defaultModel: "gpt-4o" },
  { key: "language_edit", label: "Language Editor (V3)", hint: "Telugu deep pass", defaultProvider: "openai", defaultModel: "gpt-4o" },
  { key: "discover_check", label: "Discover Checker (V3)", hint: "SEO + Discover checklist", defaultProvider: "openai", defaultModel: "gpt-4o" },
  { key: "fixer", label: "Fixer (V3)", hint: "applies reviewer fixes", defaultProvider: "openai", defaultModel: "gpt-4.1" },
  { key: "learning", label: "Learning agent", hint: "data analysis", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  { key: "performance", label: "Performance analysis", hint: "pattern finding", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
  { key: "ads", label: "Ads placement", hint: "simple decision", defaultProvider: "claude", defaultModel: "claude-haiku-4-5" },
];

// ─── Credential providers stored (encrypted) in api_keys (spec §8.2) ───
export type CredentialProvider =
  | "claude"
  | "openai"
  | "gemini"
  | "imagen"
  | "dalle"
  | "telegram_token"
  | "telegram_chat";

export const CREDENTIALS: {
  provider: CredentialProvider;
  label: string;
  hint: string;
  testable: boolean;
}[] = [
  { provider: "claude", label: "Claude API key", hint: "Anthropic — sk-ant-…", testable: true },
  { provider: "openai", label: "OpenAI API key", hint: "OpenAI — sk-…", testable: true },
  { provider: "gemini", label: "Gemini API key", hint: "Google AI Studio", testable: true },
  { provider: "imagen", label: "Imagen API key", hint: "Google (often same as Gemini)", testable: true },
  { provider: "dalle", label: "DALL·E key", hint: "optional — OpenAI key", testable: true },
  { provider: "telegram_token", label: "Telegram Bot Token", hint: "from @BotFather", testable: true },
  { provider: "telegram_chat", label: "Telegram Chat ID", hint: "from @userinfobot", testable: true },
];

// ─── Feature toggles (spec §8.3b) ───
export type FeatureKey =
  | "article_generation"
  | "image_generation"
  | "telegram_notifications"
  | "learning_agent"
  | "performance_analysis"
  | "ads_manager";

export const FEATURES: {
  key: FeatureKey;
  label: string;
  hint: string;
  default: boolean;
}[] = [
  { key: "article_generation", label: "Article generation", hint: "core — daily AI articles", default: true },
  { key: "image_generation", label: "Image generation", hint: "needed for Discover", default: true },
  { key: "telegram_notifications", label: "Telegram notifications", hint: "draft approval", default: true },
  { key: "learning_agent", label: "Learning agent", hint: "learns from your edits", default: true },
  { key: "performance_analysis", label: "Performance analysis", hint: "turn on after data builds", default: false },
  { key: "ads_manager", label: "Ads manager", hint: "turn on after traffic builds", default: false },
];

// ─── General + cost settings (spec §8.3, §8.4) ───
export type GeneralSettings = {
  articles_per_day: 1 | 2;
  tone: "friendly" | "professional" | "casual";
  article_length: number; // 400–1500 words
  publish_time: string; // "HH:MM" IST — when the daily cron runs
  auto_publish: boolean; // true = publish live immediately (skip human review)
};

export const DEFAULT_GENERAL: GeneralSettings = {
  articles_per_day: 1,
  tone: "friendly",
  article_length: 900,
  publish_time: "08:00",
  auto_publish: false,
};

export type CostSettings = {
  monthly_budget: number; // ₹
  learning_examples_limit: number;
  performance_frequency: "weekly" | "monthly";
};

export const DEFAULT_COST: CostSettings = {
  monthly_budget: 500,
  learning_examples_limit: 3,
  performance_frequency: "weekly",
};

// ─── Site integrations / head codes (spec §7, §10 — GSC/Analytics/AdSense) ───
export type Integrations = {
  ga_id: string; // GA4 Measurement ID, e.g. G-XXXXXXX
  gsc_verification: string; // Search Console meta verification code
  adsense_id: string; // AdSense publisher id, e.g. ca-pub-1234567890
  head_html: string; // any extra raw <head> code (pixels, verifications…)
};

export const DEFAULT_INTEGRATIONS: Integrations = {
  ga_id: "",
  gsc_verification: "",
  adsense_id: "",
  head_html: "",
};

// ─── Research settings (how the agent gathers sources before writing) ───
export type ResearchSettings = {
  min_sources: number; // how many real sources to read (e.g. 4-5)
  depth: "basic" | "deep"; // how much text to pull per source
};
export const DEFAULT_RESEARCH: ResearchSettings = {
  min_sources: 4,
  depth: "deep",
};

// ─── Quality rules (enforced in writing + self-check) ───
export type QualityRules = {
  min_words: number;
  max_words: number;
  facts_only: boolean; // only facts from the research — no hallucination
  require_local_angle: boolean; // a genuine Telugu/India angle is mandatory
  ban_ai_slop: boolean; // strip generic/robotic AI phrasing
  self_check: boolean; // run the self-critique editing pass
};
export const DEFAULT_QUALITY: QualityRules = {
  min_words: 600,
  max_words: 900,
  facts_only: true,
  require_local_angle: false,
  ban_ai_slop: true,
  self_check: true,
};

// ─── Public site settings (chrome shown to readers) ───
export const SOCIAL_KEYS = [
  "facebook",
  "whatsapp",
  "telegram",
  "instagram",
  "youtube",
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SOCIAL_META: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/telugulo" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "https://whatsapp.com/channel/…" },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/telugulo" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/telugulo.in" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@telugulo" },
];

export type SiteSettings = {
  name: string;
  tagline: string;
  description: string;
  footer_about: string;
  socials: Record<SocialKey, string>;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  name: "telugulo.in",
  tagline: "టెక్ న్యూస్ తెలుగులో",
  description:
    "రోజువారీ టెక్ న్యూస్, AI, gadgets — తెలుగులో. తాజా technology వార్తలు simple Telugu lo.",
  footer_about:
    "telugulo.in: మీ నమ్మకమైన టెక్ న్యూస్ ప్లాట్‌ఫామ్ — AI, gadgets, mobile, internet వంటి విభాగాల్లో రోజువారీ తాజా & విశ్వసనీయ వార్తలు తెలుగులో. 🚀",
  socials: { facebook: "", whatsapp: "", telegram: "", instagram: "", youtube: "" },
};

// Settings table keys
export const SETTINGS_KEYS = {
  models: "ai_models",
  imageProvider: "image_provider",
  features: "features",
  general: "general",
  cost: "cost",
  integrations: "integrations",
  site: "site",
  agentInstructions: "agent_instructions",
  research: "research_settings",
  quality: "quality_rules",
  performanceState: "performance_state",
} as const;
