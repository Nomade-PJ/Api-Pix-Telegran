// api/webhook-pix.js
// Webhook para receber notificações de pagamento PIX (de PSPs ou bancos)

const deliver = require('../src/deliver');

module.exports = async (req, res) => {
  try {
    console.log('Webhook PIX recebido');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Validar secret (se configurado)
    const secret = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (process.env.PIX_WEBHOOK_SECRET && secret !== process.env.PIX_WEBHOOK_SECRET) {
      console.log('Secret inválido');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Extrair informações do pagamento
    // NOTA: Adapte conforme o formato do seu PSP (Mercado Pago, PagSeguro, etc)
    const { txid, status, amount, payer } = req.body;

    console.log('Processando pagamento:', { txid, status, amount });

    // Verificar se o pagamento foi aprovado
    if (status === 'approved' || status === 'paid' || status === 'CONCLUIDA') {
      // Buscar transação no banco de dados
      const txs = global._TXS || {};
      const transaction = txs[txid];

      if (!transaction) {
        console.log('Transação não encontrada:', txid);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.delivered) {
        console.log('Já foi entregue:', txid);
        return res.status(200).json({ message: 'Already delivered' });
      }

      // Marcar como pago
      transaction.paid = true;
      transaction.paidAt = new Date().toISOString();

      // Entregar automaticamente
      const chatId = transaction.chatId;
      const productId = transaction.productId;

      console.log('Entregando automaticamente para:', chatId);

      try {
        // Enviar link ou arquivo
        const link = `${process.env.DELIVERY_BASE_URL || 'https://exemplo.com'}/${productId}`;
        await deliver.deliverByLink(chatId, link, '✅ Pagamento confirmado! Seu acesso:');
        
        // Marcar como entregue
        transaction.delivered = true;
        transaction.deliveredAt = new Date().toISOString();

        console.log('Entregue com sucesso!');
        return res.status(200).json({ ok: true, message: 'Delivered successfully' });
      } catch (err) {
        console.error('Erro ao entregar:', err);
        return res.status(500).json({ error: 'Failed to deliver', details: err.message });
      }
    }

    // Pagamento pendente ou rejeitado
    return res.status(200).json({ ok: true, message: 'Webhook received' });

  } catch (err) {
    console.error('Erro no webhook PIX:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};

