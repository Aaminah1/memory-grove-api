// ----- CORS -----
const ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function setCORS(req, res) {
  const reqOrigin = req.headers.origin || "";
  // If you configured a list, allow the exact match or the first in the list.
  // If not configured, fall back to the requesting origin or '*'.
  const allow = ORIGINS.length
    ? (ORIGINS.includes(reqOrigin) ? reqOrigin : ORIGINS[0])
    : (reqOrigin || "*");

  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCORS(req, res);// api/ghost.js
// Robust CORS + HF call with clear errors

const ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const HF_MODEL = process.env.HF_MODEL || "google/gemma-2b-it";

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

async function readRaw(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

function json(res, status, payload) {
  // ensure CORS headers are present on ALL responses
  res.setHeader("Content-Type", "application/json");
  res.status(status).end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  // Set CORS headers right away
  setCORS(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "POST only" });
  }

  if (!process.env.HF_API_TOKEN) {
    return json(res, 500, { error: "HF_API_TOKEN not set on server" });
  }

  // Parse body (works on Vercel)
  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await readRaw(req) || "{}"); } catch { body = {}; }
  }
  const question = (body?.question || "").toString().trim();
  if (!question) return json(res, 400, { error: "Missing 'question'" });

  const prompt =
`You are 'the Ghost' — a confident but shallow narrator, stitched from broken memories.
Answer the user's question in ~80-120 words, poetic and polished.
Avoid bullets, citations, links, or meta commentary.

User: ${question}
Ghost:`;

  try {
    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`
        },
        body: JSON.stringify({
          inputs: prompt,
          options: { wait_for_model: true },
          parameters: {
            max_new_tokens: 180,
            temperature: 0.8,
            top_p: 0.95,
            do_sample: true,
            repetition_penalty: 1.1
          }
        })
      }
    );

    const raw = await hfRes.text();
    let data; try { data = JSON.parse(raw); } catch { data = raw; }

    if (!hfRes.ok) {
      const msg = typeof data === "string"
        ? `${hfRes.status} ${hfRes.statusText}: ${data.slice(0, 500)}`
        : data?.error || `${hfRes.status} ${hfRes.statusText}`;
      return json(res, hfRes.status, { error: msg });
    }

    let text =
      (Array.isArray(data) && data[0]?.generated_text) ||
      (typeof data === "object" && data?.generated_text) ||
      (typeof data === "string" ? data : "") || "";

    if (!text) text = "The ghost is silent…";

    // strip possible prompt echo
    if (text.startsWith(prompt)) text = text.slice(prompt.length);
    text = text.replace(/^User:[\s\S]*?Ghost:\s*/i, "");

    return json(res, 200, { text: text.trim() });
  } catch (e) {
    console.error("HF call error:", e);
    return json(res, 502, { error: "Hugging Face call failed" });
  }
}

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    // still return CORS headers on errors
    return res.status(405).json({ error: "POST only" });
  }

  // For now, just bounce a fake response to prove POST works end-to-end.
  // (We re-enable Hugging Face once POST is confirmed.)
  return res.status(200).json({ text: `Ghost hears: ${question}` });
}
