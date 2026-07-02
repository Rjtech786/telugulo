# telugulo.in — Project Status & Handoff

> Single source of truth. Read this first in a new session to know the full
> state. (No secrets here — repo is public. Real secrets live in `.env.local`
> locally and `.env.production` on the EC2.)

**Last updated:** 2026-07-01 · **Owner:** Roshan (roshanjameer8786@gmail.com)

---

## 1. What this is
An AI-powered **Telugu tech/AI news blog**. Every day at **8:00 AM IST** an AI
agent researches a trending tech/AI topic, writes a hybrid-Telugu article,
generates a header image, and **auto-publishes it live** (no human review).
Built with Next.js 16. Replaces the old WordPress site.

## 2. Live URLs & access
- **Public site:** https://telugulo.in  (also www)
- **Admin:** https://telugulo.in/admin  → login `roshanjameer8786@gmail.com`
- **GitHub repo:** https://github.com/Rjtech786/telugulo  (PUBLIC, branch `main`) — *consider making private*
- **Local code:** `C:\Users\rosha\Desktop\Telugulo\telugulo-next`

## 3. Tech stack
- Next.js 16 (App Router, Turbopack, `trailingSlash: true`) + React 19 + TypeScript + Tailwind v4
- Supabase (Postgres + Auth + Storage)
- TipTap (WYSIWYG editor, Markdown storage) + react-markdown (public render)
- AI: OpenAI (text `gpt-4o`/`gpt-4o-mini`, image `gpt-image-1`). Layer also supports Claude/Gemini/Imagen.
- Node 22 on EC2 (built locally on Node 24 — both fine, needs 20.9+)

## 4. Supabase (dedicated project — NOT the ApnaBot one)
- **Project id:** `ofusghtmlbhikrohtskm` · URL `https://ofusghtmlbhikrohtskm.supabase.co` · region ap-south-1
- **Tables:** `articles`, `authors`, `settings`, `api_keys` (AES-256-GCM encrypted), `ads` (+ keywords/headline/description/cta), `performance_insights`, `page_views` (timestamped traffic analytics), `skill_notes` (agent self-learning), `mcp_action_log` (MCP audit), `agent_runs` + `agent_messages` (CEO system log), `pages` (footer/legal pages, admin-only RLS)
- **Storage bucket:** `article-images` (public; ad/featured/body/author-avatar uploads go here too)
- **Migrations:** `supabase/migrations/` (0001 schema, 0002 view-counter, 0003 ad counters, 0004 page_views + `daily_view_counts`/`top_articles_since` RPCs, 0005 ads AI/keywords, 0006 skill_notes + mcp_action_log, 0007 CEO agent system, 0008 `pages` table + English seed content, 0009 **Newsroom V3**: pg_trgm + `pipeline_runs` + `banned_phrases` + `agent_configs` + `skill_notes.agent_key` + `similar_published_titles` RPC)
- RLS on: only published articles / authors / active ads are public; rest is server-only (service role)

