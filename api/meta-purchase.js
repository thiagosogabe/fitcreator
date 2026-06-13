const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Verificar variáveis de ambiente
  if (!process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN) {
    console.error('META_PIXEL_ID ou META_ACCESS_TOKEN não configurados');
    return res.status(500).json({ error: 'Configuração ausente' });
  }

  try {
    const {
      transactionId,
      email,
      value,
      currency,
      eventSourceUrl,
      userAgent
    } = req.body || {};

    // IP do cliente
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '0.0.0.0';

    // Hash do email
    const hashedEmail = (email && typeof email === 'string')
      ? crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
      : undefined;

    // Valor corrigido — era 47.00, agora 39.90
    const purchaseValue = (typeof value === 'number' && value > 0) ? value : 39.90;

    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: transactionId || `purchase_${Date.now()}`,
        event_source_url: eventSourceUrl || 'https://fitcreatorai.com/obrigado',
        action_source: 'website',
        user_data: {
          ...(hashedEmail && { em: [hashedEmail] }),
          client_ip_address: clientIp,
          client_user_agent: userAgent || '',
        },
        custom_data: {
          value: purchaseValue,
          currency: currency || 'BRL',
          content_name: 'FitCreator Pro',
        },
      }],
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('Meta API erro:', errText);
      return res.status(502).json({ error: 'Erro ao enviar evento ao Meta' });
    }

    const metaData = await metaRes.json();
    console.log('Meta Purchase enviado:', transactionId, '| valor:', purchaseValue);

    return res.status(200).json({ success: true, meta: metaData });

  } catch (error) {
    console.error('Erro no meta-purchase:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
