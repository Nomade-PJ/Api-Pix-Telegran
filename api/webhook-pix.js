// api/webhook-pix.js
// Webhook para receber notificações de pagamento PIX (de PSPs como Mercado Pago, PagSeguro, etc)
const deliver = require('../src/deliver');
const db = require('../src/database');

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
      // Buscar transação no Supabase
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        console.log('Transação não encontrada:', txid);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status === 'delivered') {
        console.log('Já foi entregue:', txid);
        return res.status(200).json({ message: 'Already delivered' });
      }

      // Buscar produto
      const product = await db.getProduct(transaction.product_id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Validar transação
      const adminUser = await db.getOrCreateUser({ id: 0 }); // Sistema
      await db.validateTransaction(txid, adminUser.id);

      // Entregar automaticamente
      console.log('Entregando automaticamente para:', transaction.telegram_id);
      await deliver.deliverContent(transaction.telegram_id, product);
      
      // Marcar como entregue
      await db.markAsDelivered(txid);

      console.log('Entregue com sucesso!');
      return res.status(200).json({ ok: true, message: 'Delivered successfully' });
    }

    // Pagamento pendente ou rejeitado
    return res.status(200).json({ ok: true, message: 'Webhook received' });

  } catch (err) {
    console.error('Erro no webhook PIX:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};

