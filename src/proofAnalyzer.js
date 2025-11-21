// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando OCR.space

const axios = require('axios');
const FormData = require('form-data');

/**
 * Analisa comprovante PIX usando OCR.space
 * Suporta imagens (JPG, PNG) e PDFs
 */
async function analyzeProof(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  try {
    console.log(`🔍 [OCR] Iniciando análise - Tipo: ${fileType}, Valor esperado: R$ ${expectedAmount}, Chave: ${pixKey}`);
    
    // MÉTODO PRINCIPAL: OCR.space com upload direto
    try {
      console.log('📄 [OCR] Analisando com OCR.space...');
      const result = await analyzeWithOCR(fileUrl, expectedAmount, pixKey, fileType);
      if (result) {
        console.log(`✅ [OCR] Análise concluída - Válido: ${result.isValid}, Confiança: ${result.confidence}%`);
        return result;
      }
    } catch (err) {
      console.error('❌ [OCR] Erro na análise:', err.message);
    }
    
    // Fallback: Retornar para validação manual
    console.log('⚠️ [OCR] Retornando para validação manual');
    return {
      isValid: null,
      confidence: 0,
      details: {
        method: 'Validação Manual',
        reason: 'Análise automática não disponível',
        needsManualReview: true
      }
    };
    
  } catch (error) {
    console.error('❌ [OCR] Erro crítico:', error.message);
    
    return {
      isValid: null,
      confidence: 0,
      details: {
        method: 'Erro',
        error: error.message,
        needsManualReview: true
      }
    };
  }
}

/**
 * Análise usando OCR.space (gratuito)
 * Suporta imagens e PDFs
 */
