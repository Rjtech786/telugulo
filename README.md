# telugulo-next

AI tech-news blog platform for **telugulo.in** — Next.js 16 + Supabase.
Full spec: [`../PROJECT_SPEC.md`](../PROJECT_SPEC.md).

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- Supabase (dedicated project `ofusghtmlbhikrohtskm`, region ap-south-1) —
  DB + Auth + Storage
- Supabase Auth for the admin dashboard (`/admin`)

> The Supabase project is **separate** from the ApnaBot project — no shared
> data.

## Local setup

1. Install deps:

   ```bash
   npm install
   ```

2. `.env.local` is already created with the Supabase URL, anon key and an
   encryption key. Add the **service role key** (Supabase dashboard → telugulo
   project → Project Settings → API → `service_role`):

   ```
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

3. Create the admin login:

   ```bash
   node scripts/create-admin.mjs you@email.com yourpassword
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   - Public site: http://localhost:3000
   - Admin: http://localhost:3000/admin (redirects to `/login`)

## Database

Schema migration lives in [`supabase/migrations/`](supabase/migrations).
Tables: `articles`, `authors`, `settings`, `api_keys` (encrypted), `ads`,
`performance_insights`. RLS is on; only published articles / authors / active
ads are public. Everything else is server-only (service role).

## Build phases

All 9 phases (`PROJECT_SPEC.md §15`) are built:

1. **Foundation** — Next.js 16, Supabase, admin auth (`proxy.ts` guard)
2. **Admin dashboard** — encrypted credentials vault (+ Test), per-step AI
   model settings, feature toggles, cost control
3. **Multi-provider AI layer** — Claude / OpenAI / Gemini text, Imagen / DALL·E
   image (`src/lib/ai`)
4. **Agent pipeline** — 7-step daily workflow (`src/lib/agent`), hybrid Telugu,
   slug rules, image → Supabase Storage
5. **Article review** — drafts list, edit, publish/unpublish, Telegram approval
   (`/api/telegram/webhook`)
6. **Public blog** — home, `/[slug]`, categories, authors, NewsArticle/Person/
   Organization schema, `max-image-preview:large`, sitemap, RSS, mandatory
   pages, Telugu fonts
7. **Analytics** — GA4, Search Console verification, honest winner analysis
8. **Ads manager** — CRUD, category matching, click tracking
9. **Deploy** — `ecosystem.config.js`, `deploy/nginx.conf`, `DEPLOYMENT.md`,
   cron trigger (`/api/cron/generate`)

**To go live:** add API keys in Admin → Credentials, then Articles → *Generate
now*. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for EC2 + Cloudflare.
