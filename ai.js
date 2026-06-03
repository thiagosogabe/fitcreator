export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "not allowed" });
  try {
    const body = req.body;
    const prompt = body.prompt;
    const system = body.system || "Voce e um especialista em conteudo para personal trainers brasileiros.";
    if (!prompt) return res.status(400).json({ error: "no prompt" });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: system,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    const text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : "";
    return res.status(200).json({ result: text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
