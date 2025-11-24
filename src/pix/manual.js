// src/pix/manual.js
const QRCode = require('qrcode');
const db = require('../database');

// ============================================
// GERADOR OFICIAL + CORRIGIDO DE PIX
// ============================================

// Função para sanitizar e normalizar chave PIX
function sanitizePixKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Chave PIX inválida');
  }

  const cleanKey = key.trim();

  // Detectar tipo de chave PIX
  
  // 1. Chave aleatória (UUID format) - VERIFICAR PRIMEIRO antes de telefone!
  // Validar formato UUID: 8-4-4-4-12
  const uuidRegex = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;
  if (uuidRegex.test(cleanKey)) {
    return cleanKey.toLowerCase();
  }
  
  // 2. Email (contém @)
  if (cleanKey.includes('@')) {
    // Email não precisa sanitização, apenas validar formato básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanKey)) {
      throw new Error('Email inválido');
    }
    return cleanKey.toLowerCase();
  }

  // 3. Telefone (contém +, parênteses, hífens, espaços misturados com números)
  // Exemplos: +(55) 98 9 8540-0784, +55 98 98540-0784, (98) 98540-0784
  const phoneRegex = /[\+\(\)\-\s]/;
  if (phoneRegex.test(cleanKey)) {
    // Extrair apenas os dígitos
    const digits = cleanKey.replace(/\D/g, '');
    
    // Validar quantidade de dígitos
    // Telefone com código país: 13 dígitos (55 + 11 + 9XXXX-XXXX)
    // Telefone sem código país: 11 dígitos (11 + 9XXXX-XXXX) ou 10 dígitos
    if (digits.length >= 10 && digits.length <= 13) {
      // Se tiver 13 dígitos, já tem código do país
      if (digits.length === 13) {
        return `+${digits}`;
      }
      // Se tiver 11-12 dígitos, adicionar código do Brasil
      if (digits.length === 11 || digits.length === 12) {
        return `+55${digits}`;
      }
      // Se tiver 10 dígitos (telefone fixo ou sem DDD completo)
      if (digits.length === 10) {
        return `+55${digits}`;
      }
    }
    throw new Error(`Telefone inválido: deve ter entre 10 e 13 dígitos (recebido: ${digits.length} dígitos)`);
  }

  // 4. Email já foi verificado acima
  // 5. CPF/CNPJ (apenas dígitos ou com pontuação)
  const onlyDigits = cleanKey.replace(/\D/g, '');
  if (onlyDigits.length === 11 || onlyDigits.length === 14) {
    // CPF (11) ou CNPJ (14) - retornar apenas números
    return onlyDigits;
  }

  // 6. Se chegou aqui, é uma chave que não reconhecemos
  // mas pode ser válida (ex: chave EVP do banco)
  // Retornar como está se tiver formato razoável
  if (cleanKey.length >= 8 && /^[a-zA-Z0-9\-]+$/.test(cleanKey)) {
    return cleanKey;
  }

  throw new Error(`Formato de chave PIX não reconhecido: ${cleanKey}`);
}

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
  
  // Campo 59: Merchant Name (obrigatório) - sem acentos/caracteres especiais
  const merchantName = "LOJA";
  const field59 = "59" + merchantName.length.toString().padStart(2,'0') + merchantName;
  
  // Campo 60: Merchant City (obrigatório) - sem espaços/acentos
  const merchantCity = "SAOPAULO";
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
    // Buscar chave PIX do banco de dados (PERMANENTE)
    const rawKey = await db.getPixKey();
    
    if (!rawKey || rawKey === 'CONFIGURAR') {
      console.error('Chave PIX não configurada!');
      throw new Error('Chave PIX não configurada. Use /setpix [chave] para configurar.');
    }

    // SANITIZAR E NORMALIZAR a chave PIX
    let key;
    try {
      key = sanitizePixKey(rawKey);
      console.log(`✅ Chave PIX sanitizada: "${rawKey}" -> "${key}"`);
    } catch (sanitizeError) {
      console.error(`❌ Erro ao sanitizar chave PIX: ${sanitizeError.message}`);
      throw new Error(`Chave PIX inválida: ${sanitizeError.message}`);
    }

    // Formatar valor com 2 casas decimais (CORREÇÃO CRÍTICA)
    const amountFormatted = parseFloat(amount).toFixed(2);

    // Gerar txid (máximo 25 caracteres)
    // Formato: M + timestamp últimos 8 dígitos + random 4 caracteres
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const txid = `M${timestamp}${random}`;

    // Criar payload PIX (BR Code) com chave sanitizada
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
        key, // Chave sanitizada que vai para o payload
        rawKey, // Chave original do banco (para referência)
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

module.exports = { createManualCharge, sanitizePixKey };

