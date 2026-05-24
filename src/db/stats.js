// src/db/stats.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');


function getTodayStartBrasil() {
  const now = new Date();
  
  // Obter componentes da data atual no timezone de Brasília
  const brasilDateStr = now.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Formato: "DD/MM/YYYY"
  const [day, month, year] = brasilDateStr.split('/');
  
  // Criar data no início do dia de hoje em Brasília (00:00:00)
  // Formato ISO: YYYY-MM-DDTHH:mm:ss (sem timezone, será tratado como UTC-3)
  const brasilMidnight = `${year}-${month}-${day}T00:00:00`;
  
  // Criar objeto Date que representa 00:00:00 no horário de Brasília
  // O JavaScript cria em UTC, então precisamos ajustar
  // Brasília é UTC-3, então 00:00 em Brasília = 03:00 UTC do mesmo dia
  const utcMidnight = new Date(`${year}-${month}-${day}T03:00:00Z`);
  
  return utcMidnight.toISOString();
}

// Função para obter início do período atual em Brasília
// Regra de negócio: período vai do dia 17 ao dia 17 do mês seguinte
function getMonthStartBrasil() {
  const now = new Date();

  // Obter componentes da data atual no timezone de Brasília
  const brasilDateStr = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Formato: "DD/MM/YYYY"
  const [day, month, year] = brasilDateStr.split('/');
  const dayInt   = parseInt(day);
  const monthInt = parseInt(month);
  const yearInt  = parseInt(year);

  // Se hoje >= dia 17 → período começa no dia 17 deste mês
  // Se hoje < dia 17  → período começa no dia 17 do mês anterior
  let periodYear, periodMonth;
  if (dayInt >= 17) {
    periodYear  = yearInt;
    periodMonth = monthInt;
  } else {
    periodMonth = monthInt - 1;
    periodYear  = yearInt;
    if (periodMonth < 1) {
      periodMonth = 12;
      periodYear--;
    }
  }

  const periodMonthStr = String(periodMonth).padStart(2, '0');

  // Início do período: dia 17 às 00:00:00 Brasília = 03:00:00 UTC
  const utcPeriodStart = new Date(`${periodYear}-${periodMonthStr}-17T03:00:00Z`);

  return utcPeriodStart.toISOString();
}

// Função para obter início do período ANTERIOR em Brasília
// Regra de negócio: período vai do dia 17 ao dia 17 do mês seguinte
// Período anterior = um mês antes do início do período atual
function getPreviousMonthStartBrasil() {
  const now = new Date();

  // Obter componentes da data atual no timezone de Brasília
  const brasilDateStr = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Formato: "DD/MM/YYYY"
  const [day, month, year] = brasilDateStr.split('/');
  const dayInt   = parseInt(day);
  const monthInt = parseInt(month);
  const yearInt  = parseInt(year);

  // Primeiro: calcular início do período atual (dia 17)
  let currentPeriodMonth, currentPeriodYear;
  if (dayInt >= 17) {
    currentPeriodMonth = monthInt;
    currentPeriodYear  = yearInt;
  } else {
    currentPeriodMonth = monthInt - 1;
    currentPeriodYear  = yearInt;
    if (currentPeriodMonth < 1) {
      currentPeriodMonth = 12;
      currentPeriodYear--;
    }
  }

  // Período anterior = um mês antes do período atual
  let prevMonth = currentPeriodMonth - 1;
  let prevYear  = currentPeriodYear;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }

  const prevMonthStr = String(prevMonth).padStart(2, '0');

  // Início do período anterior: dia 17 às 00:00:00 Brasília = 03:00:00 UTC
  const utcPrevStart = new Date(`${prevYear}-${prevMonthStr}-17T03:00:00Z`);

  return utcPrevStart.toISOString();
}

