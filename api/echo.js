export default async function handler(req, res) {
  let raw = "";
  await new Promise((resolve) => {
    req.on("data", (c) => (raw += c));
    req.on("end", resolve);
    req.on("error", resolve);
  });

  res.status(200).json({
    ok: true,
    method: req.method,
    url: req.url,
    headers: req.headers,
    rawBody: raw
  });
}
