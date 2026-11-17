import { fal } from "@fal-ai/client";
import { falKey, missingKey, isAllowedModel, fields } from "../../lib/fal";

// Uses fal's queue: POST submits and returns a request id, GET polls it. No request stays open for minutes,
// so slow video models don't hit Vercel's function timeout.

const fail = (e) =>
  Response.json({ error: e.body?.detail ? JSON.stringify(e.body.detail) : e.message }, { status: e.status || 500 });

function auth() {
  const key = falKey();
  if (!key) return missingKey();
  fal.config({ credentials: key });
}

export async function POST(req) {
  const err = auth();
  if (err) return err;
  const b = await req.json().catch(() => ({}));
  try {
    if (!(await isAllowedModel(b.model))) return Response.json({ error: "Unknown model." }, { status: 400 });
    // Only forward keys the model's schema declares; fal validates the values themselves.
    const allowed = new Set((await fields(b.model)).map((f) => f.key));
    const input = Object.fromEntries(Object.entries(b.input || {}).filter(([k]) => allowed.has(k)));
    const { request_id } = await fal.queue.submit(b.model, { input });
    return Response.json({ request_id });
  } catch (e) {
    return fail(e);
  }
}

export async function GET(req) {
  const err = auth();
  if (err) return err;
  const { searchParams } = new URL(req.url);
  const model = searchParams.get("model");
  const requestId = searchParams.get("id");
  if (!model || !requestId) return Response.json({ error: "Bad request." }, { status: 400 });

  try {
    if (!(await isAllowedModel(model))) return Response.json({ error: "Unknown model." }, { status: 400 });
    const { status, queue_position } = await fal.queue.status(model, { requestId });
    if (status !== "COMPLETED") return Response.json({ status, queue_position });
    const { data } = await fal.queue.result(model, { requestId });
    return Response.json({ status, data });
  } catch (e) {
    return fail(e);
  }
}
