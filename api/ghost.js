import OpenAI from "openai";

const ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function setCORS(req, res) {
  const reqOrigin = req.headers.origin || "";
  const allow = ORIGINS.length ? (ORIGINS.includes(reqOrigin) ? reqOrigin : ORIGINS[0]) : (reqOrigin || "*");
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function json(res, status, payload){ res.setHeader("Content-Type","application/json"); res.status(status).end(JSON.stringify(payload)); }
async function readRaw(req){ return new Promise(r=>{ let d=""; req.on("data",c=>d+=c); req.on("end",()=>r(d)); req.on("error",()=>r("")); }); }

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // allow GET for debug=1 (so it doesn’t 405)
  const url = new URL(req.url, `http://${req.headers.host||'localhost'}`);
  if (req.method === 'GET' && url.searchParams.get('debug') === '1') {
    return json(res, 200, {
      ok: true,
      hasKey: !!process.env.OPENAI_API_KEY,
      envModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      node: process.version,
      ts: new Date().toISOString()
    });
  }

  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  if (!process.env.OPENAI_API_KEY) return json(res, 500, { error: "OPENAI_API_KEY not set on server" });

  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await readRaw(req) || "{}"); } catch { body = {}; }
  }
  const question = (body?.question || "").toString().trim();
  if (!question) return json(res, 400, { error: "Missing 'question'" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system =
      "You are a neutral, factual assistant. Answer concisely in plain prose (2–5 sentences). " +
      "Avoid figurative or poetic language. No lists, no links, no meta commentary. " +
      "If unsure, say what is uncertain. Do not invent details.";

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    const r = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      max_output_tokens: 200,
      input: [
        { role: "system", content: system },
        { role: "user", content: question }
      ],
      signal: ctrl.signal
    });
    clearTimeout(timer);

    const text = (r.output_text || "").trim() || "The ghost is silent…";
    return json(res, 200, { text });

  } catch (e) {
    console.error("OpenAI error:", e?.response?.data || e?.message || e);
    const msg  = e?.response?.data?.error?.message || e?.message || "OpenAI call failed";
    const code = Number(e?.response?.status) || 502;
    return json(res, code, { error: msg });
  }
}
