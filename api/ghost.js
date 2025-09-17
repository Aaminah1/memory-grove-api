const ALLOWED = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const HF_MODEL = process.env.HF_MODEL || "google/gemma-2b-it";

export default async function handler(req, res) {
  // CORS
  const reqOrigin = req.headers.origin || "";
  const allow = ALLOWED.includes(reqOrigin) ? reqOrigin : (ALLOWED.length === 1 ? ALLOWED[0] : "");
  if (allow) {
    res.setHeader("Access-Control-Allow-Origin", allow);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.HF_API_TOKEN) return res.status(500).json({ error: "HF_API_TOKEN not set on server" });

  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await readRaw(req) || "{}"); } catch { body = {}; }
  }
  const question = (body?.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "Missing 'question'" });

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
      return res.status(hfRes.status).json({ error: msg });
    }

    let text =
      (Array.isArray(data) && data[0]?.generated_text) ||
      (typeof data === "object" && data?.generated_text) ||
      (typeof data === "string" ? data : "") || "";

    if (!text) text = "The ghost is silent…";
    text = stripEcho(text, prompt);

    return res.status(200).json({ text: text.trim() });
  } catch (e) {
    console.error("HF call error:", e);
    return res.status(502).json({ error: "Hugging Face call failed" });
  }
}

function readRaw(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

function stripEcho(generated, prompt) {
  if (generated.startsWith(prompt)) return generated.slice(prompt.length);
  return generated.replace(/^User:[\s\S]*?Ghost:\s*/i, "");
}
