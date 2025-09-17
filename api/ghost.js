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
  setCORS(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    // still return CORS headers on errors
    return res.status(405).json({ error: "POST only" });
  }

  // For now, just bounce a fake response to prove POST works end-to-end.
  // (We re-enable Hugging Face once POST is confirmed.)
  return res.status(200).json({ text: `Ghost hears: ${question}` });
}