async function analyzeWithOCR(fileUrl, expectedAmount, pixKey, fileType) {
  try {
    console.log(`🔍 [OCR] Baixando arquivo do Telegram...`);
    
    // Baixar arquivo do Telegram
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 segundos
    });
    
    const fileBuffer = Buffer.from(response.data);
    console.log(`✅ [OCR] Arquivo baixado: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    // Preparar FormData
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileType === 'pdf' ? 'proof.pdf' : 'proof.jpg',
      contentType: fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'
    });
    formData.append('apikey', 'K87899643688957');
    formData.append('language', 'por');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 é melhor para PDFs
    
    console.log(`📤 [OCR] Enviando para OCR.space...`);
    
    // Enviar para OCR.space
    const ocrResponse = await axios.post('https://api.ocr.space/parse/image', formData, {
      headers: formData.getHeaders(),
      timeout: 60000, // 60 segundos para processar
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (!ocrResponse.data || ocrResponse.data.IsErroredOnProcessing) {
      throw new Error(ocrResponse.data?.ErrorMessage?.[0] || 'OCR falhou');
    }
    
    const extractedText = ocrResponse.data.ParsedResults?.[0]?.ParsedText || '';
    
    if (!extractedText) {
      throw new Error('OCR não extraiu texto');
    }
    
    console.log(`✅ [OCR] Extraiu ${extractedText.length} caracteres`);
    console.log(`📄 [OCR] Texto extraído (primeiros 500 chars):`);
    console.log(extractedText.substring(0, 500));
    
    // Analisar o texto extraído
    return analyzeExtractedText(extractedText, expectedAmount, pixKey, fileType);
    
  } catch (err) {
    console.error('❌ [OCR] Erro:', err.message);
    throw err;
  }
}

/**
 * Analisa o texto extraído do OCR
 * FLEXÍVEL: Aceita valores próximos e variações
 */
function analyzeExtractedText(text, expectedAmount, pixKey, fileType) {
  const textLower = text.toLowerCase();
  const textNormalized = text.replace(/\s+/g, ' ');
  
  console.log(`🔍 [OCR] Analisando texto extraído...`);
  
  // Limpar chave PIX para comparação
  const cleanPixKey = pixKey.replace(/\D/g, ''); // Remove tudo que não é número
  
  // 1. BUSCAR VALOR (flexível - aceita valores próximos ±10%)
  const valorRegex = /(?:R\$|rs|valor|total|pago)\s*[\:\-]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;
  let foundValues = [];
  let match;
  
  while ((match = valorRegex.exec(text)) !== null) {
    const valorStr = match[1].replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valorStr);
    if (!isNaN(valor) && valor > 0) {
      foundValues.push(valor);
    }
  }
  
  console.log(`💰 [OCR] Valores encontrados:`, foundValues);
  console.log(`💰 [OCR] Valor esperado: ${expectedAmount}`);
  
  // Verificar se algum valor está dentro da margem de ±10%
  const expectedFloat = parseFloat(expectedAmount);
  const margem = expectedFloat * 0.10; // 10% de margem
  const minValue = expectedFloat - margem;
  const maxValue = expectedFloat + margem;
  
  const matchingValue = foundValues.find(v => v >= minValue && v <= maxValue);
  const hasCorrectValue = !!matchingValue;
  
  if (hasCorrectValue) {
    console.log(`✅ [OCR] Valor correspondente encontrado: R$ ${matchingValue} (esperado: R$ ${expectedAmount})`);
  } else if (foundValues.length > 0) {
    console.log(`⚠️ [OCR] Valores encontrados mas nenhum corresponde ao esperado`);
    console.log(`⚠️ [OCR] Faixa aceitável: R$ ${minValue.toFixed(2)} - R$ ${maxValue.toFixed(2)}`);
  } else {
    console.log(`⚠️ [OCR] Nenhum valor encontrado no texto`);
  }
  
  // 2. BUSCAR CHAVE PIX (flexível - busca qualquer número que contenha parte da chave)
  let hasPixKey = false;
  
  if (cleanPixKey.length >= 8) {
    // Buscar por qualquer sequência de 8+ dígitos consecutivos da chave
    const pixPart = cleanPixKey.substring(0, 8);
    hasPixKey = text.includes(pixPart) || textNormalized.includes(pixPart);
    
    if (!hasPixKey) {
      // Tentar buscar com formatação
      hasPixKey = text.includes(pixKey) || textLower.includes(pixKey.toLowerCase());
    }
  }
  
  if (hasPixKey) {
    console.log(`✅ [OCR] Chave PIX encontrada`);
  } else {
    console.log(`⚠️ [OCR] Chave PIX não encontrada`);
  }
  
  // 3. BUSCAR PALAVRAS-CHAVE DE CONFIRMAÇÃO
  const palavrasChave = [
    'pix',
    'aprovad',
    'concluí',
    'efetua',
    'transferência',
    'pagamento',
    'comprovante'
  ];
  
  const hasKeywords = palavrasChave.some(palavra => textLower.includes(palavra));
  
  if (hasKeywords) {
    console.log(`✅ [OCR] Palavras-chave encontradas`);
  }
  
  // 4. CALCULAR CONFIANÇA E VALIDAÇÃO
  let confidence = 0;
  let isValid = false;
  
  // Sistema de pontuação
  if (hasCorrectValue) confidence += 50; // Valor correto = 50 pontos
  if (hasPixKey) confidence += 30;        // Chave PIX = 30 pontos
  if (hasKeywords) confidence += 20;      // Palavras-chave = 20 pontos
  
  // Validação baseada na confiança
  if (confidence >= 70) {
    // Alta confiança (70%+) = Aprovação automática
    isValid = true;
    console.log(`✅ [OCR] APROVADO AUTOMATICAMENTE - Confiança: ${confidence}%`);
  } else if (confidence >= 40) {
    // Média confiança (40-69%) = Validação manual
    isValid = null;
    console.log(`⚠️ [OCR] VALIDAÇÃO MANUAL - Confiança: ${confidence}%`);
  } else {
    // Baixa confiança (<40%) = Pode ser rejeitado
    isValid = false;
    console.log(`❌ [OCR] SUSPEITO - Confiança: ${confidence}%`);
  }
  
  return {
    isValid,
    confidence,
    details: {
      method: `OCR.space (${fileType.toUpperCase()})`,
      amount: matchingValue ? `R$ ${matchingValue.toFixed(2)}` : null,
      hasCorrectValue,
      hasPixKey,
      hasKeywords,
      foundValues: foundValues.map(v => `R$ ${v.toFixed(2)}`),
      reason: confidence < 40 
        ? 'Comprovante não corresponde aos dados esperados' 
        : confidence < 70 
          ? 'Análise inconclusiva - requer validação manual' 
          : 'Comprovante válido',
      needsManualReview: confidence < 70
    }
  };
}

module.exports = {
  analyzeProof
};
