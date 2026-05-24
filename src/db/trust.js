// src/db/trust.js
const { supabase } = require('./client');

async function getTrustedUser(telegramId) {
  try {
    const { data, error } = await supabase
      .from('trusted_users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao buscar usuário confiável:', err);
    return null;
  }
}

/**
 * Atualiza ou cria registro de usuário confiável
 */
async function updateTrustedUser(telegramId, userId, isApproved = true) {
  try {
    const trusted = await getTrustedUser(telegramId);
    
    let trustScore = 50; // Score inicial
    let approvedCount = 0;
    let rejectedCount = 0;
    
    if (trusted) {
      trustScore = parseFloat(trusted.trust_score) || 50;
      approvedCount = trusted.approved_transactions || 0;
      rejectedCount = trusted.rejected_transactions || 0;
    }
    
    // Atualizar score baseado na aprovação/rejeição
    if (isApproved) {
      approvedCount++;
      trustScore = Math.min(100, trustScore + 2); // Aumenta confiança
    } else {
      rejectedCount++;
      trustScore = Math.max(0, trustScore - 5); // Diminui confiança
    }
    
    // Calcular threshold automático (quanto maior a confiança, menor o threshold necessário)
    const autoApproveThreshold = Math.max(40, 70 - (trustScore / 2));
    
    const { data, error } = await supabase
      .from('trusted_users')
      .upsert({
        telegram_id: telegramId,
        user_id: userId,
        trust_score: trustScore,
        approved_transactions: approvedCount,
        rejected_transactions: rejectedCount,
        auto_approve_threshold: autoApproveThreshold,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'telegram_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar usuário confiável:', err);
    throw err;
  }
}

/**
 * Adiciona usuário à whitelist manualmente
 */
async function addTrustedUser(telegramId, userId, initialScore = 80) {
  try {
    const { data, error } = await supabase
      .from('trusted_users')
      .upsert({
        telegram_id: telegramId,
        user_id: userId,
        trust_score: initialScore,
        auto_approve_threshold: Math.max(40, 70 - (initialScore / 2)),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'telegram_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao adicionar usuário confiável:', err);
    throw err;
  }
}

/**
 * Busca padrões de comprovantes válidos
 */
async function getProofPatterns(patternType = null) {
  try {
    let query = supabase
      .from('proof_patterns')
      .select('*')
      .order('confidence_score', { ascending: false });
    
    if (patternType) {
      query = query.eq('pattern_type', patternType);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar padrões:', err);
    return [];
  }
}

/**
 * Atualiza padrão de comprovante (aprendizado)
 */
async function updateProofPattern(patternType, patternValue, isValid) {
  try {
    // Buscar padrão existente
    const { data: existing } = await supabase
      .from('proof_patterns')
      .select('*')
      .eq('pattern_type', patternType)
      .eq('pattern_value', patternValue)
      .single();
    
    let successCount = isValid ? 1 : 0;
    let failureCount = isValid ? 0 : 1;
    let confidenceScore = isValid ? 60 : 40;
    
    if (existing) {
      successCount = existing.success_count + (isValid ? 1 : 0);
      failureCount = existing.failure_count + (isValid ? 0 : 1);
      
      // Calcular score de confiança (0-100)
      const total = successCount + failureCount;
      confidenceScore = total > 0 ? (successCount / total) * 100 : 50;
    }
    
    const { data, error } = await supabase
      .from('proof_patterns')
      .upsert({
        pattern_type: patternType,
        pattern_value: patternValue,
        confidence_score: confidenceScore,
        success_count: successCount,
        failure_count: failureCount,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'pattern_type,pattern_value'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar padrão:', err);
    throw err;
  }
}

module.exports = {
  getTrustedUser,
  updateTrustedUser,
  addTrustedUser,
  getProofPatterns,
  updateProofPattern
};
