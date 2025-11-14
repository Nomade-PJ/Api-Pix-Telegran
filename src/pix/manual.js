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
  console.log('=== CRIANDO PAYLOAD PIX ===');
  console.log('Chave recebida:', pixKey);
  console.log('Tamanho da chave:', pixKey.length);
  console.log('Valor:', amount);
  console.log('TXID:', txid);
  
  // ID 00: Payload Format Indicator
  const payloadFormat = '000201';
  console.log('00 - Payload Format:', payloadFormat);
  
  // ID 01: Point of Initiation Method (static = 11, dynamic = 12)
  const initiationMethod = '010212';
  console.log('01 - Initiation Method:', initiationMethod);
  
  // ID 26: Merchant Account Information (PIX)
  // Estrutura: 26 + tamanho + (00 + tamanho + "br.gov.bcb.pix" + 01 + tamanho + chave)
  const gui = '0014br.gov.bcb.pix';
  console.log('GUI:', gui);
  
  const keyField = '01' + String(pixKey.length).padStart(2, '0') + pixKey;
  console.log('Key Field completo:', keyField);
  console.log('Tamanho do Key Field:', keyField.length);
  
  const merchantAccountContent = gui + keyField;
  console.log('Merchant Account Content:', merchantAccountContent);
  console.log('Tamanho do Merchant Account Content:', merchantAccountContent.length);
  
  const merchantAccount = '26' + String(merchantAccountContent.length).padStart(2, '0') + merchantAccountContent;
  console.log('26 - Merchant Account completo:', merchantAccount);
  
  // ID 52: Merchant Category Code
  const merchantCategory = '52040000';
  console.log('52 - Merchant Category:', merchantCategory);
  
  // ID 53: Transaction Currency (986 = BRL)
  const currency = '5303986';
  console.log('53 - Currency:', currency);
  
  // ID 54: Transaction Amount (se houver)
  let amountField = '';
  if (amount && parseFloat(amount) > 0) {
    const amountStr = parseFloat(amount).toFixed(2);
    amountField = '54' + String(amountStr.length).padStart(2, '0') + amountStr;
    console.log('54 - Amount Field:', amountField);
  }
  
  // ID 58: Country Code
  const countryCode = '5802BR';
  console.log('58 - Country:', countryCode);
  
  // ID 62: Additional Data Field Template (txid)
  const txidField = '05' + String(txid.length).padStart(2, '0') + txid;
  console.log('TXID Field:', txidField);
  console.log('Tamanho TXID Field:', txidField.length);
  
  const additionalData = '62' + String(txidField.length).padStart(2, '0') + txidField;
  console.log('62 - Additional Data:', additionalData);
  
  // Montar payload sem CRC
  const payloadWithoutCRC = 
    payloadFormat + 
    initiationMethod +
    merchantAccount + 
    merchantCategory + 
    currency + 
    amountField + 
    countryCode + 
    additionalData + 
    '6304';
  
  console.log('Payload SEM CRC:', payloadWithoutCRC);
  console.log('Tamanho payload sem CRC:', payloadWithoutCRC.length);
  
  // Calcular e adicionar CRC
  const crcValue = crc16(payloadWithoutCRC);
  console.log('CRC calculado:', crcValue);
  
  const payloadFinal = payloadWithoutCRC + crcValue;
  console.log('=== PAYLOAD FINAL ===');
  console.log(payloadFinal);
  console.log('Tamanho total:', payloadFinal.length);
  
  return payloadFinal;
}

async function createManualCharge({ amount = "10.00", productId }) {
  try {
    console.log('createManualCharge chamado:', { amount, productId });
    
    const key = process.env.MY_PIX_KEY;
    if (!key) {
      console.error('MY_PIX_KEY não configurada!');
      throw new Error('MY_PIX_KEY não configurada.');
    }
    
    console.log('PIX Key:', key);

    // Gerar txid (máximo 25 caracteres)
    // Formato: M + timestamp últimos 8 dígitos + random 4 caracteres
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const txid = `M${timestamp}${random}`;
    console.log('TXID gerado:', txid, '- Tamanho:', txid.length);

    // Criar payload PIX (BR Code)
    console.log('Criando payload PIX...');
    console.log('Chave PIX usada:', key);
    console.log('Valor:', amount);
    console.log('TXID:', txid);
    const copiaCola = createPixPayload(key, amount, txid);
    console.log('Payload PIX COMPLETO:', copiaCola);
    console.log('Tamanho do payload:', copiaCola.length);

    // Gerar QR code como buffer (PNG)
    console.log('Gerando QR Code...');
    const qrcodeBuffer = await QRCode.toBuffer(copiaCola, {
      type: 'png',
      width: 300,
      margin: 1
    });
    console.log('QR Code gerado com sucesso');

    return {
      mode: 'manual',
      charge: {
        txid,
        key,
        amount: parseFloat(amount).toFixed(2),
        copiaCola,
        qrcodeBuffer
      }
    };
  } catch (error) {
    console.error('Erro em createManualCharge:', error);
    throw error;
  }
}

module.exports = { createManualCharge };

