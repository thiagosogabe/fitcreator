const crypto = require('crypto')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const hottok = req.headers['hottok']
    if (hottok !== process.env.HOTMART_HOTTOK) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = req.body
    if (body.event !== 'PURCHASE_COMPLETE' && body.event !== 'PURCHASE_APPROVED') {
      return res.status(200).json({ message: 'Evento ignorado' })
    }

    const transaction = body.data?.purchase?.transaction
    const email = body.data?.buyer?.email

    const hashedEmail = email
      ? crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
      : undefined

    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `hotmart_${transaction}`,
        event_source_url: `https://fitcreatorai.com/obrigado`,
        action_source: 'website',
        user_data: {
          ...(hashedEmail && { em: [hashedEmail] }),
        },
        custom_data: {
          value: 47.00,
          currency: 'BRL',
          content_name: 'FitCreator Pro',
        },
      }],
    }

    await fetch(
      `https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )

    res.status(200).json({ success: true, transaction })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
