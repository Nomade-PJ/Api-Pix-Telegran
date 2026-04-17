// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando Google Cloud Vision API

const axios = require('axios');

/**
 * Analisa comprovante PIX usando Google Cloud Vision
 * Suporta imagens (JPG, PNG) e PDFs
 */
async function analyzeProof(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  try {
    console.log(`🔍 [OCR] Iniciando análise - Tipo: ${fileType}, Valor esperado: R$ ${expectedAmount}, Chave: ${pixKey}`);

    try {
      const result = await analyzeWithGoogleVision(fileUrl, expectedAmount, pixKey, fileType);
      if (result) {
        console.log(`✅ [OCR] Análise concluída - Válido: ${result.isValid}, Confiança: ${result.confidence}%`);
        return result;
      }
    } catch (err) {
      console.error('❌ [OCR] Erro na análise com Google Vision:', err.message);
    }

    // Fallback: retornar para validação manual
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
 * Análise usando Google Cloud Vision API
 * Usa DOCUMENT_TEXT_DETECTION — ideal para comprovantes e documentos densos
 */
async function analyzeWithGoogleVision(fileUrl, expectedAmount, pixKey, fileType) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_VISION_API_KEY não configurada nas variáveis de ambiente');
  }

  console.log(`🔍 [VISION] Baixando arquivo do Telegram...`);
  console.log(`📎 [VISION] URL: ${fileUrl.substring(0, 80)}...`);

  // Baixar o arquivo com retry (3 tentativas)
  let fileBuffer = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📥 [VISION] Download tentativa ${attempt}/${maxRetries}...`);
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      fileBuffer = Buffer.from(response.data);
      console.log(`✅ [VISION] Arquivo baixado: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
      break;
    } catch (err) {
      if (attempt === maxRetries) throw new Error(`Falha no download após ${maxRetries} tentativas: ${err.message}`);
      console.warn(`⚠️ [VISION] Tentativa ${attempt} falhou, aguardando 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Converter para base64
  const base64Image = fileBuffer.toString('base64');

  // Determinar o tipo MIME
  let mimeType = 'image/jpeg';
  if (fileType === 'pdf') {
    mimeType = 'application/pdf';
  } else if (fileUrl.toLowerCase().includes('.png')) {
    mimeType = 'image/png';
  }

  console.log(`🚀 [VISION] Enviando para Google Cloud Vision (DOCUMENT_TEXT_DETECTION)...`);
  console.log(`📄 [VISION] MIME type: ${mimeType}`);

  const requestBody = {
    requests: [
      {
        image: {
          content: base64Image
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }
        ],
        imageContext: {
          languageHints: ['pt', 'pt-BR']
        }
      }
    ]
  };

  const startTime = Date.now();
  const visionResponse = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    requestBody,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ [VISION] Resposta recebida em ${elapsed}s`);

  const visionResult = visionResponse.data?.responses?.[0];

  if (!visionResult) {
    throw new Error('Google Vision retornou resposta vazia');
  }

  if (visionResult.error) {
    throw new Error(`Erro do Google Vision: ${visionResult.error.message}`);
  }

  const extractedText = visionResult.fullTextAnnotation?.text || '';

  if (!extractedText || extractedText.trim().length === 0) {
    console.warn('⚠️ [VISION] Nenhum texto extraído da imagem');
    return {
      isValid: null,
      confidence: 0,
      details: {
        method: 'Google Vision (sem texto)',
        reason: 'Não foi possível extrair texto. Imagem pode ser de baixa qualidade.',
        needsManualReview: true
      }
    };
  }

  console.log(`✅ [VISION] Texto extraído: ${extractedText.length} caracteres`);
  console.log(`📄 [VISION] Primeiros 500 chars:\n${extractedText.substring(0, 500)}`);

  return analyzeExtractedText(extractedText, expectedAmount, pixKey, fileType);
}

/**
 * Analisa o texto extraído pelo Google Vision
 * Busca valor, chave PIX e palavras-chave de confirmação
 */
