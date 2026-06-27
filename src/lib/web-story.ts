import "server-only";
import type { PublicArticle } from "@/lib/public";
import { SITE, categoryLabel } from "@/lib/site";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Markdown → plain text, split into paragraphs. */
function toParagraphs(body: string): string[] {
  const plain = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s*/gm, "") // heading markers
    .replace(/[*_`>]/g, "") // bold/italic/code/quote marks
    .replace(/\r/g, "");
  return plain
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

/** Group paragraphs into at most `maxPages` slides of ~`budget` chars each. */
function toSlides(paras: string[], maxPages = 4, budget = 300): string[] {
  const slides: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && (cur.length + p.length > budget || slides.length >= maxPages - 1)) {
      slides.push(cur);
      cur = "";
      if (slides.length >= maxPages) break;
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur && slides.length < maxPages) slides.push(cur);
  return slides.slice(0, maxPages);
}

const AMP_BOILERPLATE =
  `<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>` +
  `<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>`;

const STORY_CSS = `
amp-story{font-family:'Noto Sans Telugu','Hind',system-ui,-apple-system,sans-serif}
amp-story-grid-layer.shade{background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,.05) 75%)}
.wrap{padding:34px 28px 46px;display:flex;flex-direction:column;justify-content:flex-end}
.kicker{align-self:flex-start;color:#fff;background:#d11919;padding:4px 11px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:.3px;margin-bottom:14px;text-transform:uppercase}
.title{color:#fff;font-size:30px;line-height:1.28;font-weight:800;margin:0;text-shadow:0 2px 12px rgba(0,0,0,.55)}
.para{color:#fff;font-size:21px;line-height:1.55;font-weight:500;margin:0;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.brand{color:#fff;opacity:.8;font-size:14px;font-weight:600;margin-top:16px}
`;

function imgLayer(img: string): string {
  return `<amp-story-grid-layer template="fill"><amp-img src="${esc(img)}" layout="fill"></amp-img></amp-story-grid-layer>`;
}

/** Build a valid AMP Web Story (amp-story 1.0) for an article. */
export function buildStoryHtml(a: PublicArticle): string {
  const storyUrl = `${SITE.url}/web-stories/${a.slug}/`;
  const articleUrl = `${SITE.url}/${a.slug}/`;
  const image = a.image_url || `${SITE.url}/opengraph-image`;
  const logo = `${SITE.url}/apple-icon/`;
  const cat = categoryLabel(a.category);
  const desc = a.meta_description || a.summary || a.title;

  const slides = toSlides(toParagraphs(a.body || a.summary || ""));

  const coverPage = `<amp-story-page id="cover">
${imgLayer(image)}
<amp-story-grid-layer template="vertical" class="shade wrap">
<span class="kicker">${esc(cat)}</span>
<h1 class="title">${esc(a.title)}</h1>
<div class="brand">${esc(SITE.name)}</div>
</amp-story-grid-layer>
</amp-story-page>`;

  const contentPages = slides
    .map(
      (text, i) => `<amp-story-page id="p${i + 1}">
${imgLayer(image)}
<amp-story-grid-layer template="vertical" class="shade wrap">
${text
  .split("\n\n")
  .map((p) => `<p class="para">${esc(p)}</p>`)
  .join("\n")}
</amp-story-grid-layer>
</amp-story-page>`,
    )
    .join("\n");

  const lastPage = `<amp-story-page id="more">
${imgLayer(image)}
<amp-story-grid-layer template="vertical" class="shade wrap">
<h1 class="title">${esc(a.title)}</h1>
<div class="brand">పూర్తి కథనం కోసం swipe up చేయండి ↑</div>
</amp-story-grid-layer>
<amp-story-page-attachment layout="nodisplay" theme="dark" cta-text="పూర్తి కథనం చదవండి" href="${esc(articleUrl)}"></amp-story-page-attachment>
</amp-story-page>`;

  return `<!doctype html>
<html amp lang="te">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
<link rel="canonical" href="${esc(storyUrl)}">
<title>${esc(a.title)} — ${esc(SITE.name)}</title>
<meta name="description" content="${esc(desc)}">
<script async src="https://cdn.ampproject.org/v0.js"></script>
<script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>
${AMP_BOILERPLATE}
<style amp-custom>${STORY_CSS}</style>
</head>
<body>
<amp-story standalone
  title="${esc(a.title)}"
  publisher="${esc(SITE.name)}"
  publisher-logo-src="${esc(logo)}"
  poster-portrait-src="${esc(image)}">
${coverPage}
${contentPages}
${lastPage}
</amp-story>
</body>
</html>`;
}
