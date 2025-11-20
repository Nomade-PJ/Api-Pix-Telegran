// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando múltiplos métodos

const axios = require('axios');

/**
 * Analisa comprovante PIX usando múltiplos métodos
 * 1. Tenta OpenAI (se configurada)
 * 2. Tenta OCR gratuito (Tesseract via API)
 * 3. Fallback para validação manual
 */
async function analyzeProof(fileUrl, expectedAmount, pixKey) {
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
    
    // MÉTODO 2: OCR gratuito usando Tesseract (via API pública)
    try {
      return await analyzeWithFreeOCR(fileUrl, expectedAmount, pixKey);
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
 */
async function analyzeWithFreeOCR(fileUrl, expectedAmount, pixKey) {
  // Usar API gratuita de OCR (ex: OCR.space)
  const OCR_API_KEY = process.env.OCR_API_KEY || 'helloworld'; // Chave gratuita padrão
  
  try {
    const ocrResponse = await axios.post(
      'https://api.ocr.space/parse/imageurl',
      {
        apikey: OCR_API_KEY,
        url: fileUrl,
        language: 'por',
        isOverlayRequired: false
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const extractedText = ocrResponse.data.ParsedResults?.[0]?.ParsedText || '';
    
    // Extrair valor
    const amountRegex = /R\$\s*([\d.,]+)/gi;
    const amountMatches = extractedText.match(amountRegex);
    const foundAmount = amountMatches ? amountMatches[0].replace(/[R$\s]/g, '').replace(',', '.') : null;
    
    // Extrair chave PIX
    const pixKeyRegex = new RegExp(pixKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const keyFound = pixKeyRegex.test(extractedText);
    
    // Verificar palavras-chave de pagamento
    const paymentKeywords = /(pago|aprovado|concluído|confirmado|realizado)/i;
    const isPaid = paymentKeywords.test(extractedText);
    
    // Calcular confiança
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
        extractedText: extractedText.substring(0, 200), // Primeiros 200 chars
        method: 'OCR Gratuito'
      }
    };
    
  } catch (err) {
    throw new Error(`OCR falhou: ${err.message}`);
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

