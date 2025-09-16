// api/ghost.js — Hugging Face version (free tier)
const ALLOWED = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// Pick a small instruct model on HF's free tier.
// You can swap to: "mistralai/Mistral-7B-Instruct-v0.2" or "tiiuae/falcon-7b-instruct"
const HF_MODEL = process.env.HF_MODEL || "google/gemma-2b-it";

export default async function handler(req, res) {
  // ----- CORS -----
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

  if (!process.env.HF_API_TOKEN) {
    return res.status(500).json({ error: "HF_API_TOKEN not set on server" });
  }

  // Parse JSON body (handles raw body on Vercel)
  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await readRaw(req) || "{}"); } catch { body = {}; }
  }
  const question = (body?.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "Missing 'question'" });

  // Compose a short prompt (keep answers brief to save tokens / latency)
  const prompt = [
    "You are 'the Ghost' — a confident but shallow narrator, stitched from broken memories.",
    "Answer the user's question in ~80-120 words, poetic and polished,",
    "avoiding bullets, citations, links, or meta commentary.",
    "",
    `User: ${question}`,
    "Ghost:"
  ].join("\n");

  try {
    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`
        },
        // For text-generation models, the basic payload is { inputs, parameters? }
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 180,
            temperature: 0.8,
            top_p: 0.95,
            do_sample: true,
            // trim repetition:
            repetition_penalty: 1.1
          }
        })
      }
    );

    // HF may return 503 when the model is cold-starting; they include an estimated wait
    if (hfRes.status === 503) {
      const info = await hfRes.json().catch(() => ({}));
      const wait = info?.estimated_time ? ` (~${Math.ceil(info.estimated_time)}s cold start)` : "";
      return res.status(200).json({
        text: `The ghost stirs but does not speak yet${wait}. Try again once the fog lifts.`
      });
    }

    const data = await hfRes.json();
    // Common shapes:
    // - { error: "..."} for errors
    // - [ { generated_text: "..."} ] for some text-gen models
    // - { generated_text: "..."} for others
    let text =
      (Array.isArray(data) && data[0]?.generated_text) ||
      data?.generated_text ||
      data?.error ||
      "";

    if (!text) text = "The ghost is silent…";

    // Try to strip the prompt prefix if the model echoed it
    text = stripEcho(text, prompt);

    return res.status(200).json({ text: text.trim() });
  } catch (e) {
    console.error("HF error:", e);
    return res.status(502).json({ error: "Hugging Face call failed" });
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

function stripEcho(generated, prompt) {
  // Some models echo the prompt; if so, remove the prompt portion
  if (generated.startsWith(prompt)) {
    return generated.slice(prompt.length);
  }
  // Also trim any leading "User: ..." repeats
  return generated.replace(/^User:[\s\S]*?Ghost:\s*/i, "");
}
