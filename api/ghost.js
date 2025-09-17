// api/ghost.js — minimal CORS sanity
const ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function setCORS(req, res) {
  const reqOrigin = req.headers.origin || "";
  const allow = ORIGINS.length
    ? (ORIGINS.includes(reqOrigin) ? reqOrigin : ORIGINS[0])
    : (reqOrigin || "*");
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  setCORS(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET")   return json(res, 200, { ok: true, note: "ghost alive" });
  if (req.method !== "POST")  return json(res, 405, { error: "POST only" });

  // Echo back what we got so we can see it in the browser/devtools
  let raw = "";
  await new Promise((r) => { req.on("data", c => raw+=c); req.on("end", r); req.on("error", r); });
  let body = {};
  try { body = raw ? JSON.parse(raw) : (typeof req.body === "object" ? req.body : {}); } catch {}
  return json(res, 200, { ok: true, received: body, origin: req.headers.origin || "" });
}
