const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
const HF_MODEL = process.env.HF_MODEL || "google/gemma-2b-it";

function setCORS(req, res) {
  const ori = req.headers.origin || "";
  const allow = ORIGINS.length ? (ORIGINS.includes(ori) ? ori : ORIGINS[0]) : (ori || "*");
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function json(res, status, payload){ res.setHeader("Content-Type","application/json"); res.status(status).end(JSON.stringify(payload)); }
async function readRaw(req){ return new Promise(r=>{ let d=""; req.on("data",c=>d+=c); req.on("end",()=>r(d)); req.on("error",()=>r("")); }); }

export default async function handler(req, res){
  setCORS(req,res);
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="POST")    return json(res,405,{error:"POST only"});
  if(!process.env.HF_API_TOKEN) return json(res,500,{error:"HF_API_TOKEN not set on server"});

  let body = req.body;
  if(!body || typeof body!=="object"){ try{ body = JSON.parse(await readRaw(req)||"{}"); }catch{ body = {}; } }
  const question = (body?.question||"").toString().trim();
  if(!question) return json(res,400,{error:"Missing 'question'"});

  const prompt = `You are 'the Ghost' — a confident but shallow narrator, stitched from broken memories.
Answer the user's question in ~80–120 words, poetic and polished.
Avoid bullets, citations, links, or meta commentary.

User: ${question}
Ghost:`;

  try{
    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`,{
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${process.env.HF_API_TOKEN}` },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true },
        parameters: { max_new_tokens: 180, temperature: 0.8, top_p: 0.95, do_sample: true, repetition_penalty: 1.1 }
      })
    });

    const raw = await hfRes.text(); let data; try{ data=JSON.parse(raw);}catch{ data=raw; }
    if(!hfRes.ok){
      const msg = typeof data==="string" ? `${hfRes.status} ${hfRes.statusText}: ${data.slice(0,500)}` : (data?.error || `${hfRes.status} ${hfRes.statusText}`);
      return json(res, hfRes.status, { error: msg });
    }

    let text = (Array.isArray(data) && data[0]?.generated_text) || (typeof data==="object" && data?.generated_text) || (typeof data==="string" ? data : "") || "";
    if(!text) text = "The ghost is silent…";
    if(text.startsWith(prompt)) text = text.slice(prompt.length);
    text = text.replace(/^User:[\s\S]*?Ghost:\s*/i,"");

    return json(res,200,{text:text.trim()});
  }catch(e){
    console.error("HF call error:", e);
    return json(res,502,{error:"Hugging Face call failed"});
  }
}
