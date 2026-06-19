// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando OCR.space

const axios = require('axios');
const FormData = require('form-data');
const db = require('./database');

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
    console.log(`🔍 [OCR] Iniciando análise OCR...`);
    
    let ocrApiKey = process.env.OCR_SPACE_API_KEY;
    if (!ocrApiKey) {
      try {
        ocrApiKey = await db.getSetting('ocr_space_api_key');
      } catch (err) {
        console.warn('⚠️ [OCR] Falha ao buscar ocr_space_api_key no banco:', err.message);
      }
    }
    // Fallback padrão se não estiver em env nem no banco
    if (!ocrApiKey) {
      ocrApiKey = 'K87899643688957';
    }
    
    // OTIMIZAÇÃO: Fazer download do arquivo do Telegram IMEDIATAMENTE.
    // Isso é muito mais rápido e confiável do que deixar a API do OCR.space tentar baixar a URL do Telegram.
    console.log(`📥 [OCR] Baixando arquivo do Telegram...`);
    const downloadStartTime = Date.now();
    let fileBuffer = null;
    let downloadTime = 0;
    
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 segundos é mais que suficiente na Vercel
      });
      downloadTime = ((Date.now() - downloadStartTime) / 1000).toFixed(2);
      fileBuffer = Buffer.from(response.data);
      console.log(`✅ [OCR] Arquivo baixado com sucesso: ${(fileBuffer.length / 1024).toFixed(2)} KB em ${downloadTime}s`);
    } catch (downloadErr) {
      throw new Error(`Falha ao baixar arquivo do Telegram: ${downloadErr.message}`);
    }
    
    // OTIMIZAÇÃO: Tentar apenas as engines necessárias (Engine 1 é a principal para recibos em português)
    // Se a principal falhar por algum motivo, tentamos a Engine 2 como backup.
    const engines = fileType === 'pdf' ? ['2', '1'] : ['1', '2'];
    let extractedText = '';
    let lastError = null;
    
    for (let engineIndex = 0; engineIndex < engines.length; engineIndex++) {
      const engine = engines[engineIndex];
      try {
        console.log(`📤 [OCR] Enviando arquivo diretamente para OCR.space (Engine ${engine})...`);
        
        const formData = new FormData();
        formData.append('file', fileBuffer, {
          filename: fileType === 'pdf' ? 'proof.pdf' : 'proof.jpg',
          contentType: fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'
        });
        formData.append('apikey', ocrApiKey);
        formData.append('language', 'por');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', engine);
        
        const ocrStartTime = Date.now();
        const ocrResponse = await axios.post('https://api.ocr.space/parse/image', formData, {
          headers: formData.getHeaders(),
          timeout: 45000, // 45 segundos de timeout para a API de OCR
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        
        const ocrTime = ((Date.now() - ocrStartTime) / 1000).toFixed(2);
        console.log(`✅ [OCR] Resposta do OCR recebida em ${ocrTime}s (Engine ${engine})`);
        
        if (!ocrResponse.data) {
          console.warn(`⚠️ [OCR] OCR retornou resposta vazia (Engine ${engine})`);
          lastError = 'Resposta vazia';
          continue;
        }
        
        if (ocrResponse.data.IsErroredOnProcessing) {
          const errorMsg = ocrResponse.data.ErrorMessage?.[0] || 'Erro desconhecido no OCR';
          console.warn(`⚠️ [OCR] Erro do OCR.space (Engine ${engine}):`, errorMsg);
          lastError = errorMsg;
          continue;
        }
        
        const parsedResults = ocrResponse.data.ParsedResults;
        if (!parsedResults || parsedResults.length === 0) {
          console.warn(`⚠️ [OCR] Nenhum resultado retornado (Engine ${engine})`);
          lastError = 'Nenhum resultado retornado';
          continue;
        }
        
        const result = parsedResults[0];
        extractedText = result?.ParsedText || '';
        const fileParseExitCode = result?.FileParseExitCode;
        
        if (fileParseExitCode !== 1 && fileParseExitCode !== undefined) {
          console.warn(`⚠️ [OCR] FileParseExitCode: ${fileParseExitCode} indica erro (Engine ${engine})`);
          lastError = `FileParseExitCode: ${fileParseExitCode}`;
          continue;
        }
        
        if (extractedText && extractedText.trim().length > 0) {
          console.log(`✅ [OCR] Texto extraído com sucesso usando Engine ${engine} (${extractedText.length} caracteres)`);
          break; // Sucesso, sair do loop
        } else {
          console.warn(`⚠️ [OCR] Texto vazio retornado (Engine ${engine})`);
          lastError = 'Texto vazio';
        }
      } catch (engineErr) {
        console.warn(`⚠️ [OCR] Erro ao processar com Engine ${engine}:`, engineErr.message);
        lastError = engineErr.message;
      }
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      console.warn(`⚠️ [OCR] Não foi possível extrair texto após tentar as engines principal e backup`);
      return {
        isValid: null,
        confidence: 0,
        details: {
          method: 'OCR.space (Falhou)',
          reason: 'O OCR gratuito não conseguiu ler o comprovante (imagem ilegível, formato incorreto ou limite de API excedido).',
          needsManualReview: true,
          error: lastError || 'Texto não extraído'
        }
      };
    }
    
    return analyzeExtractedText(extractedText, expectedAmount, pixKey, fileType);
  } catch (err) {
    console.error('❌ [OCR] Erro geral no processamento OCR:', err.message);
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
  
  // 1. BUSCAR VALOR (flexível - múltiplos padrões)
  let foundValues = [];
  
  // Padrão 1: R$ 59,90 ou R$59.90
  const valorRegex1 = /(?:R\$|rs|valor|total|pago|pagamento|transferência|transferencia)\s*[\:\-]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;
  let match;
  while ((match = valorRegex1.exec(text)) !== null) {
    const valorStr = match[1].replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valorStr);
    if (!isNaN(valor) && valor > 0 && valor < 100000) {
      foundValues.push(valor);
    }
  }
  
  // Padrão 2: 59,90 ou 59.90 (sem R$)
  const valorRegex2 = /\b(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\b/g;
  while ((match = valorRegex2.exec(text)) !== null) {
    const valorStr = match[1].replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valorStr);
    // Aceitar valores entre 1 e 10000 (evitar números de telefone, datas, etc)
    if (!isNaN(valor) && valor >= 1 && valor <= 10000) {
      foundValues.push(valor);
    }
  }
  
  // Remover duplicatas
  foundValues = [...new Set(foundValues)];
  
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
  
  // 2. BUSCAR CHAVE PIX (flexível - múltiplas tentativas)
  let hasPixKey = false;
  
  if (cleanPixKey.length >= 8) {
    // Tentativa 1: Buscar chave completa sem formatação
    hasPixKey = text.includes(cleanPixKey) || textNormalized.includes(cleanPixKey);
    
    // Tentativa 2: Buscar últimos 8 dígitos (mais comum em comprovantes)
    if (!hasPixKey && cleanPixKey.length >= 8) {
      const last8 = cleanPixKey.substring(cleanPixKey.length - 8);
      hasPixKey = text.includes(last8) || textNormalized.includes(last8);
    }
    
    // Tentativa 3: Buscar primeiros 8 dígitos
    if (!hasPixKey) {
      const first8 = cleanPixKey.substring(0, 8);
      hasPixKey = text.includes(first8) || textNormalized.includes(first8);
    }
    
    // Tentativa 4: Buscar com formatação (+55, espaços, etc)
    if (!hasPixKey) {
      // Remover + e espaços da chave original
      const pixKeyClean = pixKey.replace(/[\s\+\-\(\)]/g, '');
      hasPixKey = text.includes(pixKeyClean) || textLower.includes(pixKeyClean.toLowerCase());
    }
    
    // Tentativa 5: Buscar chave original com formatação
    if (!hasPixKey) {
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