async function getStats(useCache = true) {
  try {
    // 🚀 CACHE: Verificar se existe no cache (TTL de 30 segundos)
    const cacheKey = 'stats_admin';
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('⚡ [STATS] Retornando do cache');
        return cached;
      }
    }
    
    // ── Buscar stats admin direto da view do banco (regra desde 17/04) ──────
    const { data: sv, error: svErr } = await supabase
      .from('stats_periodo')
      .select('*')
      .single();

    if (svErr) {
      console.error('❌ [STATS] Erro ao buscar stats_periodo:', svErr.message);
      throw svErr;
    }

    const totalUsers           = parseInt(sv.usuarios_desde_17)        || 0;
    const totalTransactions    = parseInt(sv.transacoes_desde_17)       || 0;
    const pendingTransactions  = 0; // zerado por regra de negócio
    const deliveredTransactions= parseInt(sv.total_aprovadas)           || 0;
    const approvedTransactions = deliveredTransactions;
    const validatedTransactions= 0;
    const rejectedTransactions = 0;
    const totalSales           = parseFloat(sv.total_vendas)            || 0;
    const todaySales           = parseFloat(sv.hoje_vendas)             || 0;
    const todayTransactions    = parseInt(sv.hoje_aprovadas)            || 0;
    const avgTicket            = deliveredTransactions > 0
      ? (totalSales / deliveredTransactions).toFixed(2) : '0.00';

    console.log('💰 [STATS] Via view banco (desde 17/04) — Usuários:', totalUsers, '| Transações:', totalTransactions, '| Vendas: R$', totalSales.toFixed(2));

    return {
      totalUsers,
      totalTransactions,
      pendingTransactions,
      validatedTransactions,
      deliveredTransactions,
      totalSales: totalSales.toFixed(2),
      avgTicket,
      approvedTransactions,
      rejectedTransactions,
      todaySales: todaySales.toFixed(2),
      todayTransactions: todayTransactions || 0
    };
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    return {
      totalUsers: 0,
      totalTransactions: 0,
      pendingTransactions: 0,
      validatedTransactions: 0,
      deliveredTransactions: 0,
      totalSales: '0.00',
      avgTicket: '0.00',
      approvedTransactions: 0,
      rejectedTransactions: 0,
      todaySales: '0.00',
      todayTransactions: 0
    };
  }
}

// Estatísticas para criadores (apenas transações entregues - mesmo padrão do painel admin)
async function getCreatorStats(useCache = true) {
  try {
    // 🚀 CACHE: Verificar se existe no cache (TTL de 30 segundos)
    const cacheKey = 'stats_creator';
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('⚡ [CREATOR-STATS] Retornando do cache');
        return cached;
      }
    }
    
    // ── Buscar estatísticas direto da view do banco (regra dia 17) ──────────
    // A view stats_periodo usa get_period_start() que aplica a regra dia 17
    // Sem depender de lógica JavaScript — calculado 100% no Supabase
    const { data: statsView, error: statsError } = await supabase
      .from('stats_periodo')
      .select('*')
      .single();

    if (statsError) {
      console.error('❌ [CREATOR-STATS] Erro ao buscar stats_periodo:', statsError.message);
      throw statsError;
    }

    const approvedCount        = parseInt(statsView.total_aprovadas)         || 0;
    const pendingCount         = parseInt(statsView.total_pendentes)         || 0;
    const totalSales           = parseFloat(statsView.total_vendas)          || 0;
    const monthSales           = parseFloat(statsView.periodo_vendas)        || 0;
    const monthTransactions    = parseInt(statsView.periodo_aprovadas)       || 0;
    const prevMonthSales       = parseFloat(statsView.periodo_anterior_vendas) || 0;
    const prevMonthTransactions= parseInt(statsView.periodo_anterior_aprovadas) || 0;
    const todaySales           = parseFloat(statsView.hoje_vendas)           || 0;
    const todayTransactions    = parseInt(statsView.hoje_aprovadas)          || 0;

    console.log('💰 [CREATOR-STATS] Via view banco — Período:', statsView.periodo_inicio);
    console.log('💰 [CREATOR-STATS] Este período: R$', monthSales.toFixed(2));
    console.log('💰 [CREATOR-STATS] Total geral: R$', totalSales.toFixed(2));
    
    return {
      totalTransactions: approvedCount || 0, // Apenas aprovadas
      approvedTransactions: approvedCount || 0,
      rejectedTransactions: 0, // Criadores não veem rejeitadas
      pendingTransactions: pendingCount || 0,
      totalSales: totalSales.toFixed(2),
      todaySales: todaySales.toFixed(2),
      todayTransactions: todayTransactions || 0,
      monthSales: monthSales.toFixed(2),
      monthTransactions: monthTransactions || 0,
      prevMonthSales: prevMonthSales.toFixed(2),
      prevMonthTransactions: prevMonthTransactions || 0
    };
  } catch (err) {
    console.error('Erro ao buscar estatísticas do criador:', err);
    return {
      totalTransactions: 0,
      approvedTransactions: 0,
      rejectedTransactions: 0,
      pendingTransactions: 0,
      totalSales: '0.00',
      todaySales: '0.00',
      todayTransactions: 0
    };
  }
}

