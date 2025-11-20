// src/proofAnalyzer.js
// Análise automática de comprovantes PIX usando IA

const axios = require('axios');

/**
 * Analisa comprovante PIX usando IA (OpenAI Vision API)
 * @param {string} fileUrl - URL da imagem do comprovante
 * @param {string} expectedAmount - Valor esperado do pagamento
 * @param {string} pixKey - Chave PIX esperada
 * @returns {Promise<{isValid: boolean, confidence: number, details: object}>}
 */
async function analyzeProof(fileUrl, expectedAmount, pixKey) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.warn('⚠️ OPENAI_API_KEY não configurada - Pulando análise automática');
      return {
        isValid: null, // null = precisa validação manual
        confidence: 0,
        details: {
          error: 'API Key não configurada',
          needsManualReview: true
        }
      };
    }

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
                image_url: {
                  url: fileUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const analysis = JSON.parse(response.data.choices[0].message.content);
    
    // Validação adicional
    const amountMatch = parseFloat(analysis.amount?.replace('R$', '').replace(',', '.')) === parseFloat(expectedAmount);
    const finalValid = analysis.isValid && amountMatch;

    console.log('✅ Análise automática concluída:', {
      valid: finalValid,
      confidence: analysis.confidence
    });

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
        needsManualReview: analysis.confidence < 80
      }
    };

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

