"use client";
import { useState } from "react";
import { MODELS, defaultsFor } from "./models";

const FIRST = Object.keys(MODELS)[0];

async function download(url, name) {
  try {
    const blob = await (await fetch(url)).blob();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank"); // CORS fallback: open so it can be saved manually
  }
}

function Field({ f, value, onChange }) {
  if (f.type === "toggle") {
    return (
      <label className="toggle">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {f.label}
      </label>
    );
  }
  return (
    <label>
      <span>{f.label} {f.type === "range" && <b>{value}</b>}</span>
      {f.type === "select" && (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {Object.entries(f.options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {f.type === "range" && <input type="range" min={f.min} max={f.max} step={f.step} value={value} onChange={(e) => onChange(e.target.value)} />}
      {f.type === "number" && <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="random" />}
      {f.type === "text" && <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="things to avoid" />}
    </label>
  );
}

export default function Home() {
  const [model, setModel] = useState(FIRST);
  const [prompt, setPrompt] = useState("");
  const [values, setValues] = useState(defaultsFor(FIRST));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const m = MODELS[model];

  function pickModel(id) {
    setModel(id);
    setValues(defaultsFor(id));
  }

  async function generate(e) {
    e.preventDefault();
    if (loading || !prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, values }),
      });
      const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult({ ...data, kind: m.kind, media: data.images || (data.video ? [data.video] : []) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header>
        <h1>fal <span>playground</span></h1>
        <p>{m.name} · text → {m.kind}</p>
      </header>

      <div className="grid">
        <form onSubmit={generate} className="panel">
          <label>
            <span>Model</span>
            <select value={model} onChange={(e) => pickModel(e.target.value)}>
              {Object.entries(MODELS).map(([id, x]) => <option key={id} value={id}>{x.name}</option>)}
            </select>
          </label>

          <label>
            <span>Prompt</span>
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && generate(e)}
              placeholder="a red fox in the snow, cinematic lighting"
              required
            />
          </label>

          {m.fields.map((f) => (
            <Field key={model + f.key} f={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
          ))}

          <button disabled={loading || !prompt.trim()}>{loading ? "Generating…" : "Generate ✦"}</button>
          <button type="button" className="ghost" onClick={() => setValues(defaultsFor(model))}>Reset settings</button>
        </form>

        <section className="panel output">
          {error && <p className="error">{error}</p>}
          {loading && <div className="shimmer">{m.kind === "video" && <span>Video can take 1–3 minutes…</span>}</div>}
          {!loading && !result && !error && <p className="empty">Your {m.kind}s will appear here.</p>}
          {!loading && result && (
            <>
              <div className="images">
                {result.media.map((x, i) => (
                  <figure key={x.url}>
                    {result.kind === "video"
                      ? <video src={x.url} controls autoPlay loop playsInline />
                      : <img src={x.url} alt={prompt} width={x.width} height={x.height} />}
                    <figcaption>
                      <span>{x.width ? `${x.width}×${x.height}` : result.kind}</span>
                      <button onClick={() => download(x.url, x.file_name || `fal-${result.seed ?? Date.now()}-${i}.${x.url.split("?")[0].split(".").pop()}`)}>
                        Download ↓
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              {result.seed != null && (
                <p className="meta">
                  seed {result.seed}
                  {result.timings?.inference != null && ` · ${result.timings.inference.toFixed(2)}s`}
                  {"seed" in values && (
                    <button className="link" onClick={() => setValues({ ...values, seed: String(result.seed) })}>reuse seed</button>
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
