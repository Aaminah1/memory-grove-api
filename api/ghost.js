export default async function handler(req, res) {
  // CORS (keep it; harmless)
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  const origin = req.headers.origin || "";
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (allowed.length) {
    const allow = allowed.includes(origin) ? origin : allowed[0];
    res.setHeader("Access-Control-Allow-Origin", allow);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, note: "ghost endpoint alive; send POST with {question}" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Minimal parse to avoid body-parser quirks
  let raw = "";
  await new Promise((resolve) => {
    req.on("data", (c) => (raw += c));
    req.on("end", resolve);
    req.on("error", resolve);
  });

  let body = {};
  try { body = raw ? JSON.parse(raw) : (typeof req.body === "object" ? req.body : {}); } catch {}
  const question = (body?.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "Missing 'question'" });

  // For now, just bounce a fake response to prove POST works end-to-end.
  // (We re-enable Hugging Face once POST is confirmed.)
  return res.status(200).json({ text: `Ghost hears: ${question}` });
}
