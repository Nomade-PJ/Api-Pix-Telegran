// src/modules/adminLogs.js
const db = require('../database');

/**
 * Registra uma ação administrativa
 * @param {number} telegramId - Telegram ID do admin (não UUID!)
 * @param {string} action - Ação realizada
 * @param {string} target - Alvo da ação (opcional)
 * @param {object} details - Detalhes adicionais (opcional)
 */
async function logAction(telegramId, action, target = null, details = null) {
  try {
    // Buscar o UUID do usuário pelo telegram_id
    const { data: user, error: userError } = await db.supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();
    
    if (userError || !user) {
      console.error('Usuário não encontrado para log:', telegramId);
      return null;
    }
    
    // Inserir log com o UUID correto
    const { data, error } = await db.supabase
      .from('admin_logs')
      .insert([{
        admin_id: user.id, // UUID do usuário
        action,
        target,
        details,
        ip_address: null // Pode ser adicionado depois
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao registrar log:', err);
    return null;
  }
}

/**
 * Buscar logs recentes
 */
async function getRecentLogs(limit = 50) {
  try {
    const { data, error } = await db.supabase
      .from('admin_logs')
      .select(`
        *,
        admin:admin_id(telegram_id, username, first_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar logs:', err);
    return [];
  }
}

/**
 * Buscar logs por admin
 */
async function getLogsByAdmin(adminId, limit = 20) {
  try {
    const { data, error } = await db.supabase
      .from('admin_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar logs do admin:', err);
    return [];
  }
}

module.exports = {
  logAction,
  getRecentLogs,
  getLogsByAdmin
};

