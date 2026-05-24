// src/db/groups.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');


async function getAllGroups() {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar grupos:', err.message);
    return [];
  }
}

async function getGroupById(groupId) {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('group_id', groupId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar grupo:', err.message);
    return null;
  }
}

async function createGroup({ groupId, groupName, groupLink, price, days }) {
  try {
    const { data, error } = await supabase
      .from('groups')
      .insert([{
        group_id: groupId,
        group_name: groupName,
        group_link: groupLink,
        subscription_price: price,
        subscription_days: days
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Grupo criado:', groupId);
    return data;
  } catch (err) {
    console.error('Erro ao criar grupo:', err.message);
    throw err;
  }
}

async function updateGroup(groupId, updates) {
  try {
    const { data, error } = await supabase
      .from('groups')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('group_id', groupId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar grupo:', err.message);
    throw err;
  }
}

async function deleteGroup(groupId) {
  try {
    // 1. Buscar UUID interno do grupo pelo group_id (bigint do Telegram)
    const { data: groupRow, error: findError } = await supabase
      .from('groups')
      .select('id')
      .eq('group_id', groupId)
      .single();

    if (findError || !groupRow) {
      console.error('Grupo não encontrado para deletar:', groupId);
      return false;
    }

    const groupUuid = groupRow.id;

    // 2. Remover membros do grupo (FK: group_members.group_id → groups.id)
    const { error: membersError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupUuid);

    if (membersError) {
      console.error('Erro ao remover membros do grupo:', membersError.message);
      throw membersError;
    }
    console.log(`Membros do grupo ${groupId} removidos.`);

    // 3. Desassociar transações do grupo (não deletar — apenas NULL o group_id para preservar histórico)
    const { error: txError } = await supabase
      .from('transactions')
      .update({ group_id: null })
      .eq('group_id', groupUuid);

    if (txError) {
      console.error('Erro ao desassociar transações do grupo:', txError.message);
      throw txError;
    }
    console.log(`Transações do grupo ${groupId} desassociadas.`);

    // 4. Agora sim deletar o grupo
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('group_id', groupId);

    if (deleteError) throw deleteError;

    console.log('Grupo deletado permanentemente:', groupId);
    return true;
  } catch (err) {
    console.error('Erro ao deletar grupo:', err.message);
    return false;
  }
}

async function addGroupMember({ telegramId, userId, groupId, days = 30 }) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    
    // 🆕 VERIFICAR SE JÁ EXISTE MEMBRO PARA ESTE GRUPO (independente do status)
    // A constraint única é em (telegram_id, group_id), então precisamos verificar
    // independente do status para evitar erro de duplicate key
    const { data: existingMember, error: checkError } = await supabase
      .from('group_members')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('group_id', groupId)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    let result;
    
    if (existingMember) {
      // 🆕 RENOVAR ASSINATURA EXISTENTE (UPDATE)
      // Atualizar mesmo se status for 'expired' ou outro
      console.log(`🔄 [DB] Renovando assinatura existente para usuário ${telegramId} no grupo ${groupId} (status atual: ${existingMember.status || 'N/A'})`);
      
      const { data: updated, error: updateError } = await supabase
        .from('group_members')
        .update({
          expires_at: expiresAt.toISOString(),
          status: 'active',
          reminded_at: null, // Resetar lembrete
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMember.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      result = updated;
      console.log(`✅ [DB] Assinatura renovada: usuário ${telegramId} - expira em ${expiresAt.toLocaleDateString('pt-BR')}`);
    } else {
      // 🆕 CRIAR NOVA ASSINATURA (INSERT)
      console.log(`➕ [DB] Criando nova assinatura para usuário ${telegramId} no grupo ${groupId}`);
      
      const { data: inserted, error: insertError } = await supabase
        .from('group_members')
        .insert([{
          telegram_id: telegramId,
          user_id: userId,
          group_id: groupId,
          expires_at: expiresAt.toISOString(),
          status: 'active'
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      result = inserted;
      console.log(`✅ [DB] Nova assinatura criada: usuário ${telegramId} - expira em ${expiresAt.toLocaleDateString('pt-BR')}`);
    }
    
    return result;
  } catch (err) {
    console.error('❌ [DB] Erro ao adicionar/renovar membro:', err.message);
    throw err;
  }
}

async function getExpiringMembers() {
  // Adicionar retry logic para erros de conexão
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      // Buscar membros que expiram em até 3 dias
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          user:user_id(first_name, telegram_id),
          group:group_id(id, group_name, group_id, subscription_price, subscription_days)
        `)
        .eq('status', 'active')
        .lte('expires_at', threeDaysFromNow.toISOString())
        .gte('expires_at', new Date().toISOString()) // Ainda não expirou
        .is('reminded_at', null);
      
      if (error) {
        // Verificar se é erro de conexão
        const errorMessage = error.message || '';
        const errorDetails = error.details || '';
        const errorString = JSON.stringify(error);
        
        const isConnectionError = (
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('SocketError') ||
          errorMessage.includes('other side closed') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('UND_ERR_SOCKET') ||
          errorDetails.includes('UND_ERR_SOCKET') ||
          errorDetails.includes('other side closed') ||
          errorDetails.includes('SocketError') ||
          errorDetails.includes('ETIMEDOUT') ||
          errorString.includes('UND_ERR_SOCKET') ||
          errorString.includes('ETIMEDOUT')
        );
        
        if (isConnectionError) {
          lastError = error;
          retries--;
          
          if (retries > 0) {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirando: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue;
          } else {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirando após 3 tentativas - retornando array vazio`);
            return [];
          }
        } else {
          throw error;
        }
      }
      
      return data || [];
      
    } catch (err) {
      const errorMessage = err.message || '';
      const errorDetails = err.details || '';
      const errorString = JSON.stringify(err);
      
      const isConnectionError = (
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('SocketError') ||
        errorMessage.includes('other side closed') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('UND_ERR_SOCKET') ||
        errorDetails.includes('UND_ERR_SOCKET') ||
        errorDetails.includes('other side closed') ||
        errorDetails.includes('SocketError') ||
        errorDetails.includes('ETIMEDOUT') ||
        errorString.includes('UND_ERR_SOCKET') ||
        errorString.includes('ETIMEDOUT')
      );
      
      if (isConnectionError) {
        lastError = err;
        retries--;
        
        if (retries > 0) {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirando: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue;
        } else {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirando após 3 tentativas - retornando array vazio`);
          return [];
        }
      } else {
        console.error('❌ [DB] Erro ao buscar membros expirando:', err.message);
        return [];
      }
    }
  }
  
  return [];
}

// 🆕 NOVA FUNÇÃO: Buscar membros que expiram HOJE (para lembrete no dia do vencimento)
async function getExpiringToday() {
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      // Buscar membros que expiram HOJE e ainda não foram lembrados hoje
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          user:user_id(first_name, telegram_id),
          group:group_id(id, group_name, group_id, subscription_price, subscription_days)
        `)
        .eq('status', 'active')
        .gte('expires_at', startOfToday.toISOString())
        .lte('expires_at', endOfToday.toISOString())
        .or(`reminded_at.is.null,reminded_at.lt.${startOfToday.toISOString()}`);
      
      if (error) {
        const errorMessage = error.message || '';
        const errorDetails = error.details || '';
        const errorString = JSON.stringify(error);
        
        const isConnectionError = (
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('SocketError') ||
          errorMessage.includes('other side closed') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('UND_ERR_SOCKET') ||
          errorDetails.includes('UND_ERR_SOCKET') ||
          errorDetails.includes('other side closed') ||
          errorDetails.includes('SocketError') ||
          errorDetails.includes('ETIMEDOUT') ||
          errorString.includes('UND_ERR_SOCKET') ||
          errorString.includes('ETIMEDOUT')
        );
        
        if (isConnectionError) {
          lastError = error;
          retries--;
          
          if (retries > 0) {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirando hoje: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue;
          } else {
            console.warn(`⚠️ [DB] Erro de conexão após 3 tentativas - retornando array vazio`);
            return [];
          }
        } else {
          throw error;
        }
      }
      
      return data || [];
      
    } catch (err) {
      const errorMessage = err.message || '';
      const errorDetails = err.details || '';
      const errorString = JSON.stringify(err);
      
      const isConnectionError = (
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('SocketError') ||
        errorMessage.includes('other side closed') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('UND_ERR_SOCKET') ||
        errorDetails.includes('UND_ERR_SOCKET') ||
        errorDetails.includes('other side closed') ||
        errorDetails.includes('SocketError') ||
        errorDetails.includes('ETIMEDOUT') ||
        errorString.includes('UND_ERR_SOCKET') ||
        errorString.includes('ETIMEDOUT')
      );
      
      if (isConnectionError) {
        lastError = err;
        retries--;
        
        if (retries > 0) {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirando hoje: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue;
        } else {
          console.warn(`⚠️ [DB] Erro de conexão após 3 tentativas - retornando array vazio`);
          return [];
        }
      } else {
        console.error('❌ [DB] Erro ao buscar membros expirando hoje:', err.message);
        return [];
      }
    }
  }
  
  return [];
}

async function getExpiredMembers() {
  // 🆕 AJUSTADO: Buscar membros que expiraram há MAIS de 1 dia (prazo de graça)
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const now = new Date();
      // 🆕 Considerar 1 dia de tolerância (remover apenas se expirou há mais de 1 dia)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          user:user_id(telegram_id),
          group:group_id(group_id, group_name, subscription_price, subscription_days)
        `)
        .eq('status', 'active')
        .lt('expires_at', oneDayAgo.toISOString()); // 🆕 Expirou há mais de 1 dia
      
      if (error) {
        // Verificar se é erro de conexão
        const errorMessage = error.message || '';
        const errorDetails = error.details || '';
        const errorString = JSON.stringify(error);
        
        const isConnectionError = (
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('SocketError') ||
          errorMessage.includes('other side closed') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('UND_ERR_SOCKET') ||
          errorDetails.includes('UND_ERR_SOCKET') ||
          errorDetails.includes('other side closed') ||
          errorDetails.includes('SocketError') ||
          errorDetails.includes('ETIMEDOUT') ||
          errorString.includes('UND_ERR_SOCKET') ||
          errorString.includes('ETIMEDOUT')
        );
        
        if (isConnectionError) {
          lastError = error;
          retries--;
          
          if (retries > 0) {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirados: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue;
          } else {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirados após 3 tentativas - retornando array vazio`);
            return [];
          }
        } else {
          throw error;
        }
      }
      
      return data || [];
      
    } catch (err) {
      const errorMessage = err.message || '';
      const errorDetails = err.details || '';
      const errorString = JSON.stringify(err);
      
      const isConnectionError = (
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('SocketError') ||
        errorMessage.includes('other side closed') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('UND_ERR_SOCKET') ||
        errorDetails.includes('UND_ERR_SOCKET') ||
        errorDetails.includes('other side closed') ||
        errorDetails.includes('SocketError') ||
        errorDetails.includes('ETIMEDOUT') ||
        errorString.includes('UND_ERR_SOCKET') ||
        errorString.includes('ETIMEDOUT')
      );
      
      if (isConnectionError) {
        lastError = err;
        retries--;
        
        if (retries > 0) {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirados: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue;
        } else {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar membros expirados após 3 tentativas - retornando array vazio`);
          return [];
        }
      } else {
        console.error('❌ [DB] Erro ao buscar membros expirados:', err.message);
        return [];
      }
    }
  }
  
  return [];
}

async function markMemberReminded(memberId) {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({
        reminded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao marcar lembrado:', err.message);
    return false;
  }
}

async function expireMember(memberId) {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao expirar membro:', err.message);
    return false;
  }
}

async function getGroupMember(telegramId, groupId) {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  } catch (err) {
    console.error('Erro ao buscar membro:', err.message);
    return null;
  }
}

// ===== CACHE OCR =====

/**
 * Verifica se já existe análise OCR para uma transação
 * Retorna o resultado se existir, null caso contrário
 */

module.exports = {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMember,
  getExpiringMembers,
  getExpiringToday,
  getExpiredMembers,
  markMemberReminded,
  expireMember,
  getGroupMember
};