## 5. Key code structure
```
src/
  app/
    (site)/            public blog: page (home), [slug], category, author, about/privacy/etc.
                       layout reads getSiteSettings() → header/footer (name, tagline, socials)
    admin/             dashboard: AdminShell (sidebar), page (overview w/ traffic chart),
                       agent (AI Agent: topic/trending generation), articles, site
                       (Site Settings), settings (AI), credentials, integrations,
                       analytics, ads, pages (footer/legal pages CRUD), authors
                       (name/slug/bio/avatar CRUD), articles/[id] (editor: body/meta/image +
                       editable URL slug; "New (manual)" creates a blank draft), _ui.tsx (shared)
    mcp/route.ts       MCP control server (token-in-URL JSON-RPC, 20 tools)
    api/cron/generate  daily trigger (POST, Bearer CRON_SECRET)
    api/telegram/webhook, api/views (skips owner+bots → organic only)
    robots.ts, feed.xml, sitemap_index.xml + post/page/category-sitemap.xml +
    sitemap.xsl (styled), news-sitemap.xml, stories-sitemap.xml,
    web-stories/[slug] (AMP Google Web Story), manifest.ts, icon.svg/apple-icon/opengraph-image
    proxy.ts           auth guard for /admin (Next 16 renamed middleware→proxy)
  lib/
    ai/                text.ts, image.ts, index.ts (runStep/runImage, key fallback dalle→openai)
    agent/             pipeline.ts (runPipeline daily + generateArticleForTopic/reviseDraft
                       on-demand), prompts.ts (rules+quality DB-driven), sources.ts (RSS
                       discovery), research.ts (Gemini Google-Search grounding → real facts),
                       skills.ts, slug.ts, telegram.ts
    mcp/               tools.ts (20 MCP tools), log.ts (action audit)
    crypto.ts          AES-256-GCM for api_keys
    supabase/          client.ts, server.ts, admin.ts (service role)
    settings.ts (+ getSiteSettings/getAgentInstructions/getResearch/getQuality),
    analytics.ts (traffic rollups, IST), sitemap.ts (XML builders),
    api-keys.ts, articles.ts (+ listRelated), public.ts, config.ts, site.ts, ads.ts, auth.ts,
    pages.ts (footer/legal pages CRUD), authors.ts (author CRUD)
  components/          rich-editor (TipTap), article-card, article-body, site-header/footer,
                       social-links, ad-slot, icons, thumb, site-head
```

## 6. AI agent pipeline (`src/lib/agent/pipeline.ts`)
- **Daily (`runPipeline`):** Discovery (RSS) → Selection (dedupes recent titles) →
  **Research (multi-source)** → Angle → Write → Image → Self-critique → save.
- **On-demand (`generateArticleForTopic`):** researches the topic first, then writes a DRAFT
  (used by the AI Agent admin page + MCP `write_article`/`test_article`). `reviseDraft` = AI edit.
- **Research = real LIVE web search** (`research.ts researchTopic`): uses **Gemini's Google Search
  grounding** — Gemini actually searches the web, reads current sources, and returns concrete FACTS
  (dates, numbers, names, prices, quotes) with citations. The writer works ONLY from these facts.
  This fixed hollow/factless articles. Real source domains saved to `source_urls`. Needs the
  **gemini key** (set ✓); if missing, daily falls back to the primary RSS source, on-demand to model
  knowledge. ⚠️ The earlier Google-News-link fetch was broken (redirect links = Google JS pages, not
  article text) — do not reintroduce it.
