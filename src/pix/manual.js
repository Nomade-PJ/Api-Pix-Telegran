// src/pix/manual.js
const QRCode = require('qrcode');

// ============================================
// GERADOR OFICIAL + CORRIGIDO DE PIX
// Baseado na especificação EMV/BCB BR Code 2.3
// ============================================

// CRC16-CCITT (corrigido)
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
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Função para criar payload PIX (BR Code) - CORRIGIDA
function createPixPayload(pixKey, amount, txid) {
  console.log('=== CRIANDO PAYLOAD PIX (VERSÃO CORRIGIDA) ===');
  console.log('Chave recebida:', pixKey);
  console.log('Tamanho da chave:', pixKey.length);
  console.log('Valor:', amount);
  console.log('TXID:', txid);
  
  // CORREÇÃO 1: GUI em MAIÚSCULAS (obrigatório)
  const gui = "BR.GOV.BCB.PIX";
  console.log('GUI (corrigido):', gui);
  
  // CORREÇÃO 2: Merchant Account Info montado corretamente
  // Estrutura: 00 + tamanho + GUI + 01 + tamanho + chave
  const guiField = "00" + gui.length.toString().padStart(2, '0') + gui;
  const keyField = "01" + pixKey.length.toString().padStart(2, '0') + pixKey;
  const merchantAccountInfo = guiField + keyField;
  console.log('Merchant Account Info:', merchantAccountInfo);
  
  // ID 00: Payload Format Indicator
  const payloadFormat = "000201";
  
  // ID 01: Point of Initiation Method (12 = dynamic)
  const initiationMethod = "010212";
  
  // ID 26: Merchant Account Information
  const merchantAccount = "26" + merchantAccountInfo.length.toString().padStart(2, '0') + merchantAccountInfo;
  console.log('26 - Merchant Account:', merchantAccount);
  
  // ID 52: Merchant Category Code
  const merchantCategory = "52040000";
  
  // ID 53: Transaction Currency (986 = BRL)
  const currency = "5303986";
  
  // ID 54: Transaction Amount
  const amountStr = parseFloat(amount).toFixed(2);
  const amountField = "54" + amountStr.length.toString().padStart(2, '0') + amountStr;
  console.log('54 - Amount:', amountField);
  
  // ID 58: Country Code
  const countryCode = "5802BR";
  
  // CORREÇÃO 3: Campos obrigatórios 59 e 60 (Nome e Cidade)
  // ID 59: Merchant Name (obrigatório - mínimo 1 caractere)
  const merchantName = "N"; // Nome mínimo (pode ser alterado)
  const nameField = "59" + merchantName.length.toString().padStart(2, '0') + merchantName;
  console.log('59 - Merchant Name:', nameField);
  
  // ID 60: Merchant City (obrigatório - mínimo 1 caractere)
  const merchantCity = "C"; // Cidade mínima (pode ser alterado)
  const cityField = "60" + merchantCity.length.toString().padStart(2, '0') + merchantCity;
  console.log('60 - Merchant City:', cityField);
  
  // ID 62: Additional Data Field Template (TXID)
  const txidField = "05" + txid.length.toString().padStart(2, '0') + txid;
  const additionalData = "62" + txidField.length.toString().padStart(2, '0') + txidField;
  console.log('62 - Additional Data:', additionalData);
  
  // Montar payload sem CRC (ordem correta dos TLVs)
  const payloadWithoutCRC = 
    payloadFormat + 
    initiationMethod +
    merchantAccount + 
    merchantCategory + 
    currency + 
    amountField + 
    countryCode + 
    nameField +      // CORREÇÃO: Campo 59 adicionado
    cityField +      // CORREÇÃO: Campo 60 adicionado
    additionalData + 
    "6304";          // ID 63: CRC placeholder
  
  console.log('Payload SEM CRC:', payloadWithoutCRC);
  console.log('Tamanho payload sem CRC:', payloadWithoutCRC.length);
  
  // Calcular CRC
  const crcValue = crc16(payloadWithoutCRC);
  console.log('CRC calculado:', crcValue);
  
  // Payload final
  const payloadFinal = payloadWithoutCRC + crcValue;
  console.log('=== PAYLOAD FINAL (CORRIGIDO) ===');
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

