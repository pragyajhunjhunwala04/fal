import { catalog } from "../../lib/fal";

export async function GET() {
  try {
    return Response.json(await catalog());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
