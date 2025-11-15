// src/modules/maintenance.js
const db = require('../database');

/**
 * Verificar se está em modo manutenção
 */
async function isMaintenanceMode() {
  try {
    const { data, error } = await db.supabase
      .from('maintenance_mode')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    return data?.is_active || false;
  } catch (err) {
    console.error('Erro ao verificar modo manutenção:', err);
    return false;
  }
}

/**
 * Verificar se usuário está na whitelist
 */
async function isWhitelisted(telegramId) {
  try {
    const { data, error } = await db.supabase
      .from('maintenance_mode')
      .select('whitelist_users')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    
    const whitelist = data?.whitelist_users || [];
    return whitelist.includes(telegramId.toString());
  } catch (err) {
    console.error('Erro ao verificar whitelist:', err);
    return false;
  }
}

/**
 * Obter mensagem de manutenção
 */
async function getMaintenanceMessage() {
  try {
    const { data, error } = await db.supabase
      .from('maintenance_mode')
      .select('message')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    return data?.message || '🔧 Estamos em manutenção. Voltaremos em breve!';
  } catch (err) {
    console.error('Erro ao buscar mensagem de manutenção:', err);
    return '🔧 Estamos em manutenção. Voltaremos em breve!';
  }
}

/**
 * Ativar modo manutenção
 */
async function enableMaintenance(adminId, message = null, whitelistUsers = []) {
  try {
    const { data, error } = await db.supabase
      .from('maintenance_mode')
      .update({
        is_active: true,
        message: message || '🔧 Estamos em manutenção. Voltaremos em breve!',
        whitelist_users: whitelistUsers,
        activated_by: adminId,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao ativar manutenção:', err);
    return false;
  }
}

/**
 * Desativar modo manutenção
 */
async function disableMaintenance() {
  try {
    const { data, error } = await db.supabase
      .from('maintenance_mode')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao desativar manutenção:', err);
    return false;
  }
}

/**
 * Adicionar usuário à whitelist
 */
async function addToWhitelist(telegramId) {
  try {
    const { data: current, error: fetchError } = await db.supabase
      .from('maintenance_mode')
      .select('whitelist_users')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (fetchError) throw fetchError;
    
    const whitelist = current?.whitelist_users || [];
    if (!whitelist.includes(telegramId.toString())) {
      whitelist.push(telegramId.toString());
    }
    
    const { error: updateError } = await db.supabase
      .from('maintenance_mode')
      .update({
        whitelist_users: whitelist,
        updated_at: new Date().toISOString()
      })
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (updateError) throw updateError;
    return true;
  } catch (err) {
    console.error('Erro ao adicionar à whitelist:', err);
    return false;
  }
}

/**
 * Remover usuário da whitelist
 */
async function removeFromWhitelist(telegramId) {
  try {
    const { data: current, error: fetchError } = await db.supabase
      .from('maintenance_mode')
      .select('whitelist_users')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (fetchError) throw fetchError;
    
    const whitelist = (current?.whitelist_users || []).filter(id => id !== telegramId.toString());
    
    const { error: updateError } = await db.supabase
      .from('maintenance_mode')
      .update({
        whitelist_users: whitelist,
        updated_at: new Date().toISOString()
      })
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (updateError) throw updateError;
    return true;
  } catch (err) {
    console.error('Erro ao remover da whitelist:', err);
    return false;
  }
}

/**
 * Obter status completo de manutenção
 */
async function getMaintenanceStatus() {
  try {
    const { data, error } = await db.supabase
      .from('maintenance_mode')
      .select(`
        *,
        activator:activated_by(first_name, username)
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar status de manutenção:', err);
    return null;
  }
}

module.exports = {
  isMaintenanceMode,
  isWhitelisted,
  getMaintenanceMessage,
  enableMaintenance,
  disableMaintenance,
  addToWhitelist,
  removeFromWhitelist,
  getMaintenanceStatus
};

