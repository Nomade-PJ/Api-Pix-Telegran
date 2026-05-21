// src/pix/selectPixKey.js
// Serviço central de decisão PIX
// Consulta a função select_pix_key() do Supabase e decide qual chave usar
// NÃO altera nenhuma lógica existente — apenas decide a chave antes de gerar o PIX

const db = require('../database');

/**
 * Decide qual chave PIX usar com base nas regras configuradas no painel admin
 * @param {string|null} userId - UUID do usuário (para regra de acumulado)
 * @param {number} amount - Valor da transação
 * @returns {Promise<{pix_key: string, pix_type: 'primary'|'secondary', reason: string}>}
 */
async function selectPixKey(userId = null, amount = 0) {
  try {
    const { data, error } = await db.supabase
      .rpc('select_pix_key', {
        p_user_id: userId || null,
        p_amount:  parseFloat(amount) || 0
      });

    if (error) throw error;

    console.log(`🔑 [PIX-SELECT] Chave: ${data.pix_type} | Motivo: ${data.reason} | ${data.pix_key}`);
    return data;

  } catch (err) {
    // Fallback para chave principal da tabela settings
    console.error('❌ [PIX-SELECT] Erro, usando fallback:', err.message);
    const { data: fallback } = await db.supabase
      .from('settings')
      .select('value')
      .eq('key', 'pix_key')
      .single();

    return {
      pix_key:  fallback?.value || process.env.MY_PIX_KEY || '',
      pix_type: 'primary',
      reason:   'fallback'
    };
  }
}

/**
 * Registra no log qual chave foi usada
 */
async function logPixUsage(transactionId, userId, amount, pixKeyUsed, pixType, reason) {
  try {
    await db.supabase.from('pix_transactions_control').insert({
      transaction_id: transactionId,
      user_id:        userId || null,
      amount:         parseFloat(amount) || 0,
      pix_key_used:   pixKeyUsed,
      pix_type:       pixType,
      reason:         reason
    });
  } catch (err) {
    console.error('❌ [PIX-LOG] Erro ao registrar log:', err.message);
  }
}

module.exports = { selectPixKey, logPixUsage };
