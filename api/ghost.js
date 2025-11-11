// /api/ghost.js
import OpenAI from "openai";

/* ----- CORS (same as you had) ----- */
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
async function readRaw(req){ return new Promise(r => { let d=""; req.on("data",c=>d+=c); req.on("end",()=>r(d)); req.on("error",()=>r("")); }); }

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });

  const debug = (req.url || "").includes("debug=1");

  if (!process.env.OPENAI_API_KEY) return json(res, 500, { error: "OPENAI_API_KEY not set on server" });

  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await readRaw(req) || "{}"); } catch { body = {}; }
  }
  const question = (body?.question || "").toString().trim();
  if (!question) return json(res, 400, { error: "Missing 'question'" });

  if (debug) {
    return json(res, 200, {
      ok: true,
      gotQuestion: question.length > 0,
      hasKey: !!process.env.OPENAI_API_KEY,
      node: process.version,
      envModel: process.env.OPENAI_MODEL || null,
      ts: new Date().toISOString()
    });
  }

  const system =
    "You are a neutral, factual assistant. Answer concisely in plain prose (2–5 sentences). " +
    "Avoid figurative or poetic language. No lists, no links, no meta commentary. " +
    "If unsure, say what is uncertain. Do not invent details.";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // === FIX: declare text upfront ===
  let text = "";

  // 12s safety timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);

  try {
    if (client.responses && typeof client.responses.create === "function") {
      // New Responses API
      const r = await client.responses.create(
        {
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          max_output_tokens: 200,
          input: [
            { role: "system", content: system },
            { role: "user", content: question }
          ]
        },
        { signal: ctrl.signal }              // correct place for AbortController
      );
      text = (r.output_text || "").trim();
    } else {
      // Fallback for older SDKs
      const r = await client.chat.completions.create(
        {
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 200,
          messages: [
            { role: "system", content: system },
            { role: "user", content: question }
          ]
        },
        { signal: ctrl.signal }
      );
      text = (r?.choices?.[0]?.message?.content || "").trim();
    }

    if (!text) text = "The ghost is silent…";
    return json(res, 200, { text });
  } catch (e) {
    console.error("OpenAI error:", e?.response?.data || e?.message || e);
    const msg = e?.response?.data?.error?.message || e?.message || "OpenAI call failed";
    const code = Number(e?.response?.status) || 502;
    return json(res, code, { error: msg });
  } finally {
    clearTimeout(timer);
  }
}
