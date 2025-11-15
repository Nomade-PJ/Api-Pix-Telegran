// src/modules/botManager.js
const db = require('../database');
const axios = require('axios');

/**
 * Criar solicitação de novo bot
 */
async function createBotRequest({ ownerTelegramId, botToken, pixKey, botName = null }) {
  try {
    // Validar token do bot
    const botInfo = await validateBotToken(botToken);
    
    if (!botInfo.success) {
      return { success: false, error: botInfo.error };
    }
    
    // Buscar usuário pelo telegram_id
    const { data: user, error: userError } = await db.supabase
      .from('users')
      .select('id')
      .eq('telegram_id', ownerTelegramId)
      .single();
    
    if (userError || !user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    // Verificar se bot já existe
    const { data: existing } = await db.supabase
      .from('bot_instances')
      .select('id, status')
      .eq('bot_token', botToken)
      .single();
    
    if (existing) {
      if (existing.status === 'pending') {
        return { success: false, error: 'Este bot já está aguardando aprovação' };
      }
      if (existing.status === 'active') {
        return { success: false, error: 'Este bot já está ativo na plataforma' };
      }
    }
    
    // Detectar tipo de chave PIX
    const pixKeyType = detectPixKeyType(pixKey);
    
    // Criar registro
    const { data, error } = await db.supabase
      .from('bot_instances')
      .insert([{
        owner_id: user.id,
        owner_telegram_id: ownerTelegramId,
        bot_token: botToken,
        bot_username: botInfo.username,
        bot_name: botName || botInfo.first_name,
        bot_id: botInfo.id,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        status: 'pending',
        is_active: false
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao criar solicitação de bot:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Validar token do bot no Telegram
 */
async function validateBotToken(token) {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    
    if (!response.data.ok) {
      return { success: false, error: 'Token inválido' };
    }
    
    const bot = response.data.result;
    
    if (!bot.is_bot) {
      return { success: false, error: 'Token não pertence a um bot' };
    }
    
    return {
      success: true,
      id: bot.id,
      username: bot.username,
      first_name: bot.first_name,
      can_join_groups: bot.can_join_groups,
      can_read_all_group_messages: bot.can_read_all_group_messages
    };
  } catch (err) {
    console.error('Erro ao validar token:', err);
    return { success: false, error: 'Não foi possível validar o token. Verifique se está correto.' };
  }
}

/**
 * Detectar tipo de chave PIX
 */
function detectPixKeyType(key) {
  if (key.includes('@')) return 'email';
  if (/^\d{11}$/.test(key)) return 'cpf';
  if (/^\d{14}$/.test(key)) return 'cnpj';
  if (/^\d{10,11}$/.test(key)) return 'phone';
  return 'random';
}

/**
 * Listar bots pendentes de aprovação
 */
async function getPendingBots() {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .select(`
        *,
        owner:owner_id(first_name, username, telegram_id)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar bots pendentes:', err);
    return [];
  }
}

/**
 * Aprovar bot
 */
async function approveBot(botInstanceId, approvedByTelegramId) {
  try {
    // Buscar admin que está aprovando
    const { data: admin, error: adminError } = await db.supabase
      .from('users')
      .select('id')
      .eq('telegram_id', approvedByTelegramId)
      .single();
    
    if (adminError || !admin) {
      return { success: false, error: 'Admin não encontrado' };
    }
    
    // Buscar bot
    const { data: botInstance, error: botError } = await db.supabase
      .from('bot_instances')
      .select('*')
      .eq('id', botInstanceId)
      .single();
    
    if (botError || !botInstance) {
      return { success: false, error: 'Bot não encontrado' };
    }
    
    // Configurar webhook
    const webhookResult = await setupWebhook(botInstance.bot_token);
    
    if (!webhookResult.success) {
      return { success: false, error: `Erro ao configurar webhook: ${webhookResult.error}` };
    }
    
    // Atualizar status
    const { data, error } = await db.supabase
      .from('bot_instances')
      .update({
        status: 'active',
        is_active: true,
        approved_by: admin.id,
        approved_at: new Date().toISOString(),
        webhook_url: webhookResult.webhookUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', botInstanceId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Criar role de owner para o criador
    await db.supabase
      .from('bot_roles')
      .insert([{
        user_id: botInstance.owner_id,
        bot_instance_id: botInstanceId,
        role: 'owner',
        permissions: { full_access: true }
      }]);
    
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao aprovar bot:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Rejeitar bot
 */
async function rejectBot(botInstanceId, reason = 'Não aprovado') {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', botInstanceId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao rejeitar bot:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Configurar webhook do bot
 */
async function setupWebhook(botToken) {
  try {
    // URL do webhook será a mesma para todos (identificamos pelo token no corpo)
    const webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/telegram-webhook`
      : process.env.WEBHOOK_URL || 'https://seu-dominio.vercel.app/api/telegram-webhook';
    
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        url: webhookUrl,
        drop_pending_updates: true
      }
    );
    
    if (!response.data.ok) {
      return { success: false, error: response.data.description };
    }
    
    return { success: true, webhookUrl };
  } catch (err) {
    console.error('Erro ao configurar webhook:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Obter bot por token
 */
async function getBotByToken(botToken) {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .select('*')
      .eq('bot_token', botToken)
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar bot por token:', err);
    return null;
  }
}

/**
 * Obter bot por username
 */
async function getBotByUsername(username) {
  try {
    // Remover @ se houver
    const cleanUsername = username.replace('@', '');
    
    const { data, error } = await db.supabase
      .from('bot_instances')
      .select('*')
      .eq('bot_username', cleanUsername)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar bot por username:', err);
    return null;
  }
}

/**
 * Obter bots de um usuário
 */
async function getUserBots(telegramId) {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .select('*')
      .eq('owner_telegram_id', telegramId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar bots do usuário:', err);
    return [];
  }
}

/**
 * Listar todos os bots ativos
 */
async function getAllActiveBots() {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .select(`
        *,
        owner:owner_id(first_name, username)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar bots ativos:', err);
    return [];
  }
}

/**
 * Suspender bot
 */
async function suspendBot(botInstanceId, reason = null) {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .update({
        status: 'suspended',
        is_active: false,
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', botInstanceId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao suspender bot:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reativar bot
 */
async function reactivateBot(botInstanceId) {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .update({
        status: 'active',
        is_active: true,
        rejection_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', botInstanceId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao reativar bot:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Atualizar estatísticas do bot
 */
async function updateBotStats(botInstanceId, { totalSales, totalRevenue, totalCustomers }) {
  try {
    const updates = {
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    };
    
    if (totalSales !== undefined) updates.total_sales = totalSales;
    if (totalRevenue !== undefined) updates.total_revenue = totalRevenue;
    if (totalCustomers !== undefined) updates.total_customers = totalCustomers;
    
    const { error } = await db.supabase
      .from('bot_instances')
      .update(updates)
      .eq('id', botInstanceId);
    
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Erro ao atualizar estatísticas:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Verificar se usuário é dono de um bot
 */
async function isUserBotOwner(telegramId, botInstanceId) {
  try {
    const { data, error } = await db.supabase
      .from('bot_instances')
      .select('id')
      .eq('id', botInstanceId)
      .eq('owner_telegram_id', telegramId)
      .single();
    
    if (error) return false;
    return !!data;
  } catch (err) {
    return false;
  }
}

/**
 * Obter estatísticas globais (super admin)
 */
async function getGlobalStats() {
  try {
    // Total de bots
    const { count: totalBots } = await db.supabase
      .from('bot_instances')
      .select('*', { count: 'exact', head: true });
    
    // Bots ativos
    const { count: activeBots } = await db.supabase
      .from('bot_instances')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // Bots pendentes
    const { count: pendingBots } = await db.supabase
      .from('bot_instances')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    // Total de vendas e receita
    const { data: botsData } = await db.supabase
      .from('bot_instances')
      .select('total_sales, total_revenue, total_customers');
    
    const totalSales = botsData?.reduce((sum, b) => sum + (b.total_sales || 0), 0) || 0;
    const totalRevenue = botsData?.reduce((sum, b) => sum + parseFloat(b.total_revenue || 0), 0) || 0;
    const totalCustomers = botsData?.reduce((sum, b) => sum + (b.total_customers || 0), 0) || 0;
    
    return {
      totalBots: totalBots || 0,
      activeBots: activeBots || 0,
      pendingBots: pendingBots || 0,
      suspendedBots: (totalBots || 0) - (activeBots || 0) - (pendingBots || 0),
      totalSales,
      totalRevenue: totalRevenue.toFixed(2),
      totalCustomers
    };
  } catch (err) {
    console.error('Erro ao buscar estatísticas globais:', err);
    return {
      totalBots: 0,
      activeBots: 0,
      pendingBots: 0,
      suspendedBots: 0,
      totalSales: 0,
      totalRevenue: '0.00',
      totalCustomers: 0
    };
  }
}

module.exports = {
  createBotRequest,
  validateBotToken,
  getPendingBots,
  approveBot,
  rejectBot,
  setupWebhook,
  getBotByToken,
  getBotByUsername,
  getUserBots,
  getAllActiveBots,
  suspendBot,
  reactivateBot,
  updateBotStats,
  isUserBotOwner,
  getGlobalStats
};

