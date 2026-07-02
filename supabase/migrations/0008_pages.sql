-- Footer/legal pages (About, Contact, Privacy, Terms, Disclaimer, Editorial
-- Policy) — now DB-driven so the admin can edit/delete them (Admin -> Pages)
-- instead of hardcoded TSX. Content is Markdown, rendered with the same
-- ArticleBody component used for articles. Content below is in English.
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pages enable row level security;
-- No anon/authenticated policies: admin-only (service role), same as
-- `settings`/`api_keys`. Public routes read it server-side via the admin
-- client (same pattern as getSiteSettings()).

drop trigger if exists pages_touch_updated_at on public.pages;
create trigger pages_touch_updated_at
before update on public.pages
for each row execute function public.touch_updated_at();

insert into public.pages (slug, title, content) values
('about', 'About Us', $md$telugulo.in is a technology and AI news platform built for Telugu-speaking readers. Our goal is to bring the latest updates on technology, gadgets, apps, and artificial intelligence in a simple, easy-to-read style, every day.

Our articles are researched and drafted with the help of AI tools, but every article is reviewed by a human editor before it is published. Accuracy, clarity, and local relevance matter to us.

## Our focus

- AI & technology news, written for Telugu readers
- Smartphone, app, and gadget reviews & updates
- Angles relevant to India and Telugu-speaking readers

Have a question? [Get in touch](/contact).$md$),

('contact', 'Contact Us', $md$If you have any questions, feedback, or a correction to report, please get in touch. We try to respond as quickly as we can.

**Email:** roshanjameer8786@gmail.com

*(The owner may update these details later.)*$md$),

('privacy', 'Privacy Policy', $md$telugulo.in ("we", "us") respects your privacy. This policy explains what data we collect and how we use it. It has been written with India's Digital Personal Data Protection (DPDP) Act in mind.

## Data we collect

- Analytics data (pages visited, device, approximate location) — to improve the site.
- Details you submit through the contact form (name, email, message).

## Cookies & ads

We may use cookies for analytics. Third-party advertising partners (e.g. Google AdSense) may use cookies to show ads. You can disable cookies through your browser settings.

## Your rights

You may ask us to access, correct, or delete your personal data. [Contact us](/contact) to do so.$md$),

('disclaimer', 'Disclaimer', $md$The content on telugulo.in is provided for informational and educational purposes only. We strive for accuracy, but we cannot guarantee that any piece of information is 100% complete or up to date.

Articles on this site are **AI-assisted** and are reviewed by a **human editor** before publishing. Even so, please verify independently before making any purchase, financial, or technical decision based on what you read here.

External links may lead to third-party sites outside our control — we are not responsible for their content.$md$),

('terms', 'Terms of Service', $md$By using telugulo.in, you agree to these terms. The content is our property, for personal, non-commercial use only. Do not copy or republish content without our permission.

## Content usage

We reserve the right to update, modify, or remove content at any time. You are responsible for any decisions you make based on information provided on this site.

## Liability

telugulo.in is not liable for any loss arising from the use of this site. Content is provided on an "as is" basis.$md$),

('editorial-policy', 'Editorial Policy', $md$At telugulo.in, accuracy, transparency, and reader trust are our top priorities.

## AI transparency

Our articles are researched and drafted with the help of AI tools. Every article is fact-checked, edited, and approved by a human editor before publishing. No article goes live without review.

## Sources & originality

We take facts from other sources but do not copy content — every article is written originally in Telugu. We reference sources where possible.

## Corrections

If you notice a mistake, please [contact us](/contact) — we'll correct it quickly.$md$)

on conflict (slug) do nothing;
