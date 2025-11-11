export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.status(200).json({ ok: true, hasKey, ts: new Date().toISOString() });
}
