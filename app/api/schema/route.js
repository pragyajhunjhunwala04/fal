import { fields, isAllowedModel } from "../../lib/fal";

export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (!(await isAllowedModel(id))) return Response.json({ error: "Unknown model." }, { status: 400 });
    return Response.json(await fields(id));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
