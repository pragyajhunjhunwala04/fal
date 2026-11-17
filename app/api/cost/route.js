import { cost, falKey, missingKey, isAllowedModel } from "../../lib/fal";

export async function GET(req) {
  if (!falKey()) return missingKey();
  const { searchParams } = new URL(req.url);
  const model = searchParams.get("model");
  const id = searchParams.get("id");
  try {
    if (!id || !(await isAllowedModel(model))) return Response.json({ error: "Bad request." }, { status: 400 });
    return Response.json(await cost(model, id));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
