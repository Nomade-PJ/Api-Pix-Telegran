// api/trigger-delivery.js
const deliver = require('../src/deliver');

module.exports = async (req, res) => {
  try {
    // Segurança: adicionar secret header se desejar
    const secret = req.headers['x-trigger-secret'];
    if (process.env.TRIGGER_SECRET && secret !== process.env.TRIGGER_SECRET) {
      return res.status(403).send('Forbidden');
    }

    const { txid, action } = req.body;
    if (!txid) return res.status(400).send('txid required');

    // recuperar mapping (no exemplo, usamos memória)
    const txs = global._TXS || {};
    if (!txs[txid]) return res.status(404).send('txid not found');

    const record = txs[txid];
    const chatId = record.chatId;
    const productId = record.productId;

    // Ex.: se preferir enviar link
    if (action === 'link') {
      const link = `${process.env.DELIVERY_BASE_URL}/${productId}`; // ajustar
      await deliver.deliverByLink(chatId, link, 'Acesso liberado! Seu link:');
    } else {
      // enviar arquivo
      const fileUrl = `${process.env.DELIVERY_BASE_URL}/${productId}.zip`;
      await deliver.deliverFile(chatId, fileUrl, `${productId}.zip`);
    }

    // marcar como entregue
    record.delivered = true;
    return res.status(200).send({ ok: true });
  } catch (err) {
    console.error('trigger deliver err', err);
    return res.status(500).send('error');
  }
};

