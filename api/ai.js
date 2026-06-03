export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "not allowed" });
  try {
    const prompt = req.body.prompt;
    const system = req.body.system || "Voce e um especialista em conteudo para personal trainers brasileiros.";
    if (!prompt) return res.status(400).json({ error: "no prompt" });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: system,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    // Log completo para debug
    console.log("Anthropic response:", JSON.stringify(data));
    if (data.error) {
      return res.status(500).json({ error: JSON.stringify(data.error) });
    }
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "empty response", raw: JSON.stringify(data) });
    }
    const text = data.content[0].text || "";
    return res.status(200).json({ result: text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
