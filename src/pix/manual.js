// src/pix/manual.js
const QRCode = require('qrcode');

// ============================================
// GERADOR OFICIAL + CORRIGIDO DE PIX
// ============================================

// CRC16-CCITT (função corrigida)
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Gera o payload PIX correto (BR Code)
// Corrigido conforme especificação EMV/BCB
function createPixPayload(key, amount, txid) {
  // GUI CORRETO em MAIÚSCULAS
  const gui = "BR.GOV.BCB.PIX";

  // Merchant Account Information (ID 26) - corrigido
  const merchantAccountInfo = 
    "00" + gui.length.toString().padStart(2,'0') + gui +
    "01" + key.length.toString().padStart(2,'0') + key;

  // Campo 62: Additional Data Field Template (com TXID)
  // Sub-campo 05 = Reference Label (TXID)
  const txidContent = "05" + txid.length.toString().padStart(2,'0') + txid;
  const additionalData = "62" + txidContent.length.toString().padStart(2,'0') + txidContent;
  
  // Campo 59: Merchant Name (obrigatório)
  const merchantName = "PAGAMENTO";
  const field59 = "59" + merchantName.length.toString().padStart(2,'0') + merchantName;
  
  // Campo 60: Merchant City (obrigatório)
  const merchantCity = "SAO PAULO";
  const field60 = "60" + merchantCity.length.toString().padStart(2,'0') + merchantCity;
  
  // Montar payload completo com campos obrigatórios
  const payload =
    "000201" +  // ID 00: Payload Format Indicator
    "26" + merchantAccountInfo.length.toString().padStart(2,'0') + merchantAccountInfo +  // ID 26: Merchant Account
    "52040000" +  // ID 52: Merchant Category Code
    "5303986" +  // ID 53: Transaction Currency (BRL)
    "54" + amount.length.toString().padStart(2,'0') + amount +  // ID 54: Transaction Amount
    "5802BR" +  // ID 58: Country Code
    field59 +  // ID 59: Merchant Name
    field60 +  // ID 60: Merchant City
    additionalData;  // ID 62: Additional Data Field Template

  // Adicionar placeholder para CRC
  const parcial = payload + "6304";
  
  // Calcular CRC sobre payload completo
  const crc = crc16(parcial);

  return parcial + crc;
}

async function createManualCharge({ amount = "10.00", productId }) {
  try {
    const key = process.env.MY_PIX_KEY;
    if (!key) {
      console.error('MY_PIX_KEY não configurada!');
      throw new Error('MY_PIX_KEY não configurada.');
    }

    // Formatar valor com 2 casas decimais (CORREÇÃO CRÍTICA)
    const amountFormatted = parseFloat(amount).toFixed(2);

    // Gerar txid (máximo 25 caracteres)
    // Formato: M + timestamp últimos 8 dígitos + random 4 caracteres
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const txid = `M${timestamp}${random}`;

    // Criar payload PIX (BR Code) com valor formatado
    const copiaCola = createPixPayload(key, amountFormatted, txid);

    // Gerar QR code como buffer (PNG)
    const qrcodeBuffer = await QRCode.toBuffer(copiaCola, {
      type: 'png',
      width: 300,
      margin: 1
    });

    return {
      mode: 'manual',
      charge: {
        txid,
        key,
        amount: amountFormatted,
        copiaCola,
        qrcodeBuffer
      }
    };
  } catch (error) {
    console.error('Erro createManualCharge:', error.message);
    throw error;
  }
}

module.exports = { createManualCharge };

