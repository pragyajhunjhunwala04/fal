// Pure helpers shared by the UI and the API: media groups, and fal OpenAPI → form fields.

export const MEDIA = {
  image: { label: "Image", cats: ["text-to-image", "image-to-image"] },
  video: { label: "Video", cats: ["text-to-video", "image-to-video", "video-to-video", "audio-to-video"] },
  audio: { label: "Audio", cats: ["text-to-speech", "text-to-audio", "audio-to-audio", "speech-to-speech", "video-to-audio"] },
  "3d": { label: "3D", cats: ["text-to-3d", "image-to-3d", "3d-to-3d"] },
  world: { label: "World", cats: ["worlds"] },
};
export const ALLOWED_CATS = new Set(Object.values(MEDIA).flatMap((m) => m.cats));
export const catLabel = (c) => (c === "worlds" ? "world model" : c.replace("-to-", " → ").replace("3d", "3D"));

const HIDDEN = new Set(["sync_mode"]); // returns base64 data URIs instead of URLs; not useful here

// Field kinds: select | toggle | range | number | text | textarea | file | files | json | size (enum + custom JSON)
export function fieldsFromOpenapi(openapi) {
  const schemas = openapi.components.schemas;
  const deref = (s) => {
    while (s?.$ref) {
      const { $ref, ...rest } = s;
      s = { ...schemas[$ref.split("/").pop()], ...rest };
    }
    return s;
  };
  const post = Object.values(openapi.paths).find((p) => p.post?.requestBody)?.post;
  const input = deref(post.requestBody.content["application/json"].schema);
  const required = new Set(input.required || []);
  const order = input["x-fal-order-properties"] || Object.keys(input.properties);
  const keys = [...new Set([...order, ...Object.keys(input.properties)])].filter((k) => input.properties[k] && !HIDDEN.has(k));

  const fields = keys.map((key) => {
    let p = deref(input.properties[key]);
    const meta = { key, label: p.title || key, help: (p.description || "").replace(/\s+/g, " ").trim(), required: required.has(key), default: p.default };
    if (p.anyOf) {
      const variants = p.anyOf.map(deref).filter((v) => v.type !== "null");
      const en = variants.find((v) => v.enum);
      if (variants.length === 1) p = { ...variants[0], ...p, anyOf: undefined };
      else if (en && variants.length === 2 && variants.some((v) => v.type === "object" || v.properties)) {
        const obj = variants.find((v) => v !== en);
        const example = Object.fromEntries(Object.entries(obj.properties || {}).map(([k, v]) => [k, v.default ?? null]));
        return { ...meta, kind: "size", options: en.enum, example: JSON.stringify(example) };
      } else return { ...meta, kind: "json" };
    }
    if (p.enum) return { ...meta, kind: "select", options: p.enum };
    if (p.type === "boolean") return { ...meta, kind: "toggle" };
    if (p.type === "integer" || p.type === "number") {
      const int = p.type === "integer";
      const min = p.minimum ?? p.exclusiveMinimum, max = p.maximum ?? p.exclusiveMaximum;
      if (Number.isFinite(min) && Number.isFinite(max)) {
        const span = max - min;
        return { ...meta, kind: "range", min, max, step: int ? 1 : span <= 1 ? 0.01 : span <= 20 ? 0.1 : 1 };
      }
      return { ...meta, kind: "number", step: int ? 1 : "any" };
    }
    if (p.type === "string") {
      if (/_url$/.test(key) || p.format === "uri") return { ...meta, kind: "file", accept: acceptFor(key) };
      if (/prompt|text|lyrics|script/.test(key) || (p.maxLength ?? 0) > 200) return { ...meta, kind: "textarea" };
      return { ...meta, kind: "text" };
    }
    if (p.type === "array" && deref(p.items)?.type === "string" && /_urls$/.test(key)) return { ...meta, kind: "files", accept: acceptFor(key) };
    return { ...meta, kind: "json" };
  });
  // Inputs (required/prompts/files) first, settings after; stable within each group.
  const isInput = (f) => f.required || f.kind === "file" || f.kind === "files" || /prompt/.test(f.key);
  return [...fields.filter(isInput), ...fields.filter((f) => !isInput(f))];
}

function acceptFor(key) {
  if (/video/.test(key)) return "video/*";
  if (/audio|speech|voice|music/.test(key)) return "audio/*";
  if (/image|mask|photo|face|style|start|end|first|last|reference/.test(key)) return "image/*";
  return "";
}

// Initial UI value for a field (strings for inputs, arrays for files, booleans for toggles).
export function initialValue(f) {
  const d = f.default;
  if (f.kind === "toggle") return d ?? false;
  if (f.kind === "files") return Array.isArray(d) ? d : [];
  if (f.kind === "json") return d == null || (Array.isArray(d) && !d.length) ? "" : JSON.stringify(d, null, 1);
  if (f.kind === "size") return d == null ? "" : typeof d === "object" ? JSON.stringify(d) : d;
  return d == null ? "" : String(d);
}

// UI values → fal input. Empty values are omitted so the model uses its own default. Throws on bad JSON.
export function toInput(fields, values) {
  const input = {};
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (f.kind === "toggle") input[f.key] = !!v;
    else if (f.kind === "range" || f.kind === "number") input[f.key] = Number(v);
    else if (f.kind === "json" || (f.kind === "size" && String(v).startsWith("{"))) {
      try { input[f.key] = JSON.parse(v); } catch { throw new Error(`"${f.label}" is not valid JSON`); }
    } else input[f.key] = v;
  }
  return input;
}

// Collect every fal File-like {url} or *_url string in a result, tagged with how to display it.
export function findMedia(data) {
  const out = [];
  const walk = (x, key = "") => {
    if (Array.isArray(x)) return x.forEach((y) => walk(y, key));
    if (x && typeof x === "object") {
      if (typeof x.url === "string") return out.push({ ...x, type: mediaType(x.url, x.content_type) });
      return Object.entries(x).forEach(([k, v]) => walk(v, k));
    }
    if (typeof x === "string" && /^https?:\/\//.test(x) && /url/.test(key)) out.push({ url: x, type: mediaType(x) });
  };
  walk(data);
  return out;
}

export function mediaType(url, ct = "") {
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  if (ct.startsWith("image/") || /^(png|jpe?g|webp|gif|avif)$/.test(ext)) return "image";
  if (ct.startsWith("video/") || /^(mp4|webm|mov|m4v)$/.test(ext)) return "video";
  if (ct.startsWith("audio/") || /^(mp3|wav|ogg|m4a|flac|aac)$/.test(ext)) return "audio";
  if (/gltf|glb/.test(ct) || /^(glb|gltf)$/.test(ext)) return "3d";
  return "file";
}
