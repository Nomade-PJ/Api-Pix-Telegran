// src/db/tickets.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');


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

// ===== SISTEMA DE CONFIANÇA E APRENDIZADO =====

/**
 * Busca informações de usuário confiável
 */
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

// ===== SISTEMA DE RESPOSTAS AUTOMÁTICAS =====

/**
 * Busca resposta automática para uma palavra-chave

module.exports = {
  createSupportTicket,
  getSupportTicket,
  getUserTickets,
  getAllOpenTickets,
  addTicketMessage,
  getTicketMessages,
  updateTicketStatus,
  assignTicket,
  getTrustedUser,
  updateTrustedUser,
  addTrustedUser
};
