import { fal } from "@fal-ai/client";
import { MODELS, buildInput } from "../../models";

// FAL_KEY is read from env automatically (server-side only, never sent to the browser).
// Video models can take a few minutes; 300s is the Vercel Hobby max.
export const maxDuration = 300;

export async function POST(req) {
  // Tolerate common paste mistakes in the env value: whitespace/newlines, quotes, a leading "FAL_KEY=" or "Key ".
  const key = (process.env.FAL_KEY || "").trim().replace(/^FAL_KEY=/, "").replace(/^["']|["']$/g, "").replace(/^Key\s+/i, "").trim();
  if (!key) {
    return Response.json({ error: "FAL_KEY is not set. Add it to .env (local) or Vercel env vars." }, { status: 500 });
  }
  fal.config({ credentials: key });
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || "").trim();
  if (!prompt) return Response.json({ error: "Prompt is required." }, { status: 400 });
  if (!Object.hasOwn(MODELS, b.model)) return Response.json({ error: "Unknown model." }, { status: 400 });

  try {
    const { data } = await fal.subscribe(b.model, { input: buildInput(b.model, prompt, b.values) });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.body?.detail ? JSON.stringify(e.body.detail) : e.message }, { status: e.status || 500 });
  }
}