function analyzeExtractedText(text, expectedAmount, pixKey, fileType) {
  const textLower = text.toLowerCase();
  const textNormalized = text.replace(/\s+/g, ' ');

  console.log(`🔍 [VISION] Analisando texto extraído...`);

  // ── 1. BUSCAR VALOR ──────────────────────────────────────────────────────────

  let foundValues = [];

  // Padrão 1: precedido de R$, valor, total, pago etc.
  const valorRegex1 = /(?:R\$|rs|valor|total|pago|pagamento|transferência|transferencia)\s*[:\-]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;
  let match;
  while ((match = valorRegex1.exec(text)) !== null) {
    const v = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(v) && v > 0 && v < 100000) foundValues.push(v);
  }

  // Padrão 2: qualquer número com centavos
  const valorRegex2 = /\b(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\b/g;
  while ((match = valorRegex2.exec(text)) !== null) {
    const v = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(v) && v >= 1 && v <= 50000) foundValues.push(v);
  }

  // Remover duplicatas
  foundValues = [...new Set(foundValues)];
  console.log(`💰 [VISION] Valores encontrados:`, foundValues);
  console.log(`💰 [VISION] Valor esperado: ${expectedAmount}`);

  const expectedFloat = parseFloat(expectedAmount);
  const margem = expectedFloat * 0.10; // 10% de tolerância
  const matchingValue = foundValues.find(v => v >= expectedFloat - margem && v <= expectedFloat + margem);
  const hasCorrectValue = !!matchingValue;

  if (hasCorrectValue) {
    console.log(`✅ [VISION] Valor correspondente: R$ ${matchingValue} (esperado: R$ ${expectedAmount})`);
  } else {
    console.log(`⚠️ [VISION] Nenhum valor dentro da faixa R$ ${(expectedFloat - margem).toFixed(2)} – R$ ${(expectedFloat + margem).toFixed(2)}`);
  }

  // ── 2. BUSCAR CHAVE PIX ──────────────────────────────────────────────────────

  let hasPixKey = false;
  const cleanPixKey = pixKey.replace(/\D/g, '');

  if (cleanPixKey.length >= 8) {
    // Chave sem formatação
    hasPixKey = text.includes(cleanPixKey) || textNormalized.includes(cleanPixKey);

    // Últimos 8 dígitos
    if (!hasPixKey) {
      const last8 = cleanPixKey.slice(-8);
      hasPixKey = text.includes(last8);
    }

    // Primeiros 8 dígitos
    if (!hasPixKey) {
      const first8 = cleanPixKey.substring(0, 8);
      hasPixKey = text.includes(first8);
    }
  }

  // Chave no formato original (ex: UUID, e-mail, telefone)
  if (!hasPixKey) {
    hasPixKey = text.includes(pixKey) || textLower.includes(pixKey.toLowerCase());
  }

  // Para chaves UUID — buscar partes do UUID
  if (!hasPixKey && pixKey.includes('-')) {
    const uuidParts = pixKey.split('-');
    // Se pelo menos 2 partes do UUID aparecem, considera encontrado
    const partsFound = uuidParts.filter(part => part.length >= 4 && text.includes(part));
    hasPixKey = partsFound.length >= 2;
  }

  console.log(`${hasPixKey ? '✅' : '⚠️'} [VISION] Chave PIX ${hasPixKey ? 'encontrada' : 'não encontrada'}`);

  // ── 3. BUSCAR PALAVRAS-CHAVE DE CONFIRMAÇÃO ──────────────────────────────────

  const palavrasChave = [
    'pix', 'aprovad', 'concluí', 'concluido', 'efetua', 'realizada',
    'transferência', 'transferencia', 'pagamento', 'comprovante', 'recebido'
  ];
  const hasKeywords = palavrasChave.some(p => textLower.includes(p));
  console.log(`${hasKeywords ? '✅' : '⚠️'} [VISION] Palavras-chave ${hasKeywords ? 'encontradas' : 'não encontradas'}`);

  // ── 4. CALCULAR CONFIANÇA ────────────────────────────────────────────────────

  let confidence = 0;
  if (hasCorrectValue) confidence += 50;  // valor correto = peso maior
  if (hasPixKey)       confidence += 30;  // chave PIX
  if (hasKeywords)     confidence += 20;  // palavras de confirmação

  let isValid;
  if (confidence >= 70) {
    isValid = true;
    console.log(`✅ [VISION] APROVADO AUTOMATICAMENTE — Confiança: ${confidence}%`);
  } else if (confidence >= 40) {
    isValid = null;
    console.log(`⚠️ [VISION] VALIDAÇÃO MANUAL NECESSÁRIA — Confiança: ${confidence}%`);
  } else {
    isValid = false;
    console.log(`❌ [VISION] SUSPEITO — Confiança: ${confidence}%`);
  }

  return {
    isValid,
    confidence,
    details: {
      method: `Google Cloud Vision (${fileType.toUpperCase()})`,
      amount: matchingValue ? `R$ ${matchingValue.toFixed(2)}` : null,
      hasCorrectValue,
      hasPixKey,
      hasKeywords,
      foundValues: foundValues.map(v => `R$ ${v.toFixed(2)}`),
      reason: confidence < 40
        ? 'Comprovante não corresponde aos dados esperados'
        : confidence < 70
          ? 'Análise inconclusiva — requer validação manual'
          : 'Comprovante válido',
      needsManualReview: confidence < 70
    }
  };
}

module.exports = { analyzeProof };
