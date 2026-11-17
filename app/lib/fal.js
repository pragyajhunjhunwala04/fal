// Server-only fal helpers: credentials, catalog, per-model schema.
import { ALLOWED_CATS, fieldsFromOpenapi } from "./schema";

const API = "https://api.fal.ai/v1/models";
const DAY = 86400;

export function falKey() {
  // Tolerate common paste mistakes in the env value: whitespace/newlines, quotes, a leading "FAL_KEY=" or "Key ".
  return (process.env.FAL_KEY || "").trim().replace(/^FAL_KEY=/, "").replace(/^["']|["']$/g, "").replace(/^Key\s+/i, "").trim();
}

export function missingKey() {
  // Diagnostics only: names/lengths, never values.
  const seen = Object.keys(process.env).filter((k) => /fal/i.test(k)).map((k) => `${k}(${process.env[k].length})`).join(", ") || "none";
  const where = `env=${process.env.VERCEL_ENV || "local"} commit=${(process.env.VERCEL_GIT_COMMIT_SHA || "?").slice(0, 7)}`;
  return Response.json({ error: `FAL_KEY is not set. Add it to .env (local) or Vercel env vars. [${where}; FAL vars seen: ${seen}]` }, { status: 500 });
}

// Platform API fetch: cached for a day, sends the key when present (higher rate limit), retries 429s with backoff.
async function api(qs, path = "") {
  const key = falKey();
  for (let i = 0; ; i++) {
    const r = await fetch(`${API}${path}?${qs}`, { headers: key ? { Authorization: `Key ${key}` } : {}, next: { revalidate: DAY } });
    if (r.status !== 429 || i === 4) {
      if (!r.ok) throw new Error(`fal models API ${r.status}`);
      return r.json();
    }
    await new Promise((ok) => setTimeout(ok, 500 * 2 ** i));
  }
}

// Public catalog, cached for a day. Only active inference models in the media categories we render.
export async function catalog() {
  const models = [];
  let cursor = "";
  do {
    const d = await api(`limit=100&status=active${cursor && `&cursor=${cursor}`}`);
    for (const m of d.models) {
      const md = m.metadata || {};
      if (md.kind === "training" || !ALLOWED_CATS.has(md.category)) continue;
      models.push({ id: m.endpoint_id, name: md.display_name || m.endpoint_id, cat: md.category, desc: md.description || "" });
    }
    cursor = d.has_more ? d.next_cursor : "";
  } while (cursor);
  return models;
}

export async function isAllowedModel(id) {
  return (await catalog()).some((m) => m.id === id);
}

export async function fields(id) {
  const openapi = (await api(`endpoint_id=${encodeURIComponent(id)}&expand=openapi-3.0`)).models?.[0]?.openapi;
  if (!openapi) throw new Error("This model has no published schema.");
  return fieldsFromOpenapi(openapi);
}

// Cost of one finished request. Exact billed cost needs a key with billing permission (BILLING/FULL preset)
// and may lag a few seconds; otherwise returns the model's unit price for the client to estimate from.
export async function cost(model, requestId) {
  const key = falKey();
  const r = await fetch(`${API}/billing-events?request_id=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Key ${key}` },
    cache: "no-store",
  });
  if (r.ok) {
    const ev = (await r.json()).billing_events?.[0];
    if (ev) return { exact: true, total: ev.cost_total, quantity: ev.quantity, unit: ev.unit, unit_price: ev.unit_price, currency: "USD" };
  }
  const p = (await api(`endpoint_id=${encodeURIComponent(model)}`, "/pricing")).prices?.[0];
  if (!p) return { exact: false, unknown: true, billing: r.status };
  return { exact: false, unit: p.unit, unit_price: p.unit_price, currency: p.currency, billing: r.status };
}
