// src/pix/manual.js
const QRCode = require('qrcode');

// Função para calcular CRC16-CCITT
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Função para criar payload PIX (BR Code)
function createPixPayload(pixKey, amount, txid) {
  // ID 00: Payload Format Indicator
  const payloadFormat = '000201';
  
  // ID 26: Merchant Account Information (PIX)
  const merchantAccount = 
    '26' + 
    String(
      '0014br.gov.bcb.pix' +
      '01' + String(pixKey.length).padStart(2, '0') + pixKey
    ).length.toString().padStart(2, '0') +
    '0014br.gov.bcb.pix' +
    '01' + String(pixKey.length).padStart(2, '0') + pixKey;
  
  // ID 52: Merchant Category Code
  const merchantCategory = '52040000';
  
  // ID 53: Transaction Currency (986 = BRL)
  const currency = '5303986';
  
  // ID 54: Transaction Amount (se houver)
  let amountField = '';
  if (amount && parseFloat(amount) > 0) {
    const amountStr = parseFloat(amount).toFixed(2);
    amountField = '54' + String(amountStr.length).padStart(2, '0') + amountStr;
  }
  
  // ID 58: Country Code
  const countryCode = '5802BR';
  
  // ID 62: Additional Data Field Template (txid)
  const additionalData = 
    '62' + 
    String(
      '05' + String(txid.length).padStart(2, '0') + txid
    ).length.toString().padStart(2, '0') +
    '05' + String(txid.length).padStart(2, '0') + txid;
  
  // Montar payload sem CRC
  const payloadWithoutCRC = 
    payloadFormat + 
    merchantAccount + 
    merchantCategory + 
    currency + 
    amountField + 
    countryCode + 
    additionalData + 
    '6304';
  
  // Calcular e adicionar CRC
  const crcValue = crc16(payloadWithoutCRC);
  return payloadWithoutCRC + crcValue;
}

async function createManualCharge({ amount = "10.00", productId }) {
  const key = process.env.MY_PIX_KEY;
  if (!key) throw new Error('MY_PIX_KEY não configurada.');

  // Gerar txid
  const txid = `manual${Date.now()}`;

  // Criar payload PIX (BR Code)
  const copiaCola = createPixPayload(key, amount, txid);

  // Gerar data URL do QR code (PNG)
  const qrcodeDataUrl = await QRCode.toDataURL(copiaCola);

  return {
    mode: 'manual',
    charge: {
      txid,
      key,
      amount: parseFloat(amount).toFixed(2),
      copiaCola,
      qrcodeDataUrl
    }
  };
}

module.exports = { createManualCharge };

