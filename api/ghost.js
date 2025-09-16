// api/ghost.js
import OpenAI from "openai";

// allow one or many origins via env
const ALLOWED = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

export default async function handler(req, res) {
  // ----- CORS -----
  const reqOrigin = req.headers.origin || "";
  const allow = ALLOWED.includes(reqOrigin) ? reqOrigin : (ALLOWED.length === 1 ? ALLOWED[0] : "");
  if (allow) {
    res.setHeader("Access-Control-Allow-Origin", allow);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  // ----- Method guard -----
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // ----- Key guard -----
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set on server" });
  }

  // ----- Parse JSON body (works even if req.body is undefined) -----
  let body = req.body;
  if (!body || typeof body !== "object") {
    try {
      const raw = await readRaw(req);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
  }
  const question = (body?.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "Missing 'question'" });

  // ----- Call OpenAI -----
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      instructions:
        "You are 'the Ghost' — a disembodied narrator trained on fragmented memories. Answer in ~100 words, polished and confident. Prefer generalities; no bullets, citations, or meta.",
      input: [{ role: "user", content: `Question: ${question}` }],
      temperature: 0.7
    });
    return res.status(200).json({ text: (r.output_text || "").trim() });
  } catch (e) {
    // Surface the real reason so you can fix it fast
    console.error("Ghost error:", e);
    const msg =
      e?.response?.data?.error?.message ||
      e?.message ||
      "Upstream failure";
    const code = e?.response?.status || 502;
    return res.status(code).json({ error: msg });
  }
}

function readRaw(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}
