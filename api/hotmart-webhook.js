const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // ── 1. AUTENTICAÇÃO ──
    const hottok = req.headers['hottok'];
    if (!process.env.HOTMART_HOTTOK) {
      console.error('HOTMART_HOTTOK não configurada');
      return res.status(500).json({ error: 'Configuração ausente' });
    }
    if (hottok !== process.env.HOTMART_HOTTOK) {
      console.warn('Hottok inválido:', hottok);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body;

    // ── 2. EVENTOS ACEITOS ──
    const eventosValidos = [
      'PURCHASE_COMPLETE',
      'PURCHASE_APPROVED',
      'PURCHASE_BILLET_PRINTED' // boleto gerado (opcional monitorar)
    ];
    if (!eventosValidos.includes(body.event)) {
      return res.status(200).json({ message: 'Evento ignorado', event: body.event });
    }

    // Apenas processar Supabase para compras confirmadas
    const isCompraConfirmada = body.event === 'PURCHASE_COMPLETE' || body.event === 'PURCHASE_APPROVED';

    // ── 3. EXTRAIR DADOS ──
    const transaction = body.data?.purchase?.transaction;
    const email = body.data?.buyer?.email?.toLowerCase()?.trim();
    const nome = body.data?.buyer?.name || '';
    const valor = body.data?.purchase?.price?.value || 39.90; // ✅ Corrigido de 47 para 39.90

    if (!email) {
      console.warn('Email não encontrado no webhook');
      return res.status(200).json({ message: 'Email ausente, ignorado' });
    }

    // ── 4. ATUALIZAR SUPABASE ──
    if (isCompraConfirmada) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supa = createClient(
          process.env.SUPA_URL || 'https://nrzxgzebicmsqmwgadnl.supabase.co',
          process.env.SUPA_SERVICE_KEY // ✅ Usar service key no servidor (não a publishable)
        );

        const thisMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);

        // Verificar se usuário já existe
        const { data: userExiste } = await supa
          .from('usuarios')
          .select('email, plano')
          .eq('email', email)
          .single();

        if (userExiste) {
          // Atualizar para Pro
          await supa.from('usuarios').update({
            plano: 'pro',
            creditos: 999999,
            updated_at: new Date().toISOString()
          }).eq('email', email);
          console.log('Usuário atualizado para Pro:', email);
        } else {
          // Criar conta Pro automaticamente
          await supa.from('usuarios').insert([{
            nome,
            email,
            senha: '', // sem senha ainda — usuário define na obrigado.html
            plano: 'pro',
            creditos: 999999,
            credit_month: thisMonth
          }]);
          console.log('Novo usuário Pro criado:', email);
        }
      } catch (supaErr) {
        console.error('Erro Supabase no webhook:', supaErr.message);
        // Não retorna erro — continua para registrar no Meta
      }
    }

    // ── 5. FACEBOOK CONVERSIONS API ──
    const hashedEmail = crypto
      .createHash('sha256')
      .update(email)
      .digest('hex');

    if (!process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN) {
      console.warn('META_PIXEL_ID ou META_ACCESS_TOKEN não configurados');
    } else {
      const payload = {
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `hotmart_${transaction}`,
          event_source_url: 'https://fitcreatorai.com/obrigado',
          action_source: 'website',
          user_data: {
            em: [hashedEmail],
          },
          custom_data: {
            value: valor,           // ✅ valor real da compra
            currency: 'BRL',
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
        const metaErr = await metaRes.text();
        console.error('Meta API erro:', metaErr);
      } else {
        console.log('Evento enviado ao Meta:', transaction);
      }
    }

    return res.status(200).json({ success: true, transaction, email });

  } catch (error) {
    console.error('Erro no webhook Hotmart:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
