// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando múltiplos métodos

const axios = require('axios');

/**
 * Analisa comprovante PIX usando múltiplos métodos
 * 1. Tenta OpenAI (se configurada) - suporta imagens e PDFs
 * 2. Tenta OCR gratuito (Tesseract via API) - suporta imagens e PDFs
 * 3. Fallback para validação manual
 */
async function analyzeProof(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  try {
    // MÉTODO 1: Tentar OpenAI primeiro (mais preciso)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (OPENAI_API_KEY) {
      try {
        return await analyzeWithOpenAI(fileUrl, expectedAmount, pixKey, OPENAI_API_KEY);
      } catch (err) {
        console.warn('⚠️ Erro com OpenAI, tentando método alternativo:', err.message);
      }
    }
    
    // MÉTODO 2: OCR gratuito usando Tesseract (via API pública) - suporta PDFs
    try {
      return await analyzeWithFreeOCR(fileUrl, expectedAmount, pixKey, fileType);
    } catch (err) {
      console.warn('⚠️ Erro com OCR gratuito:', err.message);
    }
    
    // MÉTODO 3: Validação básica por padrões
    return await analyzeWithPatterns(fileUrl, expectedAmount, pixKey);
    
  } catch (error) {
    console.error('❌ Erro na análise automática:', error.message);
    
    return {
      isValid: null,
      confidence: 0,
      details: {
        error: error.message,
        needsManualReview: true
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
 */
async function analyzeWithFreeOCR(fileUrl, expectedAmount, pixKey, fileType = 'image') {
  // Usar API gratuita de OCR (ex: OCR.space)
  const OCR_API_KEY = process.env.OCR_API_KEY || 'helloworld'; // Chave gratuita padrão
  
  try {
    const isPDF = fileType === 'pdf' || fileUrl.toLowerCase().includes('.pdf');
    
    // OCR.space endpoint único para imagens e PDFs
    const endpoint = 'https://api.ocr.space/parse/imageurl';
    
    // Preparar parâmetros como form-data (formato correto para OCR.space)
    const formData = new URLSearchParams();
    formData.append('apikey', OCR_API_KEY);
    formData.append('url', fileUrl);
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
    
    console.log(`🔍 Analisando ${isPDF ? 'PDF' : 'imagem'} com OCR.space...`);
    console.log(`📎 URL: ${fileUrl.substring(0, 100)}...`);
    
    // Tentar requisição com formato correto
    const ocrResponse = await axios.post(
      endpoint,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000, // 30 segundos de timeout
        maxRedirects: 5
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
      data: errorData,
      url: fileUrl?.substring(0, 100)
    });
    
    // Se for erro 405, pode ser que a URL do Telegram não seja aceita diretamente
    if (errorStatus === 405) {
      throw new Error(`OCR.space não aceita este tipo de URL. Tente enviar o arquivo diretamente ou use OpenAI.`);
    }
    
    // Se for erro de rate limit ou similar
    if (errorStatus === 429) {
      throw new Error(`Limite de requisições do OCR atingido. Tente novamente em alguns instantes.`);
    }
    
    throw new Error(`OCR falhou: ${err.message}${errorStatus ? ` (Status: ${errorStatus})` : ''}`);
  }
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

