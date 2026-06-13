export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "not allowed" });

  // Verificar se a API key está configurada
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY não configurada");
    return res.status(500).json({ error: "API key não configurada" });
  }

  try {
    const { prompt, system } = req.body || {};

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ error: "Prompt inválido ou ausente" });
    }

    // Limitar tamanho do prompt para evitar abusos
    if (prompt.length > 8000) {
      return res.status(400).json({ error: "Prompt muito longo" });
    }

    const systemPrompt = (typeof system === "string" && system.trim())
      ? system.trim()
      : "Você é um especialista em criação de conteúdo para personal trainers brasileiros. Responda sempre em português do Brasil de forma clara, prática e direta.";

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
        system: systemPrompt,
        messages: [{ role: "user", content: prompt.trim() }]
      })
    });

    // Verificar status HTTP da Anthropic
    if (!r.ok) {
      const errText = await r.text();
      console.error("Anthropic HTTP error:", r.status, errText);
      return res.status(502).json({ error: "Erro ao chamar a IA", status: r.status });
    }

    const data = await r.json();

    if (data.error) {
      console.error("Anthropic API error:", data.error);
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error("Resposta vazia da Anthropic:", JSON.stringify(data));
      return res.status(500).json({ error: "Resposta vazia da IA" });
    }

    const text = data.content[0].text.trim();
    return res.status(200).json({ result: text });

  } catch (e) {
    console.error("Erro interno:", e.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
