// api/ghost.js — minimal echo server with CORS

function setCORS(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCORS(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // read body
  let raw = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", resolve);
  });

  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {}

  const question = body.question || "(no question provided)";

  return res.status(200).json({
    ok: true,
    text: `The ghost echoes your words: "${question}"`
  });
}
