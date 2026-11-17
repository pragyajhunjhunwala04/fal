// node models.test.mjs
import assert from "node:assert";
import { MODELS, buildInput, defaultsFor } from "./app/models.js";

const i = buildInput("fal-ai/flux/dev", "fox", { num_inference_steps: "999", seed: "42", image_size: "evil", hack: 1, output_format: "png" });
assert.deepStrictEqual(i, { prompt: "fox", num_inference_steps: 50, seed: 42, output_format: "png" });
assert.strictEqual(buildInput("fal-ai/veo3/fast", "x", { generate_audio: false }).generate_audio, false);
assert.strictEqual(buildInput("fal-ai/ideogram/v3", "x", { style: "" }).style, undefined);
for (const id in MODELS) buildInput(id, "x", defaultsFor(id)); // defaults are all valid
console.log("ok");
