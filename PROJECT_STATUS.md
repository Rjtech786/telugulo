# telugulo.in — Project Status & Handoff

> Single source of truth. Read this first in a new session to know the full
> state. (No secrets here — repo is public. Real secrets live in `.env.local`
> locally and `.env.production` on the EC2.)

**Last updated:** 2026-06-26 · **Owner:** Roshan (roshanjameer8786@gmail.com)

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
- **Tables:** `articles`, `authors`, `settings`, `api_keys` (AES-256-GCM encrypted), `ads`, `performance_insights`
- **Storage bucket:** `article-images` (public)
- **Migrations:** `supabase/migrations/` (0001 schema, 0002 view-counter)
- RLS on: only published articles / authors / active ads are public; rest is server-only (service role)

## 5. Key code structure
```
src/
  app/
    (site)/            public blog: page (home), [slug], category, author, about/privacy/etc.
    admin/             dashboard: AdminShell (sidebar), page (overview), articles, settings,
                       credentials, integrations, analytics, ads, articles/[id] (editor)
    api/cron/generate  daily trigger (POST, Bearer CRON_SECRET)
    api/telegram/webhook, api/views
    sitemap.ts, robots.ts, feed.xml, news-sitemap.xml, manifest.ts, icon/apple-icon/opengraph-image
    proxy.ts           auth guard for /admin (Next 16 renamed middleware→proxy)
  lib/
    ai/                text.ts, image.ts, index.ts (runStep/runImage, key fallback dalle→openai)
    agent/             pipeline.ts (7-step), prompts.ts (WRITING RULES), sources.ts (RSS), slug.ts, telegram.ts
    crypto.ts          AES-256-GCM for api_keys
    supabase/          client.ts, server.ts, admin.ts (service role)
    settings.ts, api-keys.ts, articles.ts, public.ts, config.ts, site.ts, auth.ts
  components/          rich-editor (TipTap), article-card, article-body, site-header/footer, icons, thumb, site-head
```

## 6. AI agent pipeline (`src/lib/agent/pipeline.ts`)
7 steps: **Discovery** (RSS feeds) → **Selection** → **Research** (fetch+trim) →
**Angle** → **Write** → **Image** (gpt-image-1 → Supabase) → **Self-critique** →
save (auto-publish if enabled).

**Writing rules (`prompts.ts` `WRITING_RULES`)** — owner's 8 strict rules, enforced
in the write step AND the self-check step: (1) no generic ending, (2) break up
buzzword lists, (3) no forced local angle, (4) facts from source only / no
hallucination, (5) one analytical "why this matters" sentence, (6) vary sentence
length, (7) hybrid spoken Telugu (tech words in English), (8) no repetition.

## 7. Current settings (Supabase `settings` table)
- `ai_models`: every step **OpenAI**. Writing = `gpt-4o`; all other steps = `gpt-4o-mini` (cheap)
- `image_provider`: `dalle` (= gpt-image-1), **quality "low"** (~₹1.4/img) — set in `image.ts`
- `features`: article ON, image ON, telegram OFF, learning ON, performance OFF, ads OFF
- `general`: articles_per_day 1, **auto_publish TRUE**, publish_time 08:00
- `integrations`: GSC verification set (verified ✓). GA/AdSense not set yet.

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
cd telugulo-next && git pull && npm install && npm run build && pm2 reload telugulo-next
```
**Trigger generation now (on EC2):** `bash ~/telugulo-cron.sh`  (cost ~₹6-8)
**PM2:** `pm2 status` · `pm2 logs telugulo-next` · `pm2 reload telugulo-next`

## 11. Gotchas / important fixes (don't re-break these)
- **Image model:** use `gpt-image-1` (NOT `dall-e-3` — unavailable on this OpenAI account). No `response_format` param. Returns b64.
- **next/image + NAT64:** `images.dangerouslyAllowLocalIP: true` in next.config (local DNS resolves Supabase to `64:ff9b::`; safe — only Supabase host allowlisted).
- **trailingSlash:** all API POSTs need a trailing slash (e.g. `/api/cron/generate/`) — otherwise 308 redirect drops the POST.
- **EC2 install:** use `npm install` not `npm ci` (Windows lockfile misses Linux optional deps `@emnapi`/`@floating-ui`).
- **Integrations / head codes:** changes baked into static pages — need an EC2 rebuild OR Save via the LIVE admin (its action calls `revalidatePath`). In Integrations fields paste ONLY the value (e.g. `G-XXXX`), NOT the whole `<meta>`/`<script>` tag.
- **proxy.ts** is Next 16's renamed middleware (function `proxy`).

## 12. Costs (~₹200-250/month at 1 article/day)
- Image (gpt-image-1 low): ~₹1.4/img · Text (gpt-4o writing + mini steps): ~₹4-6/day
- Cheaper option: set Writing step model to `gpt-4o-mini` in Admin → AI Settings (~₹3/day total)

## 13. Remaining TODOs
- [ ] Cloudflare: switch A + www to **proxied (orange)** + SSL mode **Full (Strict)** for CDN/speed
- [ ] GA4: create property → Measurement ID `G-XXXX` → Admin → Integrations
- [ ] GSC: submit `sitemap.xml` + `news-sitemap.xml`
- [ ] Google Publisher Center (News) — add RSS `https://telugulo.in/feed.xml`
- [ ] AdSense (after traffic) → publisher id in Integrations
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
images.

---
*Update this file as the project changes so a fresh session stays in sync.*
