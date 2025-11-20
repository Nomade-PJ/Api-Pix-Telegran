// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando múltiplos métodos

const axios = require('axios');
const FormData = require('form-data');

/**
 * Analisa comprovante PIX usando múltiplos métodos
 * 1. Tenta OpenAI (se configurada) - suporta imagens e PDFs
 * 2. Tenta OCR.space (upload direto) - suporta imagens e PDFs
 * 3. Tenta OCR.space (URL) - fallback
 * 4. Tenta método alternativo de OCR
 * 5. Fallback para validação manual
 */
async function analyzeProof(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  try {
    console.log(`🔍 Iniciando análise - Tipo: ${fileType}, Valor esperado: R$ ${expectedAmount}, Chave: ${pixKey}`);
    
    // MÉTODO 1: Tentar OpenAI primeiro (mais preciso)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (OPENAI_API_KEY) {
      try {
        console.log('🤖 Tentando análise com OpenAI...');
        const result = await analyzeWithOpenAI(fileUrl, expectedAmount, pixKey, OPENAI_API_KEY);
        if (result && result.isValid !== null) {
          console.log('✅ OpenAI retornou resultado válido');
          return result;
        }
      } catch (err) {
        console.warn('⚠️ Erro com OpenAI, tentando método alternativo:', err.message);
      }
    }
    
    // MÉTODO 2: OCR.space com upload direto (melhor para PDFs)
    try {
      console.log('📄 Tentando OCR.space (upload direto)...');
      const result = await analyzeWithFreeOCR(fileUrl, expectedAmount, pixKey, fileType);
      if (result && result.isValid !== null) {
        console.log('✅ OCR.space (upload) retornou resultado válido');
        return result;
      }
    } catch (err) {
      console.warn('⚠️ Erro com OCR.space (upload), tentando URL:', err.message);
    }
    
    // MÉTODO 3: OCR.space com URL (fallback)
    try {
      console.log('📄 Tentando OCR.space (URL)...');
      const result = await analyzeWithFreeOCR_URL(fileUrl, expectedAmount, pixKey, fileType);
      if (result && result.isValid !== null) {
        console.log('✅ OCR.space (URL) retornou resultado válido');
        return result;
      }
    } catch (err) {
      console.warn('⚠️ Erro com OCR.space (URL):', err.message);
    }
    
    // MÉTODO 4: Validação básica por padrões (sempre retorna para validação manual)
    console.log('⚠️ Todos os métodos de OCR falharam, enviando para validação manual');
    return await analyzeWithPatterns(fileUrl, expectedAmount, pixKey);
    
  } catch (error) {
    console.error('❌ Erro crítico na análise automática:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      isValid: null,
      confidence: 0,
      details: {
        error: error.message,
        needsManualReview: true,
        method: 'Erro crítico'
      }
    };
  }
}

/**
 * Análise usando OpenAI Vision API
 */
async function analyzeWithOpenAI(fileUrl, expectedAmount, pixKey, apiKey) {
  const prompt = `Analise este comprovante de pagamento PIX e extraia as seguintes informações:

1. Valor pago (em reais)
2. Chave PIX do destinatário
3. Status do pagamento (aprovado/pago/concluído)
4. Data e hora da transação
5. Se o comprovante parece autêntico

Valor esperado: R$ ${expectedAmount}
Chave PIX esperada: ${pixKey}

Responda APENAS em formato JSON com esta estrutura:
{
  "isValid": true/false,
  "amount": "valor encontrado",
  "pixKey": "chave encontrada",
  "status": "status do pagamento",
  "date": "data da transação",
  "confidence": 0-100,
  "reason": "motivo da validação ou rejeição"
}`;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: { url: fileUrl }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const analysis = JSON.parse(response.data.choices[0].message.content);
  const amountMatch = parseFloat(analysis.amount?.replace('R$', '').replace(',', '.')) === parseFloat(expectedAmount);
  const finalValid = analysis.isValid && amountMatch;

  return {
    isValid: finalValid,
    confidence: analysis.confidence || 0,
    details: {
      amount: analysis.amount,
      pixKey: analysis.pixKey,
      status: analysis.status,
      date: analysis.date,
      reason: analysis.reason,
      amountMatch,
      needsManualReview: analysis.confidence < 80,
      method: 'OpenAI'
    }
  };
}

/**
 * Análise usando OCR gratuito (Tesseract via API)
 * Suporta imagens (JPG, PNG) e PDFs
 * Baixa o arquivo do Telegram e faz upload direto para evitar erro 405
 */
