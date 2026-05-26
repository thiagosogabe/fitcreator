const crypto = require('crypto')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { transactionId, email, value, currency, eventSourceUrl, userAgent } = req.body

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || '0.0.0.0'

    const hashedEmail = email
      ? crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
      : undefined

    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: transactionId || `purchase_${Date.now()}`,
        event_source_url: eventSourceUrl,
        action_source: 'website',
        user_data: {
          ...(hashedEmail && { em: [hashedEmail] }),
          client_ip_address: clientIp,
          client_user_agent: userAgent || '',
        },
        custom_data: {
          value: value || 47.00,
          currency: currency || 'BRL',
          content_name: 'FitCreator Pro',
        },
      }],
    }

    cons
