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
  console.log('=== CRIANDO PAYLOAD PIX (VERSÃO CORRIGIDA) ===');
  console.log('Chave:', key);
  console.log('Valor:', amount);
  console.log('TXID:', txid);

  // GUI CORRETO em MAIÚSCULAS (fix #1)
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
  
  // Calcular CRC sobre payload completo (fix #5)
  const crc = crc16(parcial);

  const payloadFinal = parcial + crc;
  
  console.log('PAYLOAD FINAL (CORRIGIDO):', payloadFinal);
  console.log('Tamanho:', payloadFinal.length);
  
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

    // Formatar valor com 2 casas decimais (CORREÇÃO CRÍTICA)
    const amountFormatted = parseFloat(amount).toFixed(2);
    console.log('Valor formatado:', amountFormatted);

    // Gerar txid (máximo 25 caracteres)
    // Formato: M + timestamp últimos 8 dígitos + random 4 caracteres
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const txid = `M${timestamp}${random}`;
    console.log('TXID gerado:', txid, '- Tamanho:', txid.length);

    // Criar payload PIX (BR Code) com valor formatado
    console.log('Criando payload PIX...');
    console.log('Chave PIX usada:', key);
    console.log('Valor:', amountFormatted);
    console.log('TXID:', txid);
    const copiaCola = createPixPayload(key, amountFormatted, txid);
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

