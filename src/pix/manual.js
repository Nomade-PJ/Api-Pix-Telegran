// src/pix/manual.js
const EMV = require('emv-qrcode'); // biblioteca para montar EMV BR (BR Code)
const QRCode = require('qrcode');

async function createManualCharge({ amount = "10.00", productId }) {
  const key = process.env.MY_PIX_KEY;
  if (!key) throw new Error('MY_PIX_KEY não configurada.');

  // Gerar txid
  const txid = `manual-${Date.now()}`;

  // Montar objeto EMV conforme documentação da lib
  // Nota: a API da lib pode variar; adapte conforme a versão instalada.
  const payloadObj = {
    pixKey: key,
    amount: parseFloat(amount).toFixed(2),
    txid
  };

  // Utilizando 'emv-qrcode' (API hipotética) para criar BR Code string
  // Caso a API do pacote seja diferente, adapte aqui.
  const brCode = EMV.PixBR({ pixKey: key, amount: payloadObj.amount, txid: payloadObj.txid }).toString();
  const copiaCola = brCode;

  // Gerar data URL do QR code (PNG)
  const qrcodeDataUrl = await QRCode.toDataURL(copiaCola);

  return {
    mode: 'manual',
    charge: {
      txid,
      key,
      amount: payloadObj.amount,
      copiaCola,
      qrcodeDataUrl
    }
  };
}

module.exports = { createManualCharge };

