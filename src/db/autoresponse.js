// src/db/autoresponse.js
const { supabase } = require('./client');

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

module.exports = {
  getAutoResponse,
  getAllAutoResponses,
  createAutoResponse,
  updateAutoResponseUsage
};
