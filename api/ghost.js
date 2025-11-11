// /api/ghost.js  (TEMP STUB)
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(await new Promise(r => {
      let data = ""; req.on("data", c => data += c); req.on("end", () => r(data));
    }) || "{}"); } catch { body = {}; }
  }

  const question = (body?.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "Missing 'question'" });

  return res.status(200).json({ text: `Echo: ${question}` });
}
