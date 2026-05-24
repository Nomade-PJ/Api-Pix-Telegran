// src/db/autoresponse.js
const { supabase } = require('./client');

 */
async function getAutoResponse(keyword) {
  try {
    const keywordLower = keyword.toLowerCase().trim();
    
    // Buscar respostas ativas ordenadas por prioridade
    const { data, error } = await supabase
      .from('auto_responses')
      .select('*')
      .eq('is_active', true)
      .ilike('keyword', `%${keywordLower}%`)
      .order('priority', { ascending: false })
      .order('usage_count', { ascending: true })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao buscar resposta automática:', err);
    return null;
  }
}

/**
 * Busca todas as respostas automáticas
 */
async function getAllAutoResponses() {
  try {
    const { data, error } = await supabase
      .from('auto_responses')
      .select('*')
      .order('priority', { ascending: false })
      .order('keyword', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar respostas automáticas:', err);
    return [];
  }
}

/**
 * Cria nova resposta automática
 */
async function createAutoResponse(keyword, response, priority = 0) {
  try {
    const { data, error } = await supabase
      .from('auto_responses')
      .insert({
        keyword: keyword.toLowerCase().trim(),
        response: response,
        priority: priority,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao criar resposta automática:', err);
    throw err;
  }
}

/**
 * Atualiza contador de uso de resposta automática
 */
async function updateAutoResponseUsage(responseId) {
  try {
    const { data: current } = await supabase
      .from('auto_responses')
      .select('usage_count')
      .eq('id', responseId)
      .single();
    
    const usageCount = (current?.usage_count || 0) + 1;
    
    const { data, error } = await supabase
      .from('auto_responses')
      .update({
        usage_count: usageCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', responseId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar uso de resposta:', err);
    return null;
  }
}

/**
 * Recalcula e atualiza o valor total de vendas baseado em todas as transações entregues
 * Útil para sincronizar valores após mudanças ou correções
 * Também corrige inconsistências automaticamente
 */

module.exports = {
  getAutoResponse,
  getAllAutoResponses,
  createAutoResponse,
  updateAutoResponseUsage
};
