// src/modules/notifications.js
const db = require('../database');

/**
 * Agendar notificação automática
 */
async function scheduleNotification(type, userId, transactionId, message, delayMinutes) {
  try {
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + delayMinutes);
    
    const { data, error } = await db.supabase
      .from('automated_notifications')
      .insert([{
        type,
        user_id: userId,
        transaction_id: transactionId,
        message,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao agendar notificação:', err);
    return null;
  }
}

/**
 * Buscar notificações pendentes para enviar
 */
async function getPendingNotifications() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await db.supabase
      .from('automated_notifications')
      .select(`
        *,
        user:user_id(telegram_id, first_name)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar notificações pendentes:', err);
    return [];
  }
}

/**
 * Marcar notificação como enviada
 */
async function markAsSent(notificationId) {
  try {
    const { error } = await db.supabase
      .from('automated_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', notificationId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao marcar notificação como enviada:', err);
    return false;
  }
}

/**
 * Marcar notificação como falha
 */
async function markAsFailed(notificationId) {
  try {
    const { error } = await db.supabase
      .from('automated_notifications')
      .update({
        status: 'failed'
      })
      .eq('id', notificationId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao marcar notificação como falha:', err);
    return false;
  }
}

/**
 * Cancelar notificação
 */
async function cancelNotification(notificationId) {
  try {
    const { error } = await db.supabase
      .from('automated_notifications')
      .update({
        status: 'cancelled'
      })
      .eq('id', notificationId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao cancelar notificação:', err);
    return false;
  }
}

/**
 * Agendar notificação de boas-vindas (após 1h)
 */
async function scheduleWelcomeNotification(userId) {
  const message = '👋 Olá! Está com alguma dúvida? Estou aqui para ajudar!\n\nVeja nossos produtos disponíveis com /start';
  return scheduleNotification('welcome', userId, null, message, 60);
}

/**
 * Agendar notificação de carrinho abandonado
 */
async function scheduleAbandonedCartNotification(userId, transactionId) {
  const message = '🛒 Vimos que você gerou um PIX mas ainda não finalizou o pagamento.\n\n💡 Precisa de ajuda? Entre em contato conosco!\n\nPara ver o PIX novamente, envie /start';
  return scheduleNotification('abandoned_cart', userId, transactionId, message, 120); // 2 horas
}

/**
 * Agendar notificação pós-venda
 */
async function schedulePostSaleNotification(userId, transactionId) {
  const message = '⭐ Como foi sua experiência com nosso produto?\n\nSua opinião é muito importante para nós!\n\nAvalie agora e nos ajude a melhorar! 🙏';
  return scheduleNotification('post_sale', userId, transactionId, message, 1440); // 24 horas
}

/**
 * Estatísticas de notificações
 */
async function getNotificationStats() {
  try {
    const { data, error } = await db.supabase
      .from('automated_notifications')
      .select('type, status');
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      pending: data.filter(n => n.status === 'pending').length,
      sent: data.filter(n => n.status === 'sent').length,
      failed: data.filter(n => n.status === 'failed').length,
      byType: {}
    };
    
    data.forEach(n => {
      if (!stats.byType[n.type]) {
        stats.byType[n.type] = { total: 0, sent: 0 };
      }
      stats.byType[n.type].total++;
      if (n.status === 'sent') {
        stats.byType[n.type].sent++;
      }
    });
    
    return stats;
  } catch (err) {
    console.error('Erro ao buscar stats de notificações:', err);
    return null;
  }
}

module.exports = {
  scheduleNotification,
  getPendingNotifications,
  markAsSent,
  markAsFailed,
  cancelNotification,
  scheduleWelcomeNotification,
  scheduleAbandonedCartNotification,
  schedulePostSaleNotification,
  getNotificationStats
};

