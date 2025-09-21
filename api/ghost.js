import OpenAI from "openai";

// ----- CORS -----
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
    "You are 'the Ghost' — a disembodied narrator trained on fragmented memories. " +
    "Answer in ~100 words: polished, confident, slightly uncanny. Avoid bullets, links, citations, and meta commentary. " +
    "Keep it general (no local specifics), and write as a lyrical, unreliable memory.";

  try {
    const r = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      input: [
        { role: "system", content: system },
        { role: "user", content: question }
      ]
    });

    const text = (r.output_text || "").trim() || "The ghost is silent…";
    return json(res, 200, { text });
  } catch (e) {
    console.error("OpenAI error:", e?.response?.data || e?.message || e);
    const msg = e?.response?.data?.error?.message || e?.message || "OpenAI call failed";
    const code = e?.response?.status || 502;
    return json(res, code, { error: msg });
  }
}