// ===== USUÁRIOS =====

async function getRecentUsers(limit = 20, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return {
      data: data || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0)
    };
  } catch (err) {
    console.error('Erro ao buscar usuários recentes:', err.message);
    return {
      data: [],
      total: 0,
      limit,
      offset,
      hasMore: false
    };
  }
}

// Buscar apenas usuários que já compraram e estão desbloqueados (para broadcast)
async function getActiveBuyers() {
  try {
    console.log('🔍 [DB] Buscando usuários ativos que já compraram...');
    
    // Passo 1: Buscar todas as transações entregues para pegar os user_ids
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('status', 'delivered');
    
    if (txError) {
      console.error('❌ [DB] Erro ao buscar transações:', txError);
      throw txError;
    }
    
    // Passo 2: Pegar IDs únicos de usuários que compraram
    const buyerIds = [...new Set(transactions?.map(t => t.user_id).filter(id => id) || [])];
    
    if (buyerIds.length === 0) {
      console.log('ℹ️ [DB] Nenhum comprador encontrado');
      return [];
    }
    
    console.log(`📊 [DB] ${buyerIds.length} usuários únicos que compraram encontrados`);
    
    // Passo 3: Buscar usuários que compraram e estão desbloqueados
    // Dividir em chunks se houver muitos IDs (limite do Supabase é ~1000 por query)
    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < buyerIds.length; i += chunkSize) {
      chunks.push(buyerIds.slice(i, i + chunkSize));
    }
    
    let allUsers = [];
    for (const chunk of chunks) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('telegram_id, first_name, username, is_blocked')
        .eq('is_blocked', false)
        .in('id', chunk);
      
      if (usersError) {
        console.error('❌ [DB] Erro ao buscar usuários:', usersError);
        throw usersError;
      }
      
      if (users) {
        allUsers = allUsers.concat(users);
      }
    }
    
    console.log(`✅ [DB] ${allUsers.length} compradores ativos encontrados (desbloqueados)`);
    return allUsers;
  } catch (err) {
    console.error('❌ [DB] Erro ao buscar compradores ativos:', err.message);
    // Em caso de erro, retornar array vazio para não quebrar o broadcast
    return [];
  }
}

// Buscar todos os usuários desbloqueados (para broadcast)
async function getAllUnblockedUsers() {
  try {
    console.log('🔍 [DB] Buscando todos os usuários desbloqueados...');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('telegram_id, first_name, username, is_blocked')
      .eq('is_blocked', false);
    
    if (error) {
      console.error('❌ [DB] Erro ao buscar usuários desbloqueados:', error);
      throw error;
    }
    
    console.log(`✅ [DB] ${users?.length || 0} usuários desbloqueados encontrados`);
    return users || [];
  } catch (err) {
    console.error('❌ [DB] Erro ao buscar usuários desbloqueados:', err.message);
    return [];
  }
}

async function getAllAdmins() {
  try {
    console.log('🔍 [DB] Buscando admins na tabela users...');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_admin', true);
    
    if (error) {
      console.error('❌ [DB] Erro ao buscar admins:', error);
      throw error;
    }
    
    console.log(`✅ [DB] Admins encontrados: ${data?.length || 0}`);
    
    if (data && data.length > 0) {
      data.forEach(admin => {
        console.log(`👤 [DB] Admin: ${admin.telegram_id} - ${admin.first_name || admin.username || 'N/A'} (is_admin: ${admin.is_admin})`);
      });
    } else {
      console.warn('⚠️ [DB] NENHUM ADMIN ENCONTRADO! Verifique a tabela users.');
      console.warn('⚠️ [DB] Execute: UPDATE users SET is_admin = true WHERE telegram_id = SEU_ID;');
    }
    
    return data || [];
  } catch (err) {
    console.error('❌ [DB] Erro crítico ao buscar admins:', err.message);
    console.error('Stack:', err.stack);
    return [];
  }
}

// ===== CONFIGURAÇÕES (SETTINGS) =====


module.exports = {
  getStats,
  getCreatorStats,
  getRecentUsers,
  getActiveBuyers,
  getAllUnblockedUsers,
  getAllAdmins,
  getTodayStartBrasil,
  getMonthStartBrasil,
  getPreviousMonthStartBrasil
};
