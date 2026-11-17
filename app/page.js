"use client";
import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { MEDIA, catLabel, initialValue, toInput, findMedia } from "./lib/schema";

const call = async (url, init) => {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

async function upload(file) {
  const { upload_url, file_url } = await call("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: file.type || "application/octet-stream", file_name: file.name }),
  });
  const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return file_url;
}

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

// Google Images result links point at a web page; the real file is in the imgurl param.
function directUrl(s) {
  try {
    const u = new URL(s);
    return (/google\./.test(u.hostname) && u.searchParams.get("imgurl")) || s;
  } catch {
    return s;
  }
}

function Preview({ url, accept }) {
  const t = accept?.split("/")[0];
  if (t === "image") return <img src={url} alt="" className="thumb" />;
  if (t === "video") return <video src={url} className="thumb" muted />;
  if (t === "audio") return <audio src={url} controls />;
  return <a href={url} target="_blank" rel="noreferrer" className="hint">{url.split("/").pop()}</a>;
}

function FileField({ f, value, onChange, multiple }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const urls = multiple ? value : value ? [value] : [];
  async function pick(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setErr("");
    try {
      const up = await Promise.all(files.map(upload));
      onChange(multiple ? [...urls, ...up] : up[0]);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="file">
      <div className="filerow">
        <label className="btn small">
          {busy ? "Uploading…" : multiple ? "Add files" : "Upload"}
          <input type="file" accept={f.accept} multiple={multiple} onChange={pick} hidden disabled={busy} />
        </label>
        {!multiple && <input type="text" value={value} onChange={(e) => onChange(directUrl(e.target.value))} placeholder="…or paste a direct file URL" />}
      </div>
      {f.required && !urls.length && <span className="hint">This model needs this file. No file? Use a “text → …” model instead.</span>}
      {err && <span className="error small">{err}</span>}
      {urls.map((u, i) => (
        <div key={u + i} className="filepreview">
          <Preview url={u} accept={f.accept} />
          <button type="button" className="link" onClick={() => onChange(multiple ? urls.filter((_, j) => j !== i) : "")}>remove</button>
        </div>
      ))}
    </div>
  );
}

function Field({ f, value, onChange }) {
  const head = (
    <span className="fhead">
      {f.label}{f.required && <em>*</em>}
      {f.kind === "range" && <b>{value === "" ? "default" : value}</b>}
    </span>
  );
  const help = f.help && <small className="hint" title={f.help}>{f.help}</small>;
  if (f.kind === "toggle") {
    return (
      <label className="toggle">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{f.label}{help}</span>
      </label>
    );
  }
  let control;
  switch (f.kind) {
    case "select":
      control = (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {(!f.required || f.default == null) && <option value="">{f.default == null ? "— model default —" : "—"}</option>}
          {f.options.map((o) => <option key={o} value={o}>{String(o)}</option>)}
        </select>
      );
      break;
    case "size": {
      const custom = String(value).startsWith("{");
      control = (
        <>
          <select value={custom ? "__custom" : value} onChange={(e) => onChange(e.target.value === "__custom" ? f.example : e.target.value)}>
            <option value="">— model default —</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__custom">Custom…</option>
          </select>
          {custom && <textarea rows={2} className="mono" value={value} onChange={(e) => onChange(e.target.value)} />}
        </>
      );
      break;
    }
    case "range":
      control = (
        <div className="rangerow">
          <input type="range" min={f.min} max={f.max} step={f.step} value={value === "" ? f.default ?? f.min : value} onChange={(e) => onChange(e.target.value)} />
          <input type="number" min={f.min} max={f.max} step={f.step} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
      break;
    case "number":
      control = <input type="number" step={f.step} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.key === "seed" ? "random" : "default"} />;
      break;
    case "textarea":
      control = <textarea rows={f.key === "prompt" ? 5 : 2} value={value} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "file":
    case "files":
      control = <FileField f={f} value={value} onChange={onChange} multiple={f.kind === "files"} />;
      break;
    case "json":
      control = <textarea rows={3} className="mono" value={value} onChange={(e) => onChange(e.target.value)} placeholder="JSON (optional)" />;
      break;
    default:
      control = <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return <div className="field">{head}{help}{control}</div>;
}

function Output({ item, name }) {
  return (
    <figure>
      {item.type === "image" && <img src={item.url} alt="" width={item.width} height={item.height} />}
      {item.type === "video" && <video src={item.url} controls autoPlay loop playsInline />}
      {item.type === "audio" && <audio src={item.url} controls />}
      {item.type === "3d" && <model-viewer src={item.url} camera-controls auto-rotate style={{ width: "100%", height: 360 }} />}
      {item.type === "file" && <a className="filelink" href={item.url} target="_blank" rel="noreferrer">{item.file_name || item.url.split("/").pop()}</a>}
      <figcaption>
        <span>{item.width ? `${item.width}×${item.height}` : item.type}</span>
        <button className="btn small" onClick={() => download(item.url, name)}>Download ↓</button>
      </figcaption>
    </figure>
  );
}

export default function Home() {
  const [catalog, setCatalog] = useState([]);
  const [media, setMedia] = useState("image");
  const [cat, setCat] = useState("");
  const [query, setQuery] = useState("");
  const [model, setModel] = useState(null);
  const [fields, setFields] = useState(null);
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    call("/api/models").then(setCatalog).catch((e) => setError(e.message));
  }, []);

  const inMedia = useMemo(() => catalog.filter((m) => MEDIA[media].cats.includes(m.cat)), [catalog, media]);
  const list = useMemo(() => {
    const q = query.toLowerCase();
    return inMedia.filter((m) => (!cat || m.cat === cat) && (!q || `${m.name} ${m.id} ${m.desc}`.toLowerCase().includes(q)));
  }, [inMedia, cat, query]);

  // Default to the most popular text-only model in the tab (no input file needed).
  useEffect(() => {
    if (inMedia.length && !inMedia.some((m) => m.id === model?.id)) pick(inMedia.find((m) => m.cat.startsWith("text-to")) || inMedia[0]);
  }, [inMedia]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(m) {
    setModel(m);
    setFields(null);
    setError("");
    try {
      const fs = await call(`/api/schema?id=${encodeURIComponent(m.id)}`);
      setFields(fs);
      setValues(Object.fromEntries(fs.map((f) => [f.key, initialValue(f)])));
    } catch (e) {
      setError(e.message);
    }
  }

  async function generate(e) {
    e.preventDefault();
    if (loading || !fields) return;
    setError("");
    let input;
    try {
      input = toInput(fields, values);
    } catch (x) {
      return setError(x.message);
    }
    setLoading(true);
    setStatus("Submitting…");
    try {
      const { request_id } = await call("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.id, input }),
      });
      const start = Date.now();
      let r;
      do {
        await new Promise((ok) => setTimeout(ok, 2000));
        r = await call(`/api/generate?model=${encodeURIComponent(model.id)}&id=${encodeURIComponent(request_id)}`);
        const secs = Math.round((Date.now() - start) / 1000);
        setStatus(r.status === "IN_QUEUE" ? `In queue${r.queue_position != null ? ` (#${r.queue_position + 1})` : ""} · ${secs}s` : `Generating · ${secs}s`);
      } while (r.status !== "COMPLETED");
      setResult({ data: r.data, media: findMedia(r.data), model });
    } catch (x) {
      setError(x.message);
    } finally {
      setLoading(false);
    }
  }

  const cats = MEDIA[media].cats.filter((c) => inMedia.some((m) => m.cat === c));

  return (
    <main>
      <Script type="module" src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js" strategy="lazyOnload" />
      <header>
        <h1>fal playground</h1>
        <p>{catalog.length ? `${catalog.length} models` : "Loading models…"}</p>
      </header>

      <nav className="tabs">
        {Object.entries(MEDIA).map(([k, v]) => (
          <button key={k} className={k === media ? "on" : ""} onClick={() => { setMedia(k); setCat(""); setQuery(""); }}>
            {v.label}
            <span>{catalog.filter((m) => v.cats.includes(m.cat)).length || ""}</span>
          </button>
        ))}
      </nav>

      <div className="grid">
        <div className="col">
          <section className="panel picker">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${MEDIA[media].label.toLowerCase()} models…`} />
            {cats.length > 1 && (
              <div className="chips">
                <button className={!cat ? "on" : ""} onClick={() => setCat("")}>All</button>
                {cats.map((c) => <button key={c} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>{catLabel(c)}</button>)}
              </div>
            )}
            <ul className="models">
              {list.map((m) => (
                <li key={m.id}>
                  <button className={m.id === model?.id ? "on" : ""} onClick={() => pick(m)} title={m.desc}>
                    <span className="mname">{m.name}</span>
                    <span className="tag">{catLabel(m.cat)}</span>
                  </button>
                </li>
              ))}
              {!list.length && <li className="hint pad">No models match.</li>}
            </ul>
          </section>

          <form onSubmit={generate} className="panel">
            {model && (
              <div className="modelhead">
                <strong>{model.name}</strong> <span className="tag">{catLabel(model.cat)}</span>
                <small className="hint" title={model.desc}>{model.desc}</small>
                <a className="hint" href={`https://fal.ai/models/${model.id}`} target="_blank" rel="noreferrer">{model.id} ↗</a>
              </div>
            )}
            {!fields && !error && <p className="hint">Loading options…</p>}
            {fields?.map((f) => (
              <Field key={model.id + f.key} f={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
            ))}
            {fields && (
              <>
                <button className="btn primary" disabled={loading}>{loading ? "Generating…" : "Generate"}</button>
                <button type="button" className="btn ghost" onClick={() => setValues(Object.fromEntries(fields.map((f) => [f.key, initialValue(f)])))}>
                  Reset settings
                </button>
              </>
            )}
          </form>
        </div>

        <section className="panel output">
          {error && <p className="error">{error}</p>}
          {loading && <div className="shimmer"><span>{status}{media !== "image" && <><br />This can take a few minutes</>}</span></div>}
          {!loading && !result && !error && <p className="empty">Results will appear here.</p>}
          {!loading && result && (
            <>
              <div className="images">
                {result.media.map((x, i) => (
                  <Output key={x.url + i} item={x} name={x.file_name || `fal-${result.data.seed ?? Date.now()}-${i}.${x.url.split("?")[0].split(".").pop()}`} />
                ))}
              </div>
              {!result.media.length && <p className="hint">No media in the response — see raw output below.</p>}
              <p className="meta">
                {result.model.name}
                {result.data.seed != null && <> · seed {result.data.seed}</>}
                {result.data.seed != null && "seed" in values && (
                  <button className="link" onClick={() => setValues((s) => ({ ...s, seed: String(result.data.seed) }))}>reuse seed</button>
                )}
              </p>
              <details>
                <summary className="hint">Raw response</summary>
                <pre>{JSON.stringify(result.data, null, 2)}</pre>
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
