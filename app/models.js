// Shared by the UI (renders the fields) and the API route (whitelists models + params).
// Field types: select | range | number | toggle | text. Schemas from fal's OpenAPI per endpoint.

const SIZES = {
  square_hd: "Square HD (1024²)",
  square: "Square (512²)",
  portrait_4_3: "Portrait 3:4",
  portrait_16_9: "Portrait 9:16",
  landscape_4_3: "Landscape 4:3",
  landscape_16_9: "Landscape 16:9",
};
const opts = (...v) => Object.fromEntries(v.map((x) => [x, x]));

const size = (d = "landscape_4_3") => ({ key: "image_size", label: "Image size", type: "select", options: SIZES, default: d });
const steps = (max, d) => ({ key: "num_inference_steps", label: "Inference steps", type: "range", min: 1, max, step: 1, default: d });
const guidance = (min = 1) => ({ key: "guidance_scale", label: "Guidance scale", type: "range", min, max: 20, step: 0.5, default: 3.5 });
const count = (max = 4) => ({ key: "num_images", label: "Images", type: "range", min: 1, max, step: 1, default: 1 });
const format = { key: "output_format", label: "Format", type: "select", options: { jpeg: "JPEG", png: "PNG" }, default: "jpeg" };
const accel = { key: "acceleration", label: "Acceleration", type: "select", options: { none: "None", regular: "Regular", high: "High" }, default: "none" };
const safety = { key: "safety_tolerance", label: "Safety tolerance (1 strict – 6 loose)", type: "select", options: opts("1", "2", "3", "4", "5", "6"), default: "2" };
const enhance = { key: "enhance_prompt", label: "Enhance prompt", type: "toggle", default: false };
const negative = { key: "negative_prompt", label: "Negative prompt", type: "text", default: "" };
const seed = { key: "seed", label: "Seed", type: "number", default: "" };

export const MODELS = {
  "fal-ai/flux/dev": {
    name: "FLUX.1 [dev]", kind: "image",
    fields: [size(), steps(50, 28), guidance(), count(), format, accel, seed],
  },
  "fal-ai/flux/schnell": {
    name: "FLUX.1 [schnell] · fast", kind: "image",
    fields: [size(), steps(12, 4), guidance(), count(), format, accel, seed],
  },
  "fal-ai/flux-pro/v1.1": {
    name: "FLUX1.1 [pro]", kind: "image",
    fields: [size(), count(), format, safety, enhance, seed],
  },
  "fal-ai/flux-pro/v1.1-ultra": {
    name: "FLUX1.1 [pro] ultra · 4MP", kind: "image",
    fields: [
      { key: "aspect_ratio", label: "Aspect ratio", type: "select", options: opts("21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"), default: "16:9" },
      count(), format, safety,
      { key: "raw", label: "Raw (less processed, more natural)", type: "toggle", default: false },
      enhance, seed,
    ],
  },
  "fal-ai/recraft/v3/text-to-image": {
    name: "Recraft V3", kind: "image",
    fields: [
      size("square_hd"),
      {
        key: "style", label: "Style", type: "select", default: "realistic_image",
        options: opts(
          "any", "realistic_image", "digital_illustration", "vector_illustration",
          "realistic_image/natural_light", "realistic_image/studio_portrait", "realistic_image/hdr", "realistic_image/retro_snapshot",
          "digital_illustration/pixel_art", "digital_illustration/hand_drawn", "digital_illustration/2d_art_poster", "digital_illustration/handmade_3d", "digital_illustration/child_book", "digital_illustration/pop_art",
          "vector_illustration/line_art", "vector_illustration/linocut", "vector_illustration/editorial", "vector_illustration/roundish_flat",
        ),
      },
    ],
  },
  "fal-ai/ideogram/v3": {
    name: "Ideogram V3 · great with text", kind: "image",
    fields: [
      size("square_hd"), count(8),
      { key: "rendering_speed", label: "Rendering speed", type: "select", options: { TURBO: "Turbo", BALANCED: "Balanced", QUALITY: "Quality" }, default: "BALANCED" },
      { key: "style", label: "Style", type: "select", options: { "": "Default", AUTO: "Auto", GENERAL: "General", REALISTIC: "Realistic", DESIGN: "Design" }, default: "" },
      { key: "enable_prompt_expansion", label: "Expand prompt", type: "toggle", default: true },
      negative, seed,
    ],
  },
  "fal-ai/stable-diffusion-v35-large": {
    name: "Stable Diffusion 3.5 Large", kind: "image",
    fields: [size(), steps(50, 28), guidance(0), count(), format, negative, seed],
  },
  "fal-ai/veo3/fast": {
    name: "Veo 3 Fast · video + audio", kind: "video",
    fields: [
      { key: "aspect_ratio", label: "Aspect ratio", type: "select", options: opts("16:9", "9:16"), default: "16:9" },
      { key: "duration", label: "Duration", type: "select", options: opts("4s", "6s", "8s"), default: "8s" },
      { key: "resolution", label: "Resolution", type: "select", options: opts("720p", "1080p"), default: "720p" },
      { key: "generate_audio", label: "Generate audio", type: "toggle", default: true },
      negative, seed,
    ],
  },
};

export const defaultsFor = (id) => Object.fromEntries(MODELS[id].fields.map((f) => [f.key, f.default]));

// Coerce/validate untrusted client values against the model's field defs. Unknown keys are dropped.
export function buildInput(id, prompt, values = {}) {
  const input = { prompt };
  for (const f of MODELS[id].fields) {
    const v = values[f.key];
    if (v === undefined || v === "" || v === null) continue;
    if (f.type === "select") { if (Object.hasOwn(f.options, v)) input[f.key] = v; }
    else if (f.type === "range") { if (Number.isFinite(+v)) input[f.key] = Math.min(f.max, Math.max(f.min, +v)); }
    else if (f.type === "number") { if (Number.isInteger(+v)) input[f.key] = +v; }
    else if (f.type === "toggle") input[f.key] = v === true || v === "true";
    else if (f.type === "text") input[f.key] = String(v).slice(0, 2000);
  }
  return input;
}
