# telugulo.in — Advanced Roadmap (CEO Agent System v2)

> Goal: a fully automatic newsroom where the CEO + specialist agents produce
> articles that Google actually wants to rank and recommend (Search +
> Discover) — with zero daily human intervention. This builds on the CEO
> multi-agent system already live (see `PROJECT_STATUS.md` §6a).

**Written:** 2026-07-01

---

## 0. Where we already stand

- CEO orchestrator + 6 named agents (Topic Scout, Researcher, Writer, Quality
  & Humanizer, SEO, Image), all logged live in Admin → AI Agent
  (`agent_runs`/`agent_messages`).
- Facts-only writing (Gemini live web search grounding), hybrid-Telugu
  humanizing, auto-fixed SEO meta fields, sitemaps + GSC verified.
- Runs daily at 8 AM, fully automatic, auto-publishes.

Everything below assumes this foundation and adds on top of it.

## 1. Why this roadmap is shaped the way it is (2026 Google reality)

Google shipped a **dedicated Google Discover Core Update in February 2026**
that specifically rewards **E-E-A-T** (Experience, Expertise, Authority,
Trust), **topical authority** (a site that consistently covers one beat
deeply, not scattershot), and now runs a **classifier that detects
headline-content misalignment** — clickbait-y headlines that don't match the
body get suppressed even if the body is accurate. Discover also has hard
technical requirements: images **≥1200px wide** + `max-image-preview:large`.
Google does **not** support IndexNow (only Bing/Yandex do) — for Google,
speed comes from sitemaps + selective use of the Indexing API, and Google
**warned in May 2025 against abusing the Indexing API** for normal articles
(it's officially for job postings/livestreams only) — so we should NOT
auto-ping it for every article; that can look spammy and backfire.

Sources: [Content Ranking Factors For Google Discover (2026 Guide)](https://clickmedialab.com/blog/google-discover-content-ranking-factors/), [Google's February 2026 Discover Core Update](https://www.coremountainmedia.com/insights/google-discover-core-update-2026), [Google Discover Guidelines Update 2026](https://hilandseo.com/google-discover-guidelines-update-2026/), [Does Google Support IndexNow in 2026? No](https://pressonify.ai/blog/indexnow-instant-indexing-press-releases-2026), [Indexing API Quickstart — Google Search Central](https://developers.google.com/search/apis/indexing-api/v3/quickstart), [Getting Indexed Faster By Google: 2026](https://www.trysight.ai/blog/getting-indexed-faster-by-google)

That means the roadmap has to optimize for **trust + depth + topical focus +
headline honesty**, not just technical indexing speed.

---

## Phase A — Google-ranking foundation (do this first, highest leverage)

**1. Headline-body alignment check (new SEO-agent rule). — ✅ DONE (2026-07-01)**
`seoAuditPrompt` now explicitly checks headline-vs-body alignment and
rewrites the headline if it overpromises; pipeline logs a `headline_mismatch`
fix note to the CEO feed when it fires. See `PROJECT_STATUS.md` §6a/6c.

**2. E-E-A-T signals on every page. — PARTIAL (Sources block done 2026-07-01)**
- ✅ `source_urls` now shown as a visible "మూలాలు (Sources)" block near the
  bottom of each article (hidden if none have a URL).
- ⬜ Deepen the author bio, editorial standards line, last-updated timestamp
  on revised articles.
- ⬜ Visible "correction/update" note when `reviseDraft` changes a published
  article after the fact.

**3. Image requirements for Discover. — ✅ CONFIRMED (2026-07-01, no code change needed)**
`gpt-image-1` already generates 1536×1024 (`lib/ai/image.ts`, well over
1200px wide) and `max-image-preview:large` is already set in the robots meta
(`app/layout.tsx`).

**4. Structured data agent. — mostly already in place**
`app/(site)/[slug]/page.tsx` already emits `NewsArticle` + `BreadcrumbList`
JSON-LD (headline, image, datePublished/dateModified, author, publisher).
Not re-verified/extended further in this pass (`dateModified` currently
mirrors `datePublished` even after edits — future refinement, low priority).

**5. Internal linking agent (folds into SEO agent). — ✅ DONE (2026-07-01)**
The SEO step now queries up to 8 recent published articles in the same
category and asks the agent to insert 2-3 contextual internal links
(`[anchor](/slug/)`) into the body when there's a genuine topical fit.

**6. Indexing discipline.**
Do NOT auto-call the Indexing API per article (Google's own May-2025 warning
against non-job/livestream abuse). Keep relying on sitemap pings (already
automatic) + let Google crawl naturally. Optionally use URL Inspection
"request indexing" manually, sparingly, only for exceptional breaking news.

---

## Phase B — Learning loop (the system gets smarter on its own)

**1. Wire up the (already-scaffolded) Performance Analysis agent. — ✅ DONE (2026-07-01), internal data only**
`lib/agent/performance.ts runPerformanceAnalysis()` — gated by
`performance_analysis` (still OFF by default) + `cost.performance_frequency`
(weekly/monthly), piggybacked on the existing daily cron (self-gates via a
persisted last-run timestamp, no new EC2 cron entry). Reads `page_views`
windowed traffic (90d) + category/word-count/headline-length. ⬜ GSC Search
Analytics API (clicks/impressions/position) NOT integrated — needs a Search
Console OAuth credential that doesn't exist yet; deferred.

**2. Feed insights back automatically. — ✅ DONE (2026-07-01)**
The Performance agent's findings are inserted directly into `skill_notes`
(2-5 per run) — already auto-injected into every writing prompt — so the
Writer/CEO get smarter on the configured cadence without any code change,
just data. (Note: the older, separate `lib/insights.ts generateWeeklyInsights()`
— an owner-triggered "run now" report shown in Admin → Analytics — is
untouched and still writes to `performance_insights` for human reading only.)

**3. Topic Scout uses performance history, not just recency.**
Today Topic Scout only dedupes against recent titles. Extend `selectionPrompt`
to also weigh categories/angles that have historically performed well from
the Performance agent's report.

**4. Freshness/update passes.**
For evolving stories (prices, ongoing sagas), let the CEO periodically
re-visit an older published article and issue a small factual update via
`reviseDraft`, bumping `dateModified` — Google rewards demonstrably
maintained content.

---

## Phase C — Grow the agent team

**1. Fact-Checker agent.**
Before publish, cross-verify the 2-3 most load-bearing facts (numbers,
quotes, dates) against a second independent search, not just the primary
research pass — directly strengthens Trustworthiness (the "T" in E-E-A-T)
and catches the rare hallucination that slips past Quality & Humanizer.

**2. Social Distributor agent.**
Auto-post to Telegram channel (infrastructure partially exists —
`telegram_notifications` today only pings the owner for draft review; extend
it to also auto-post to a public channel on publish) and optionally
WhatsApp Channel. More distribution → more direct traffic + engagement
signals, which indirectly help Discover.

**3. Ads Agent (already scaffolded, currently OFF).**
Turn on once there's real traffic — the DB/AI-copy pipeline already exists
(`ads` table, `adCopyPrompt`), just needs the placement decision logic and a
toggle flip.

---

## Phase D — Reliability & cost governance (needed for "fully automatic, zero babysitting")

**1. Retry/fallback instead of hard-fail. — ✅ DONE (2026-07-01)**
`lib/ai/index.ts runStepWithFallback()` — if the configured provider throws,
retries once on a different provider that has a key configured (e.g. Claude
fails → Gemini). Wired into every CEO-pipeline text step (chunaav, angle,
writing, quality_check, seo_check, ceo verdict) via a local `step()` helper
in `runPipeline()` that also logs the fallback to the CEO message feed.

**2. Cost governor.**
CEO checks `cost.monthly_budget` (already a setting) vs. running spend
(`get_cost` MCP tool logic) before each run; if close to budget, auto-drop to
cheaper models for that day and note it in the CEO verdict, instead of
silently overspending or erroring.

**3. Owner alerting on repeated failure.**
If 2-3 runs in a row end in `skipped`/`error`, send a Telegram alert to the
owner — "fully automatic" still needs a tripwire so problems don't run
silent for a week.

---

## Phase E — Scale once the above is stable

- Bump to 2 articles/day (`articles_per_day` setting already supports it) —
  only after Phase A-D are solid, since more low-quality volume actively
  hurts topical authority.
- Consider a second language edition (Hindi/English) later — separate
  roadmap, not urgent.

---

## Suggested build order

1. ✅ Phase A items 1, 2, 5 (headline-alignment + sources block + internal
   linking) — cheapest, highest Google-ranking impact, extends the SEO agent
   we already built. **Shipped 2026-07-01.**
2. ✅ Phase D item 1 (retry/fallback) — makes the existing system actually
   bulletproof for "fully automatic." **Shipped 2026-07-01.**
3. ✅ Phase B items 1-2 (performance agent + skill_notes feedback) — the real
   "self-improving" piece. **Shipped 2026-07-01, internal `page_views` data
   only** — GSC API credential setup is still a prerequisite for the
   clicks/impressions/position half of this.
4. Phase C item 1 (fact-checker) — trust hardening. Not started.
5. Everything else as traffic/budget allow.

---

*This is a living roadmap — check items off / edit as they ship, same as
`PROJECT_STATUS.md`.*