async function analyzeWithFreeOCR(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  // Usar API gratuita de OCR (ex: OCR.space)
  const OCR_API_KEY = process.env.OCR_API_KEY || 'helloworld'; // Chave gratuita padrão
  
  try {
    const isPDF = fileType === 'pdf' || fileUrl.toLowerCase().includes('.pdf');
    
    console.log(`🔍 Analisando ${isPDF ? 'PDF' : 'imagem'} com OCR.space...`);
    console.log(`📎 Baixando arquivo do Telegram...`);
    
    // 🆕 BAIXAR ARQUIVO DO TELEGRAM PRIMEIRO
    // Isso resolve o problema do erro 405 (URL não aceita)
    let fileBuffer;
    let fileName;
    
    try {
      const fileResponse = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5
      });
      
      fileBuffer = Buffer.from(fileResponse.data);
      fileName = isPDF ? 'comprovante.pdf' : 'comprovante.jpg';
      
      console.log(`✅ Arquivo baixado: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    } catch (downloadErr) {
      console.error('❌ Erro ao baixar arquivo:', downloadErr.message);
      // Fallback: tentar com URL mesmo (pode funcionar para alguns casos)
      console.log('⚠️ Tentando com URL direta como fallback...');
      return await analyzeWithFreeOCR_URL(fileUrl, expectedAmount, pixKey, fileType);
    }
    
    // OCR.space endpoint para upload de arquivo
    const endpoint = 'https://api.ocr.space/parse/image';
    
    // Preparar form-data com arquivo
    const formData = new FormData();
    formData.append('apikey', OCR_API_KEY);
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: isPDF ? 'application/pdf' : 'image/jpeg'
    });
    formData.append('language', 'por');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('isCreateSearchablePdf', 'false');
    formData.append('isSearchablePdfHideTextLayer', 'false');
    
    // Se for PDF, adicionar parâmetros específicos
    if (isPDF) {
      formData.append('filetype', 'PDF');
      formData.append('OCREngine', '2'); // Engine 2 funciona melhor com PDFs
    } else {
      formData.append('OCREngine', '1'); // Engine 1 para imagens
    }
    
    // Fazer upload e análise
    const ocrResponse = await axios.post(
      endpoint,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        timeout: 60000, // 60 segundos para PDFs (podem ser maiores)
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    // Verificar se a resposta tem erro
    if (!ocrResponse.data) {
      throw new Error('OCR não retornou dados');
    }
    
    if (ocrResponse.data.OCRExitCode !== 1) {
      throw new Error(`OCR retornou código de saída: ${ocrResponse.data.OCRExitCode}`);
    }

    // Verificar resposta do OCR
    if (!ocrResponse.data.ParsedResults || ocrResponse.data.ParsedResults.length === 0) {
      throw new Error('OCR não retornou resultados');
    }
    
    const extractedText = ocrResponse.data.ParsedResults[0].ParsedText || '';
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('OCR não conseguiu extrair texto do documento');
    }
    
    console.log(`✅ OCR extraiu ${extractedText.length} caracteres do ${isPDF ? 'PDF' : 'documento'}`);
    
    // Extrair valor (múltiplos formatos)
    const amountRegex = /R\$\s*([\d.,]+)|([\d.,]+)\s*reais?/gi;
    const amountMatches = extractedText.match(amountRegex);
    let foundAmount = null;
    
    if (amountMatches) {
      // Pegar o primeiro match e limpar
      const match = amountMatches[0];
      foundAmount = match.replace(/[R$\sreais]/gi, '').replace(',', '.').trim();
    }
    
    // Extrair chave PIX (buscar por diferentes formatos)
    const pixKeyRegex = new RegExp(pixKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const keyFound = pixKeyRegex.test(extractedText);
    
    // Verificar palavras-chave de pagamento
    const paymentKeywords = /(pago|aprovado|concluído|confirmado|realizado|transferido|enviado)/i;
    const isPaid = paymentKeywords.test(extractedText);
    
    // Calcular confiança
    let confidence = 0;
    if (foundAmount && parseFloat(foundAmount) === parseFloat(expectedAmount)) {
      confidence += 50;
      console.log(`✅ Valor encontrado: R$ ${foundAmount}`);
    } else if (foundAmount) {
      console.log(`⚠️ Valor encontrado (${foundAmount}) não corresponde ao esperado (${expectedAmount})`);
    }
    
    if (keyFound) {
      confidence += 30;
      console.log(`✅ Chave PIX encontrada`);
    } else {
      console.log(`⚠️ Chave PIX não encontrada no texto`);
    }
    
    if (isPaid) {
      confidence += 20;
      console.log(`✅ Status de pagamento encontrado`);
    }
    
    const isValid = confidence >= 70 && foundAmount && keyFound;
    
    console.log(`📊 Confiança final: ${confidence}% - ${isValid ? 'VÁLIDO' : 'PRECISA VALIDAÇÃO MANUAL'}`);
    
    return {
      isValid,
      confidence,
      details: {
        amount: foundAmount ? `R$ ${foundAmount}` : 'Não encontrado',
        pixKey: keyFound ? pixKey : 'Não encontrada',
        status: isPaid ? 'Pago' : 'Indeterminado',
        extractedText: extractedText.substring(0, 300), // Primeiros 300 chars para debug
        method: `OCR Gratuito (${isPDF ? 'PDF' : 'Imagem'})`,
        fileType: isPDF ? 'PDF' : 'Imagem'
      }
    };
    
  } catch (err) {
    const errorStatus = err.response?.status;
    const errorData = err.response?.data;
    
    console.error('❌ Erro detalhado do OCR:', {
      message: err.message,
      status: errorStatus,
      data: errorData
    });
    
    // Se for erro 405, tentar método alternativo com URL
    if (errorStatus === 405 || err.message.includes('405')) {
      console.log('⚠️ Erro 405 detectado, tentando método alternativo com URL...');
      try {
        return await analyzeWithFreeOCR_URL(fileUrl, expectedAmount, pixKey, fileType);
      } catch (fallbackErr) {
        throw new Error(`OCR falhou: ${err.message}. Método alternativo também falhou: ${fallbackErr.message}`);
      }
    }
    
    // Se for erro de rate limit ou similar
    if (errorStatus === 429) {
      throw new Error(`Limite de requisições do OCR atingido. Tente novamente em alguns instantes.`);
    }
    
    throw new Error(`OCR falhou: ${err.message}${errorStatus ? ` (Status: ${errorStatus})` : ''}`);
  }
}

/**
 * Método alternativo: análise via URL (fallback)
 */
async function analyzeWithFreeOCR_URL(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  const OCR_API_KEY = process.env.OCR_API_KEY || 'helloworld';
  const isPDF = fileType === 'pdf' || fileUrl.toLowerCase().includes('.pdf');
  const endpoint = 'https://api.ocr.space/parse/imageurl';
  
  const params = new URLSearchParams();
  params.append('apikey', OCR_API_KEY);
  params.append('url', fileUrl);
  params.append('language', 'por');
  params.append('isOverlayRequired', 'false');
  params.append('detectOrientation', 'true');
  params.append('scale', 'true');
  
  if (isPDF) {
    params.append('filetype', 'PDF');
    params.append('OCREngine', '2');
  } else {
    params.append('OCREngine', '1');
  }
  
  const ocrResponse = await axios.post(
    endpoint,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 30000
    }
  );
  
  if (!ocrResponse.data || ocrResponse.data.OCRExitCode !== 1) {
    throw new Error(`OCR retornou código de saída: ${ocrResponse.data?.OCRExitCode}`);
  }
  
  if (!ocrResponse.data.ParsedResults || ocrResponse.data.ParsedResults.length === 0) {
    throw new Error('OCR não retornou resultados');
  }
  
  const extractedText = ocrResponse.data.ParsedResults[0].ParsedText || '';
  
  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('OCR não conseguiu extrair texto do documento');
  }
  
  // Mesma lógica de extração do método principal
  const amountRegex = /R\$\s*([\d.,]+)|([\d.,]+)\s*reais?/gi;
  const amountMatches = extractedText.match(amountRegex);
  let foundAmount = null;
  
  if (amountMatches) {
    const match = amountMatches[0];
    foundAmount = match.replace(/[R$\sreais]/gi, '').replace(',', '.').trim();
  }
  
  const pixKeyRegex = new RegExp(pixKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const keyFound = pixKeyRegex.test(extractedText);
  const paymentKeywords = /(pago|aprovado|concluído|confirmado|realizado|transferido|enviado)/i;
  const isPaid = paymentKeywords.test(extractedText);
  
  let confidence = 0;
  if (foundAmount && parseFloat(foundAmount) === parseFloat(expectedAmount)) confidence += 50;
  if (keyFound) confidence += 30;
  if (isPaid) confidence += 20;
  
  const isValid = confidence >= 70 && foundAmount && keyFound;
  
  return {
    isValid,
    confidence,
    details: {
      amount: foundAmount ? `R$ ${foundAmount}` : 'Não encontrado',
      pixKey: keyFound ? pixKey : 'Não encontrada',
      status: isPaid ? 'Pago' : 'Indeterminado',
      extractedText: extractedText.substring(0, 300),
      method: `OCR Gratuito (URL - ${isPDF ? 'PDF' : 'Imagem'})`,
      fileType: isPDF ? 'PDF' : 'Imagem'
    }
  };
}

/**
 * Análise básica por padrões (sem API externa)
 */
async function analyzeWithPatterns(fileUrl, expectedAmount, pixKey) {
  // Método mais básico: apenas validação estrutural
  // Não analisa a imagem, apenas retorna que precisa validação manual
  
  return {
    isValid: null,
    confidence: 0,
    details: {
      error: 'Nenhum método de análise disponível',
      needsManualReview: true,
      method: 'Validação Manual',
      message: 'Por favor, configure OPENAI_API_KEY ou use validação manual'
    }
  };
}

/**
 * Valida comprovante localmente (verificação básica)
 */
function quickValidation(fileId) {
  // Verificações básicas
  if (!fileId) {
    return { isValid: false, reason: 'Arquivo inválido' };
  }

  // Aqui você pode adicionar verificações simples
  // Por exemplo: tamanho do arquivo, tipo, etc.
  
  return { isValid: true, reason: 'Verificação básica passou' };
}

module.exports = {
  analyzeProof,
  quickValidation
};

