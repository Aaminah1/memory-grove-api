// pages/api/ghost.js
import OpenAI from "openai";

export const config = { runtime: "nodejs" }; // force Node runtime

const ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function setCORS(req, res) {
  const reqOrigin = req.headers.origin || "";
  const allow = ORIGINS.length
    ? (ORIGINS.includes(reqOrigin) ? reqOrigin : ORIGINS[0])
    : (reqOrigin || "*");
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).end(JSON.stringify(payload));
}
async function readRaw(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}
const withTimeout = (p, ms=18000) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), ms))]);

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });

  if (!process.env.OPENAI_API_KEY) {
    return json(res, 500, { error: "OPENAI_API_KEY not set on server" });
  }

  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await readRaw(req) || "{}"); } catch { body = {}; }
  }

  const question = (body?.question || "").toString().trim();
  if (!question) return json(res, 400, { error: "Missing 'question'" });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system =
    "You are a neutral, factual assistant. Answer concisely in plain prose (2–5 sentences). " +
    "Avoid figurative or poetic language. No lists, no links, no meta commentary. " +
    "If unsure, say what is uncertain. Do not invent details.";

  try {
    const r = await withTimeout(client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      max_output_tokens: 200,
      frequency_penalty: 0.2,
      presence_penalty: 0.0,
      input: [
        { role: "system", content: system },
        { role: "user", content: question }
      ]
    }), 18000);

    const text = (r.output_text || "").trim() || "The ghost is silent…";
    return json(res, 200, {
      text,
      meta: {
        mode: "neutral",
        model: r.model || (process.env.OPENAI_MODEL || "gpt-4o-mini"),
        temperature: 0.2,
        ts: new Date().toISOString()
      }
    });
  } catch (e) {
    const status = Number(e?.response?.status) || 502;
    const errMsg = e?.response?.data?.error?.message || e?.message || "OpenAI call failed";
    console.error("Ghost error:", { status, errMsg });
    return json(res, status, { error: errMsg, kind: e?.name || "Error" });
  }
}