- **Instructions + rules are DB-driven** (so MCP/UI can change them): `settings.agent_instructions`
  (defaults to `WRITING_RULES` — owner's 8 rules), `settings.research_settings` (min_sources, depth),
  `settings.quality_rules` (min/max words, facts_only, require_local_angle, ban_ai_slop, self_check).
  `prompts.ts qualityBlock()` injects these into write + self-check. Skill notes (`skill_notes`) injected too.

## 6a. CEO multi-agent system (Admin → AI Agent) — LIVE
The daily pipeline is now run by a **CEO orchestrator** that assigns work to
named specialist agents and logs every hand-off, shown live in
**Admin → AI Agent** as an animated master/slave diagram (CEO in the center,
signal dots travel to/from each agent node) + a live message feed + run
history table.
- **Agents:** Topic Scout (discovery+selection) → Researcher (web facts) →
  Writer (angle+write) → **Quality & Humanizer** (checks meaning-complete +
  human tone, simplifies hard/textbook Telugu into spoken Telugu — auto-fixes
  inline) → **SEO agent** (audits+auto-fixes title_meta/meta_description/slug,
  checks headline-body alignment — auto-rewrites the headline if it overpromises
  vs the body [`headline_mismatch` fix, logged], inserts 2-3 internal links to
  related past articles in the same category — auto-fixes inline) → Image
  agent → **CEO final verdict** (one-line sign-off).
- **Reliability:** every text step (chunaav/angle/writing/quality/seo/ceo) now
  retries once on a different provider if the configured one throws (rate
  limit, outage) instead of aborting the run — e.g. Claude fails → retried on
  Gemini. Logged as a CEO message when it fires. See `lib/ai/index.ts
  runStepWithFallback`.
- **DB:** `agent_runs` (one row per run) + `agent_messages` (CEO↔agent
  timeline) — migration `0007_ceo_agent_system.sql`.
- **Code:** `lib/agent/agentLog.ts` (run/message log helpers), `lib/agent/
  pipeline.ts runPipeline()` (now orchestrates + logs every step),
  `lib/agent/prompts.ts` (`qualityHumanizePrompt`, `seoAuditPrompt`,
  `ceoVerdictPrompt`), `admin/agent/CeoSystem.tsx` (the animated UI, polls
  `getCeoOverview`/`getCeoRunStatus` server actions).
- **Scope:** powers the **daily 8 AM cron** and the manual "⚡ Abhi run karo"
  button (same `runPipeline()`); on-demand topic-based generation
  (`generateArticleForTopic`, MCP `write_article`) is unchanged/separate.
- New pipeline step keys for model selection (Admin → AI Settings):
  `quality_check`, `seo_check`, `ceo`.
- The "Quality & Humanizer" step is gated by the existing `quality_rules.self_check`
  toggle (Admin → AI Settings). SEO agent always runs.

## 6b. MCP control server (`/mcp`) — LIVE
Owner controls the blog from Claude (Settings → Connectors → custom connector).
- **Endpoint:** `https://telugulo.in/mcp/?token=…` (trailing slash matters). Hand-rolled stateless
  JSON-RPC in `app/mcp/route.ts` (no SDK). Auth = `MCP_AUTH_TOKEN` env (token-in-URL or Bearer).
- **20 tools** (`lib/mcp/tools.ts`): content (write/list/get/revise/publish[confirm]/unpublish),
  agent (get/update_agent_instructions[confirm], update_style_setting, test_article, add/list_skill_notes),
  research (get/update_research_settings), quality (get/update_quality_rules[confirm]),
  models (get_models, update_model), info (get_stats, get_cost). Important actions logged to `mcp_action_log`.
- Token lives in EC2 `.env.production` + local `.env.local`. Rotate there + `pm2 reload --update-env`.

## 6c. E-E-A-T + Performance agent (Advanced Roadmap Phase A/B) — LIVE
- **Sources block:** every article page shows a "మూలాలు (Sources)" box (right
  before the author bio) linking out to the real `source_urls` collected at
  research time — direct trust signal for Discover. Hidden automatically if
  an article has no URL-bearing sources (e.g. on-demand articles). Code:
  `app/(site)/[slug]/page.tsx`, `source_urls` added to `lib/public.ts`'s
  `PublicArticle` type.
- **Performance agent:** `lib/agent/performance.ts runPerformanceAnalysis()`
  — gated by the `performance_analysis` feature flag (default OFF) and the
  `cost.performance_frequency` setting (weekly/monthly). Piggybacks on the
  existing daily `/api/cron/generate` hit (self-gates via a persisted
  `performance_state.last_run_at`, so no separate EC2 cron entry is needed).
  Reads `page_views`-windowed traffic (last 90 days) + category/word-count/
  headline-length, asks the `performance` step for 2-5 actionable patterns,
  and writes them straight into `skill_notes` (already auto-injected into
  every writing prompt) — so the Writer/Topic Scout get smarter automatically.
  ⚠️ Uses internal page_views data only — the roadmap's GSC Search Analytics
  (clicks/impressions/position) integration is NOT built (needs a Search
  Console OAuth credential that doesn't exist yet); deferred.
  Note: `lib/insights.ts generateWeeklyInsights()` (Admin → Analytics manual
  "run now" report → `performance_insights` table) is a separate, older,
  human-facing feature — left untouched.

## 6d. Pages CMS + Authors admin — LIVE
- **Pages (`Admin → Pages`):** the footer/legal pages (About, Contact, Privacy,
  Terms, Disclaimer, Editorial Policy) are now rows in the `pages` table
  (slug/title/content-Markdown), not hardcoded TSX. Content is now in
  **English** (was hybrid Telugu). Admin can **edit** (title + Markdown body)
  and **delete** each page; slug is fixed (tied to the real route) so it can't
  be broken from the UI. Public routes (`app/(site)/{about,contact,privacy,
  terms,disclaimer,editorial-policy}/page.tsx`) fetch by slug via
  `lib/pages.ts` and render with the shared `<StaticPageView>` component
  (reuses `ArticleBody` for Markdown). The footer nav (`site-footer.tsx`) and
  `/page-sitemap.xml` now both read the live `pages` list instead of the old
  hardcoded `FOOTER_PAGES` const (removed) — delete a page and its footer
  link + sitemap entry disappear automatically; the route itself 404s.
- **Authors (`Admin → Authors`):** full CRUD (`lib/authors.ts`) — name, URL
  slug, bio, and **avatar photo** (upload to Storage or paste a URL) are all
  editable. The avatar now actually renders on the public site (article
  byline + `/author/[slug]` header) instead of only the static "తె" badge,
  which is now just the no-avatar fallback.
- Migration: `0008_pages.sql` (table + RLS + `touch_updated_at` trigger +
  English seed content for all 6 pages) — applied to the live project.

## 6e. NEWSROOM V3 "Verify Mode" (NEWSROOM_V3_SPEC.md) — BUILT 2026-07-02
The daily pipeline (`runPipeline`) is now the self-correcting V3 newsroom.
**Golden rule: an article publishes ONLY if (a) hard code validators pass AND
(b) Verify Mode passed with avg score ≥ 8; else it stays a draft with a
failure report.** On-demand `generateArticleForTopic` (MCP write/test) is
unchanged (always draft).
- **Stage 1 — Topic Scout + Dup Guard:** LLM niche filter (tech/AI only →
  `skipped_off_niche`); duplicate guard = pg_trgm `similar_published_titles`
  RPC (>0.45) + LLM semantic check vs 20 recent titles (→
  `skipped_duplicate`). Walks ranked choices until one passes.
- **Stage 2 — Researcher:** `lib/agent/factsTable.ts buildFactsTable()` —
  Gemini grounding + primary source → redirect URLs resolved server-side
  (vertexaisearch/news.google → real publisher URL; unresolvable = dropped)
  → strict facts-table JSON (facts/quotes/sources/india_angle). Stored in
  `pipeline_runs.facts_table`.
- **Stage 3 — Writer:** `writerV3Prompt` — outline-first with per-section word
  budgets, facts-table-only, ending_sentence generated first (must contain
  digit/proper noun), zero internal links, `flag_short` escape hatch.
  **max_tokens 8000** (Telugu ≈ 5-6x tokens/word — 2000 truncated at ~450
  words). Code-side word-count enforcement: <min_words → Fixer expands with
  UNUSED facts, max 2 attempts. Quality & Humanizer still runs after.
- **Stage 4 — Verify Mode** (`lib/agent/verify.ts`): Fact Checker + Language
  Editor + Discover Checker run in PARALLEL (strict JSON, temp 0), Fixer
  applies all issues in a full-flow rewrite, re-check, **max 3 loops**.
  Language Editor reads + extends the self-learning `banned_phrases` table.
  Discover Checker picks 0-2 internal links from same-category published
  candidates; code inserts them only if the anchor text exists in the body.
- **Stage 5 — Publish Gate:** article saved as DRAFT first, then hard
  validators (`lib/agent/validators.ts`, pure code): script purity (Telugu+
  Latin only — Arabic/Devanagari/etc. = fail), word count, slug format+typo
  (edit-distance-1 vs dictionary, catches "apdate"), sources present + no
  redirect-blacklist URLs, duplicate re-check (>0.6), internal links resolve,
  image ≥1200px (PNG/JPEG/WebP header parse) + Telugu alt, concrete ending.
  Publish only if validators + verify + `general.auto_publish` all pass; else
  draft + `failure_report` + WhatsApp notify (`lib/agent/notify.ts`, envs
  `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ADMIN_NUMBER`,
  Telegram fallback). Best-effort IndexNow ping (env `INDEXNOW_KEY` +
  `/indexnow-key.txt` route).
- **Per-agent configs (spec §11.5):** `agent_configs` table (10 agents:
  instructions/model_tier cheap|mid|best/enabled) + `skill_notes.agent_key`
  scoping. Prompt assembly: shared rules → agent instructions → scoped notes
  (`lib/agent/agentConfigs.ts`). Editable via admin panel AND 5 new MCP tools:
  `telugulo_list_agents`, `get_agent_config`, `update_agent_config[confirm]`,
  `toggle_agent`, `set_agent_model`; `add_skill_note` now takes `agent_key`.
  MCP `structuredContent` schema bug (arrays) fixed in `app/mcp/route.ts`.
- **Logging:** every run → `pipeline_runs` row (stage_logs with ms/word_count/
  output_tokens, facts_table, reviewer_scores+loops, hard_validator_results,
  final_status, failure_report). `agent_runs`/`agent_messages` still power the
  live animation.
- **Admin → AI Agent:** diagram now has a Verify ring (Fact Checker/Language
  Editor/Discover Checker/Fixer nodes), V3 runs table (Score avg, Loops,
  expandable failure report), global Auto-publish ON/OFF toggle, and a
  per-agent instructions/tier/enabled editor.
- ⚠️ New pipeline model steps (Admin → AI Settings): `niche_filter`,
  `dup_check`, `facts_extract`, `fact_check`, `language_edit`,
  `discover_check`, `fixer`.
- ⚠️ Spec §12 Phase 5 (regression dry-runs on the 10 known failures + 3 days
  of verify-without-publish) is an OPERATIONAL step still to do — flip
  Auto-publish OFF in Admin → AI Agent during tuning if desired.

## 7. Current settings (Supabase `settings` table, key/jsonb)
- `ai_models`: per-step provider+model. ⚠️ **Writing currently = `openai/gpt-4o-mini`** (cheapest) —
  a quality lever; bump to gpt-4.1 or gemini-2.5-pro via Admin → AI Settings or MCP `update_model`.
- `image_provider`: `dalle` (= gpt-image-1), **quality "low"** (~₹1.4/img) — set in `image.ts`
- `features`: article ON, image ON, telegram OFF, learning ON, performance OFF, ads OFF
- `general`: articles_per_day 1, **auto_publish TRUE**, publish_time 08:00
- `agent_instructions` (DB-driven rules), `research_settings` (4 sources, deep), `quality_rules`
  (600-900 words, facts_only ON, ban_ai_slop ON, self_check ON) — created on first MCP/UI write
- `site` (name/tagline/socials), `integrations` (GSC verified ✓; GA/AdSense not set)

## 8. Credentials (`api_keys` table, encrypted) — current
- ✅ `openai` (used for text + images via dalle→openai fallback)
- ✅ `gemini`
- ❌ not set: claude, imagen, dalle (uses openai), telegram_token, telegram_chat, adsense

## 9. Deployment (EC2 + Nginx + Cloudflare)
- **EC2:** Ubuntu 26.04, **IP `13.233.164.196`**, host `ec2-13-233-164-196.ap-south-1.compute.amazonaws.com`, user `ubuntu`
- **SSH key:** `MYPROJECT.pem` (in `Desktop/Telugulo/`, gitignored). Connect:
  `ssh -i MYPROJECT.pem ubuntu@ec2-13-233-164-196.ap-south-1.compute.amazonaws.com`
- **App:** `/home/ubuntu/telugulo-next` via **PM2** (`telugulo-next`, port 3000, auto-boot enabled)
- **Nginx:** reverse proxy 80/443 → 3000; HTTP→HTTPS redirect
- **SSL:** Let's Encrypt (certbot --nginx), auto-renews
- **Domain:** telugulo.in on **Cloudflare** (moved from Hostinger registrar). Apex A + `www` CNAME → `13.233.164.196`
- **Security Group:** ports 22, 80, 443 open
- **Env:** `.env.production` on EC2 (⚠️ **same ENCRYPTION_KEY as local** so encrypted keys decrypt)
- **Daily cron:** `30 2 * * * /home/ubuntu/telugulo-cron.sh` (8 AM IST; EC2 is UTC) → POSTs `http://127.0.0.1:3000/api/cron/generate/` (script reads CRON_SECRET at runtime)

## 10. Common tasks
**Run locally:** `cd telugulo-next && npm run dev` → http://localhost:3000
**Deploy an update:**
```bash
# local
git add -A && git commit -m "..." && git push origin main
# EC2
ssh -i MYPROJECT.pem ubuntu@ec2-13-233-164-196...   # then:
cd telugulo-next && git pull && npm run build && pm2 reload telugulo-next --update-env
```
(`npm install` only needed when deps change. `--update-env` re-reads `.env.production`.)
**Trigger generation now (on EC2):** `bash ~/telugulo-cron.sh`  (cost ~₹6-8)
**PM2:** `pm2 status` · `pm2 logs telugulo-next` · `pm2 reload telugulo-next`

## 11. Gotchas / important fixes (don't re-break these)
- **Image model:** use `gpt-image-1` (NOT `dall-e-3` — unavailable on this OpenAI account). No `response_format` param. Returns b64.
- **next/image + NAT64:** `images.dangerouslyAllowLocalIP: true` in next.config (local DNS resolves Supabase to `64:ff9b::`; safe — only Supabase host allowlisted).
- **trailingSlash:** all API POSTs need a trailing slash (e.g. `/api/cron/generate/`) — otherwise 308 redirect drops the POST.
- **EC2 install:** use `npm install` not `npm ci` (Windows lockfile misses Linux optional deps `@emnapi`/`@floating-ui`).
- **Integrations / head codes:** changes baked into static pages — need an EC2 rebuild OR Save via the LIVE admin (its action calls `revalidatePath`). In Integrations fields paste ONLY the value (e.g. `G-XXXX`), NOT the whole `<meta>`/`<script>` tag.
- **proxy.ts** is Next 16's renamed middleware (function `proxy`).
- **MCP:** connector URL needs the trailing slash before `?token=` (`/mcp/?token=…`). `MCP_AUTH_TOKEN` lives in `.env.production`; deploy MCP/env changes with `pm2 reload telugulo-next --update-env`.
- **Dev server:** don't `rm -rf .next` while `next dev` is running — it corrupts the Turbopack cache (500s / panic). Stop the dev server first, then build.
- **next/og (icons/OG):** Telugu glyphs need the bundled `src/app/_assets/NotoSansTelugu-700.woff` (Satori renders tofu otherwise). Don't delete it.
- **Sitemap:** canonical is `/sitemap_index.xml` (styled via `/sitemap.xsl`) — the old Next `sitemap.ts` was removed.

## 12. Costs (~₹200-250/month at 1 article/day)
- Image (gpt-image-1 low): ~₹1.4/img · Text (gpt-4o writing + mini steps): ~₹4-6/day
- Cheaper option: set Writing step model to `gpt-4o-mini` in Admin → AI Settings (~₹3/day total)

## 13. Remaining TODOs
- [ ] Cloudflare: switch A + www to **proxied (orange)** + SSL mode **Full (Strict)** for CDN/speed
- [ ] GA4: create property → Measurement ID `G-XXXX` → Admin → Integrations
- [ ] GSC: submit `sitemap_index.xml` + `news-sitemap.xml` + `stories-sitemap.xml` — **prerequisite for Google Discover**
- [ ] Google Publisher Center (News) — add RSS `https://telugulo.in/feed.xml`
- [ ] AdSense (after traffic) → publisher id in Integrations
- [ ] **Quality:** bump writing model off `gpt-4o-mini` (e.g. gpt-4.1 / gemini-2.5-pro) for better articles
- [ ] Site Settings: fill real social URLs (empty = hidden); MCP Phase C = ads + overview-agent tools
- [ ] Turn ON `performance_analysis` feature (Admin → Settings) once there's enough traffic history for the Performance agent to say something meaningful
- [ ] GSC Search Analytics API credential (OAuth) — needed to feed real clicks/impressions/position into the Performance agent (currently internal `page_views` only)
- [ ] (optional) Telegram bot for draft approval; make GitHub repo private

## 14. Session history (what was built, in order)
Phases 1-9 (foundation, admin, multi-provider AI, 7-step agent, review+Telegram,
public blog+SEO, analytics, ads, deploy config) → UI redesign to approved
blue-accent magazine mock → editorial serif typography → mobile nav → full SEO
suite (favicons, OG, manifest, news sitemap, WebSite/Org/Breadcrumb schema, 404)
→ Integrations page (GA/GSC/AdSense/head code) → featured-image management →
WYSIWYG (TipTap) editor → trailing slashes + Kalonji article migration →
auto-publish at 8 AM → image gen fixed to gpt-image-1 → **deployed to EC2 +
Cloudflare + SSL (LIVE)** → GSC verified → stricter writing rules → low-cost
images → **taazatime-style red magazine redesign** (public site) + తె favicon →
**admin upgrade**: page_views traffic analytics (Overview chart + today/yesterday
+ top articles), DB-driven **Site Settings** (name/tagline/socials), agent topic
dedupe + ## subheadings, brand-consistent admin UI → **real AMP Web Stories** +
stories sitemap → **advanced Ads** (AI copy + keyword targeting + image upload) →
article publish-time shown + **organic-only view counting** (skip owner/bots) →
**MCP control server** (`/mcp`, 13→20 tools, DB-driven agent instructions) →
**styled sitemap index** (`/sitemap_index.xml` + XSL) + admin post-time format →
related posts + removed AI-disclaimer/back-link → **AI Agent admin page** →
**DB-driven quality/research/model rules** + new MCP control tools →
**research FIX**: real live web search via **Gemini Google-Search grounding**
(replaced the broken Google-News-link fetch) → articles now have real facts
(dates/numbers/prices) with citations → **manual article creation** ("New (manual)"
blank draft) + **editable URL slug** in the editor → **CEO multi-agent system**:
named specialist agents (Topic Scout/Researcher/Writer/Quality & Humanizer/SEO/Image)
orchestrated by a CEO with full run+message logging (`agent_runs`/`agent_messages`),
shown live in Admin → AI Agent as an animated master/slave diagram; Quality &
Humanizer now auto-simplifies hard Telugu, SEO agent auto-fixes meta fields
→ **Advanced Roadmap Phase A/D1/B**: SEO agent now checks headline-body
alignment (auto-rewrites + logs `headline_mismatch`) and inserts 2-3 internal
links to related past articles; visible "Sources" block on article pages;
every CEO pipeline step retries once on a different AI provider before
failing the run; **Performance agent** wired up — reads `page_views` traffic
on a weekly/monthly cadence and feeds actionable patterns into `skill_notes`
automatically (`ADVANCED_ROADMAP.md` written the same day to track the rest)
→ **Pages CMS + Authors admin**: footer/legal pages moved from hardcoded TSX
to a DB-driven `pages` table (English content, edit/delete in Admin → Pages,
dynamic footer nav + sitemap); new Admin → Authors CRUD (name/slug/bio/avatar
photo, upload or URL) with the avatar now actually shown on the public site
→ **NEWSROOM V3 "Verify Mode"** (see §6e): self-correcting pipeline — niche
filter + duplicate guard, facts-table researcher with redirect resolution,
outline-first writer (max_tokens 8000 fix), 3 parallel reviewer agents +
Fixer loop (max 3), hard code validators as the publish gate, per-agent
configs + 5 new MCP tools, WhatsApp failure alerts, admin Verify-ring UI.

---
*Update this file as the project changes so a fresh session stays in sync.*
