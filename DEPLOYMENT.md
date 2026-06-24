# Deployment — EC2 + PM2 + Nginx + Cloudflare

Deploys **alongside** the existing n8n + telugulo-news-bot (separate folder,
port 3000, PM2 process). **Do not touch** those.

## 0. Prereqs on EC2
- Node 20.9+ (project built with Node 24), npm, git, nginx, pm2 (`npm i -g pm2`).

## 1. Code → EC2
```bash
cd /home/ubuntu
git clone <private-repo-url> telugulo-next
cd telugulo-next
npm ci
```

## 2. Env
```bash
cp .env.example .env.production
nano .env.production   # fill all values; NEXT_PUBLIC_SITE_URL=https://telugulo.in
```
Keep the **same** ENCRYPTION_KEY you used locally if you want existing encrypted
keys to decrypt; otherwise re-enter API keys in the dashboard.

## 3. Build + run
```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints (auto-start on reboot)
```
App is now on `127.0.0.1:3000`.

## 4. Nginx
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/telugulo
sudo ln -s /etc/nginx/sites-available/telugulo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 5. SSL (Let's Encrypt)
```bash
sudo certbot --nginx -d telugulo.in -d www.telugulo.in
```

## 6. Cloudflare
- DNS A record → EC2 IP, proxied (orange cloud).
- SSL/TLS mode: **Full (Strict)** — avoids redirect loops (spec §3).
- Enable CDN, caching, security.

## 7. Daily cron (article generation)
```bash
crontab -e
# 6:00 AM IST = 00:30 UTC
30 0 * * *  curl -s -X POST https://telugulo.in/api/cron/generate \
  -H "Authorization: Bearer $CRON_SECRET" >> /home/ubuntu/telugulo-cron.log 2>&1
```

## 8. Telegram webhook (draft approval buttons)
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://telugulo.in/api/telegram/webhook"
```

## 9. Migration safety (spec §14)
- **Phase 1:** point `new.telugulo.in` at this EC2; keep WordPress live on the
  apex.
- **Kalonji test:** migrate the Kalonji article at the same URL; watch Search
  Console ~1-2 weeks. If ~20/day traffic holds, proceed.
- **Phase 2:** switch `telugulo.in` DNS to Cloudflare → EC2. Migrate good
  WordPress posts (same URLs or 301 redirects).

## Updates (zero downtime)
```bash
git pull && npm ci && npm run build && pm2 reload telugulo-next
```
Settings/prompts change in the dashboard — no redeploy needed.

## Post-launch
- Google Search Console: verify (`NEXT_PUBLIC_GSC_VERIFICATION`) + submit
  `https://telugulo.in/sitemap.xml`.
- Google Publisher Center: register the site + RSS `https://telugulo.in/feed.xml`.
- Google Analytics: set `NEXT_PUBLIC_GA_ID`.
