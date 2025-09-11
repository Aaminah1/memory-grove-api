// api/ghost.js
import OpenAI from "openai";

export default async function handler(req, res) {
  // CORS
  const ORIGIN = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Guard: missing key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set on server" });
  }

  const question = (req.body?.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "Missing 'question'" });

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
    // Surface details while debugging
    console.error("Ghost error:", e);
    const msg = e?.response?.data?.error?.message || e?.message || "Upstream failure";
    const code = e?.response?.status || 502;
    return res.status(code).json({ error: msg });
  }
}
