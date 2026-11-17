// node models.test.mjs  — checks spec→form conversion against live fal specs for a few tricky models.
import assert from "node:assert";
import { fieldsFromOpenapi, initialValue, toInput, findMedia } from "./app/lib/schema.js";

const spec = async (id) => (await (await fetch(`https://api.fal.ai/v1/models?endpoint_id=${id}&expand=openapi-3.0`)).json()).models[0].openapi;
const by = (fs) => Object.fromEntries(fs.map((f) => [f.key, f]));

const kling = by(fieldsFromOpenapi(await spec("fal-ai/kling-video/v2.1/master/image-to-video")));
assert.strictEqual(kling.image_url.kind, "file");
assert.strictEqual(kling.image_url.accept, "image/*");
assert.strictEqual(kling.duration.kind, "select");
assert.strictEqual(kling.cfg_scale.kind, "range");

const sdFields = fieldsFromOpenapi(await spec("fal-ai/stable-diffusion-v35-large"));
const sd = by(sdFields);
assert.strictEqual(sd.image_size.kind, "size");
assert.strictEqual(sd.loras.kind, "json");
assert.strictEqual(sd.sync_mode, undefined);
assert.strictEqual(sdFields[0].key, "prompt");

const vals = Object.fromEntries(sdFields.map((f) => [f.key, initialValue(f)]));
const input = toInput(sdFields, { ...vals, prompt: "fox", image_size: '{"width":640,"height":480}', seed: "7" });
assert.deepStrictEqual(input.image_size, { width: 640, height: 480 });
assert.strictEqual(input.seed, 7);
assert.strictEqual(input.loras, undefined); // empty default omitted
assert.throws(() => toInput(sdFields, { loras: "{bad" }), /valid JSON/);

const m = findMedia({ images: [{ url: "https://x/a.png" }], video: { url: "https://x/b.mp4" }, audio_url: "https://x/c.mp3", seed: 1 });
assert.deepStrictEqual(m.map((x) => x.type), ["image", "video", "audio"]);
console.log("ok");

// cost estimates
import { estimateCost } from "./app/lib/schema.js";
assert.strictEqual(estimateCost({ unit: "images", unit_price: 0.025 }, {}, {}, [{ type: "image" }, { type: "image" }]).total, 0.05);
assert.strictEqual(estimateCost({ unit: "seconds", unit_price: 0.1 }, {}, { duration: "8s" }, [{ type: "video" }]).total, 0.8);
assert.strictEqual(estimateCost({ unit: "megapixels", unit_price: 0.02 }, {}, {}, [{ type: "image", width: 2000, height: 1000 }]).total, 0.04);
assert.strictEqual(estimateCost({ unit: "gpu-hours", unit_price: 1 }, {}, {}, []), null);
assert.strictEqual(estimateCost({ unit: "1000 characters", unit_price: 0.08 }, {}, { text: "x".repeat(500) }, [{ type: "audio" }]).total, 0.04);
console.log("cost ok");
