import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export default {
  async fetch(req) {
    if (req.method === "OPTIONS")
      return new Response(null, { headers: cors(), status: 204 });

    if (req.method !== "POST")
      return json({ error: "POST only" }, 405);

    let body = {};
    try { body = await req.json(); } catch {}
    const question = (body.question || "").toString().trim();
    if (!question) return json({ error: "Missing 'question'" }, 400);

    try {
      const r = await client.responses.create({
        model: "gpt-4o-mini",
        instructions:
          "You are 'the Ghost' — a disembodied narrator trained on fragmented memories. Answer in ~100 words, polished and confident. General not local. No bullets/citations/meta.",
        input: [{ role: "user", content: `Question: ${question}` }],
        temperature: 0.7
      });
      return json({ text: (r.output_text || "").trim() }, 200);
    } catch (e) {
      console.error(e);
      return json({ error: "Upstream failure" }, 502);
    }
  }
};

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    ...extra
  };
}
function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: cors({ "Content-Type": "application/json" })
  });
}
