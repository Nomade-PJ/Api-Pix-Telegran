// src/db/reports.js
const { supabase } = require('./client');

async function getMonthlyUsers() {
  // Adicionar retry logic para erros de conexão
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      // Calcular data de 30 dias atrás
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Buscar usuários criados ou atualizados nos últimos 30 dias
      // Usuários mensais = usuários que interagiram com o bot nos últimos 30 dias
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());
      
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
            console.warn(`⚠️ [DB] Erro de conexão ao buscar usuários mensais: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue;
          } else {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar usuários mensais após 3 tentativas - retornando 0`);
            return 0;
          }
        } else {
          throw error;
        }
      }
      
      return count || 0;
      
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
          console.warn(`⚠️ [DB] Erro de conexão ao buscar usuários mensais: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue;
        } else {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar usuários mensais após 3 tentativas - retornando 0`);
          return 0;
        }
      } else {
        console.error('❌ [DB] Erro ao buscar usuários mensais:', err.message);
        return 0;
      }
    }
  }
  
  return 0;
}

// Função para gerar relatório detalhado de usuários
async function getUserReport() {
  try {
    // Total de usuários
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Usuários que compraram (têm transações entregues)
    const { data: usersWhoBought } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('status', 'delivered');
    
    const uniqueBuyers = new Set(usersWhoBought?.map(t => t.user_id) || []);
    const usersWhoBoughtCount = uniqueBuyers.size;
    
    // Usuários desbloqueados/liberados (is_blocked = false)
    const { count: unblockedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_blocked', false);
    
    // Usuários bloqueados (is_blocked = true)
    const { count: blockedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_blocked', true);
    
    // Usuários desbloqueados que NÃO compraram
    const { data: unblockedWithoutPurchase } = await supabase
      .from('users')
      .select('id')
      .eq('is_blocked', false);
    
    const unblockedIds = unblockedWithoutPurchase?.map(u => u.id) || [];
    let unblockedWhoBought = new Set();
    
    if (unblockedIds.length > 0) {
      const { data: purchasesFromUnblocked } = await supabase
        .from('transactions')
        .select('user_id')
        .eq('status', 'delivered')
        .in('user_id', unblockedIds);
      
      unblockedWhoBought = new Set(purchasesFromUnblocked?.map(t => t.user_id) || []);
    }
    
    const unblockedWithoutPurchaseCount = unblockedIds.length - unblockedWhoBought.size;
    
    // Usuários bloqueados por DDD
    // Buscar DDDs bloqueados
    const { data: blockedDDDs } = await supabase
      .from('blocked_area_codes')
      .select('area_code');
    
    const blockedDDDList = blockedDDDs?.map(d => d.area_code) || [];
    
    let usersBlockedByDDD = 0; // Bloqueados por DDD que NÃO foram liberados
    let usersBlockedByDDDDetails = [];
    let usersWithBlockedDDDButUnlocked = 0; // Liberados manualmente mas têm DDD bloqueado
    
    if (blockedDDDList.length > 0) {
      // Buscar todos os usuários com telefone, admin e creator status
      const { data: usersWithPhone } = await supabase
        .from('users')
        .select('id, telegram_id, phone_number, is_blocked, is_admin, is_creator, first_name, username');
      
      if (usersWithPhone) {
        // Separar admins e creators
        const adminIds = new Set();
        const creatorIds = new Set();
        
        for (const user of usersWithPhone) {
          if (user.is_admin) adminIds.add(user.id);
          if (user.is_creator) creatorIds.add(user.id);
        }
        
        // Filtrar usuários com DDD bloqueado (todos que tentaram acessar com DDD bloqueado)
        const usersWithBlockedDDD = usersWithPhone.filter(user => {
          if (!user.phone_number) return false;
          const areaCode = extractAreaCode(user.phone_number);
          return areaCode && blockedDDDList.includes(areaCode);
        });
        
        // TODOS os usuários que tentaram acessar com DDD bloqueado (exceto admin/creator que não são afetados)
        // Isso inclui tanto os que ainda estão bloqueados quanto os que foram liberados depois
        const allBlockedByDDDUsers = usersWithBlockedDDD.filter(user => {
          // Admin e creator não são bloqueados por DDD (bypass automático)
          if (adminIds.has(user.id) || creatorIds.has(user.id)) return false;
          // Todos os outros que têm DDD bloqueado tentaram acessar e foram bloqueados
          return true;
        });
        
        // Dos que foram bloqueados por DDD, quantos foram DESBLOQUEADOS MANUALMENTE
        // (is_blocked = false significa que foi liberado manualmente)
        const unblockedButWithBlockedDDD = allBlockedByDDDUsers.filter(user => {
          // Se is_blocked = false, foi desbloqueado manualmente
          if (user.is_blocked === false) return true;
          return false;
        });
        
        // Usuários que ainda estão bloqueados por DDD (não foram liberados)
        const stillBlockedByDDD = allBlockedByDDDUsers.filter(user => {
          // Se is_blocked = false, foi liberado (não está mais bloqueado)
          if (user.is_blocked === false) return false;
          // Se is_blocked = true ou null, ainda está bloqueado
          return true;
        });
        
        // Total de usuários que foram bloqueados por DDD (inclui liberados e não liberados)
        usersBlockedByDDD = allBlockedByDDDUsers.length;
        usersWithBlockedDDDButUnlocked = unblockedButWithBlockedDDD.length;
        
        // Lista detalhada dos que ainda estão bloqueados (não foram liberados)
        usersBlockedByDDDDetails = stillBlockedByDDD.map(u => ({
          telegram_id: u.telegram_id,
          name: u.first_name || u.username || 'Sem nome',
          phone: u.phone_number,
          ddd: extractAreaCode(u.phone_number)
        }));
      }
    }
    
    // Calcular percentuais
    const buyRate = totalUsers > 0 ? ((usersWhoBoughtCount / totalUsers) * 100).toFixed(2) : '0.00';
    const unblockedBuyRate = unblockedUsers > 0 ? ((unblockedWhoBought.size / unblockedUsers) * 100).toFixed(2) : '0.00';
    
    return {
      totalUsers: totalUsers || 0,
      usersWhoBought: usersWhoBoughtCount,
      unblockedUsers: unblockedUsers || 0,
      blockedUsers: blockedUsers || 0,
      unblockedWithoutPurchase: unblockedWithoutPurchaseCount,
      usersBlockedByDDD: usersBlockedByDDD,
      usersBlockedByDDDDetails: usersBlockedByDDDDetails,
      usersWithBlockedDDDButUnlocked: usersWithBlockedDDDButUnlocked,
      buyRate: buyRate,
      unblockedBuyRate: unblockedBuyRate,
      unblockedWhoBought: unblockedWhoBought.size
    };
    
  } catch (err) {
    console.error('Erro ao gerar relatório de usuários:', err.message);
    return {
      totalUsers: 0,
      usersWhoBought: 0,
      unblockedUsers: 0,
      blockedUsers: 0,
      unblockedWithoutPurchase: 0,
      usersBlockedByDDD: 0,
      usersBlockedByDDDDetails: [],
      usersWithBlockedDDDButUnlocked: 0,
      buyRate: '0.00',
      unblockedBuyRate: '0.00',
      unblockedWhoBought: 0
    };
  }
}

// ===== GERENCIAMENTO DE BLOQUEIOS (BYPASS) =====

/**
 * Desbloqueia usuário por ID do Telegram
 * Cria o usuário se não existir (UPSERT)
 */
async function unblockUserByTelegramId(telegramId) {
  try {
    console.log(`🔓 [UNBLOCK] Desbloqueando usuário ${telegramId}...`);
    
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          telegram_id: telegramId,
          is_blocked: false,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'telegram_id',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();
    
    if (error) {
      console.error('❌ [UNBLOCK] Erro ao desbloquear:', error);
      throw error;
    }
    
    console.log(`✅ [UNBLOCK] Usuário ${telegramId} desbloqueado com sucesso`);
    return data;
  } catch (err) {
    console.error('❌ [UNBLOCK] Erro crítico:', err);
    throw err;
  }
}

/**
 * Bloqueia usuário por ID do Telegram
 * Cria o usuário se não existir (UPSERT)
 */
async function blockUserByTelegramId(telegramId) {
  try {
    console.log(`🔒 [BLOCK] Bloqueando usuário ${telegramId}...`);
    
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          telegram_id: telegramId,
          is_blocked: true,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'telegram_id',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();
    
    if (error) {
      console.error('❌ [BLOCK] Erro ao bloquear:', error);
      throw error;
    }
    
    console.log(`✅ [BLOCK] Usuário ${telegramId} bloqueado com sucesso`);
    return data;
  } catch (err) {
    console.error('❌ [BLOCK] Erro crítico:', err);
    throw err;
  }
}

/**
 * Verifica status de bloqueio de um usuário
 */
async function checkBlockStatus(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('telegram_id, first_name, username, is_blocked, phone_number')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Usuário não existe
      return null;
    }
    
    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('❌ [CHECK-BLOCK] Erro:', err);
    return null;
  }
}


module.exports = {
  getMonthlyUsers,
  getUserReport,
  unblockUserByTelegramId,
  blockUserByTelegramId,
  checkBlockStatus
};
