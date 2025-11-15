// api/trigger-delivery.js
// Endpoint para integrações externas (n8n, Zapier, etc) triggerar entrega
const deliver = require('../src/deliver');
const db = require('../src/database');

module.exports = async (req, res) => {
  try {
    const secret = req.headers['x-trigger-secret'];
    if (process.env.TRIGGER_SECRET && secret !== process.env.TRIGGER_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { txid, action } = req.body;
    if (!txid) return res.status(400).json({ error: 'txid required' });

    // Buscar transação no Supabase
    const transaction = await db.getTransactionByTxid(txid);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'delivered') {
      return res.status(200).json({ ok: true, message: 'Already delivered' });
    }

    // Buscar produto
    const product = await db.getProduct(transaction.product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Entregar conteúdo
    await deliver.deliverContent(transaction.telegram_id, product);

    // Marcar como entregue
    await db.markAsDelivered(txid);

    return res.status(200).json({ ok: true, message: 'Delivered successfully' });
  } catch (err) {
    console.error('trigger deliver err', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};

