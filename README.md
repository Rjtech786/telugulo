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

See `PROJECT_SPEC.md §15`. **Phase 1 (Foundation)** is done: Next.js +
Supabase + admin auth. Next up: Phase 2 (admin dashboard — credentials vault &
AI settings).
