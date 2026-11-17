import { falKey, missingKey } from "../../lib/fal";

// Returns a signed fal storage URL; the browser PUTs the file straight to fal (bypasses Vercel's 4.5MB body limit).
export async function POST(req) {
  const key = falKey();
  if (!key) return missingKey();
  const { content_type, file_name } = await req.json().catch(() => ({}));
  if (!content_type || !file_name) return Response.json({ error: "content_type and file_name required." }, { status: 400 });
  const r = await fetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: String(content_type), file_name: String(file_name).slice(0, 200) }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return Response.json({ error: data.detail || `Upload init failed (${r.status})` }, { status: r.status });
  return Response.json({ upload_url: data.upload_url, file_url: data.file_url });
}
