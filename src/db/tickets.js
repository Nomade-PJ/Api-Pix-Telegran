// src/db/tickets.js
const { supabase } = require('./client');

// ===== SISTEMA DE TICKETS DE SUPORTE =====

/**
 * Cria um novo ticket de suporte
 */
async function createSupportTicket(telegramId, userId, subject, message) {
  try {
    // Gerar número do ticket manualmente
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // Buscar último ticket do dia
    const { data: lastTicket } = await supabase
      .from('support_tickets')
      .select('ticket_number')
      .like('ticket_number', `TKT-${today}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let ticketNumber;
    if (lastTicket && lastTicket.ticket_number) {
      const lastNum = parseInt(lastTicket.ticket_number.split('-')[2]) || 0;
      ticketNumber = `TKT-${today}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      ticketNumber = `TKT-${today}-0001`;
    }
    
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        telegram_id: telegramId,
        ticket_number: ticketNumber,
        subject: subject || 'Sem assunto',
        message: message,
        status: 'open'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Adicionar mensagem inicial
    await supabase
      .from('support_messages')
      .insert({
        ticket_id: data.id,
        user_id: userId,
        is_admin: false,
        message: message
      });
    
    return data;
  } catch (err) {
    console.error('Erro ao criar ticket:', err);
    throw err;
  }
}

/**
 * Busca um ticket por número ou ID
 */
async function getSupportTicket(ticketNumberOrId) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .or(`ticket_number.eq.${ticketNumberOrId},id.eq.${ticketNumberOrId}`)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao buscar ticket:', err);
    return null;
  }
}

/**
 * Busca todos os tickets de um usuário
 */
async function getUserTickets(telegramId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar tickets do usuário:', err);
    return [];
  }
}

/**
 * Busca todos os tickets abertos (para admins)
 */
async function getAllOpenTickets(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select(`
        *,
        users:user_id (first_name, username, telegram_id)
      `)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar tickets abertos:', err);
    return [];
  }
}

/**
 * Adiciona uma mensagem a um ticket
 */
async function addTicketMessage(ticketId, userId, message, isAdmin = false) {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        is_admin: isAdmin,
        message: message
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Atualizar updated_at do ticket
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);
    
    return data;
  } catch (err) {
    console.error('Erro ao adicionar mensagem ao ticket:', err);
    throw err;
  }
}

/**
 * Busca todas as mensagens de um ticket
 */
async function getTicketMessages(ticketId) {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`
        *,
        users:user_id (first_name, username, telegram_id)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar mensagens do ticket:', err);
    return [];
  }
}

/**
 * Atualiza o status de um ticket
 */
async function updateTicketStatus(ticketId, status, adminId = null) {
  try {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'resolved' && !updateData.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }
    if (status === 'closed' && !updateData.closed_at) {
      updateData.closed_at = new Date().toISOString();
    }
    if (adminId) {
      updateData.assigned_to = adminId;
    }
    
    const { data, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar status do ticket:', err);
    throw err;
  }
}

/**
 * Atribui um ticket a um admin
 */
async function assignTicket(ticketId, adminId) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        assigned_to: adminId,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atribuir ticket:', err);
    throw err;
  }
}


module.exports = {
  createSupportTicket,
  getSupportTicket,
  getUserTickets,
  getAllOpenTickets,
  addTicketMessage,
  getTicketMessages,
  updateTicketStatus,
  assignTicket
};
