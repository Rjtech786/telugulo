/** IndexNow key file (Bing/Yandex instant indexing). Set INDEXNOW_KEY in env. */
export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("not configured", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain" } });
}
