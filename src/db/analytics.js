// src/db/analytics.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');

const { getTodayStartBrasil, getMonthStartBrasil, getPreviousMonthStartBrasil } = require('./stats');

async function recalculateTotalSales() {
  try {
    console.log('🔄 [RECALC] Iniciando recálculo de vendas totais...');
    
    // 🔧 CORRIGIR INCONSISTÊNCIAS ANTES DE CALCULAR
    
    // 1. Corrigir transações validadas que têm delivered_at mas status não é 'delivered'
    const { data: validatedWithDelivered, error: fix1Error } = await supabase
      .from('transactions')
      .update({ status: 'delivered' })
      .eq('status', 'validated')
      .not('delivered_at', 'is', null)
      .select('txid, amount');
    
    if (fix1Error) {
      console.warn('⚠️ [RECALC] Erro ao corrigir transações validated com delivered_at:', fix1Error);
    } else if (validatedWithDelivered && validatedWithDelivered.length > 0) {
      console.log(`✅ [RECALC] Corrigidas ${validatedWithDelivered.length} transações validated com delivered_at`);
    }
    
    // 2. Corrigir transações validadas que não têm delivered_at (marcar como entregue)
    // Primeiro buscar essas transações
    const { data: toFix, error: fetchError } = await supabase
      .from('transactions')
      .select('txid, amount, validated_at')
      .eq('status', 'validated')
      .is('delivered_at', null)
      .not('validated_at', 'is', null);
    
    let validatedWithoutDelivered = [];
    if (!fetchError && toFix && toFix.length > 0) {
      // Atualizar cada uma usando validated_at como delivered_at
      for (const tx of toFix) {
        const { data: updated, error: updateError } = await supabase
          .from('transactions')
          .update({ 
            status: 'delivered',
            delivered_at: tx.validated_at
          })
          .eq('txid', tx.txid)
          .select('txid, amount');
        
        if (!updateError && updated && updated.length > 0) {
          validatedWithoutDelivered.push(...updated);
        }
      }
      
      if (validatedWithoutDelivered.length > 0) {
        const fixedAmount = validatedWithoutDelivered.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        console.log(`✅ [RECALC] Corrigidas ${validatedWithoutDelivered.length} transações validated sem delivered_at (R$ ${fixedAmount.toFixed(2)})`);
      }
    }
    
    // Buscar todas as transações entregues (após correções)
    const { data: sales, error } = await supabase
      .from('transactions')
      .select('amount, delivered_at, txid')
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: true });
    
    if (error) {
      console.error('❌ [RECALC] Erro ao buscar transações:', error);
      throw error;
    }
    
    if (!sales || sales.length === 0) {
      console.log('✅ [RECALC] Nenhuma transação entregue encontrada');
      return {
        totalSales: 0,
        totalTransactions: 0,
        message: 'Nenhuma transação entregue encontrada',
        fixed: 0
      };
    }
    
    // ── Buscar totais via view (regra desde 17/04) ────────────────────────
    const { data: sv, error: svErr } = await supabase
      .from('stats_periodo')
      .select('*')
      .single();

    if (svErr) throw svErr;

    const totalSales        = parseFloat(sv.total_vendas)    || 0;
    const totalTransactions = parseInt(sv.total_aprovadas)   || 0;
    const todaySales        = parseFloat(sv.hoje_vendas)     || 0;
    const todayTransactions = parseInt(sv.hoje_aprovadas)    || 0;
    const fixedCount = (validatedWithDelivered?.length || 0) + (validatedWithoutDelivered?.length || 0);

    console.log(`✅ [RECALC] Recalculado com sucesso (desde 17/04):`);
    console.log(`   📊 Total de vendas: R$ ${totalSales.toFixed(2)}`);
    console.log(`   📦 Total de transações: ${totalTransactions}`);
    console.log(`   📅 Vendas de hoje: R$ ${todaySales.toFixed(2)} (${todayTransactions} transações)`);
    if (fixedCount > 0) {
      console.log(`   🔧 Transações corrigidas: ${fixedCount}`);
    }

    return {
      totalSales: totalSales.toFixed(2),
      totalTransactions,
      todaySales: todaySales.toFixed(2),
      todayTransactions,
      fixed: fixedCount,
      message: `Recalculado desde 17/04: R$ ${totalSales.toFixed(2)} em ${totalTransactions} transações${fixedCount > 0 ? ` (${fixedCount} corrigidas)` : ''}`
    };
  } catch (err) {
    console.error('❌ [RECALC] Erro ao recalcular vendas:', err);
    throw err;
  }
}

// ===== MONITORAMENTO E ESTATÍSTICAS =====

/**
 * Obter estatísticas gerais do bot em tempo real
 * @returns {Promise<Object>} Estatísticas completas
 */
async function getBotStatistics() {
  try {
    const { data, error } = await supabase
      .from('v_bot_statistics')
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('❌ [STATS] Erro ao buscar estatísticas:', err);
    return null;
  }
}

/**
 * Obter métricas de conversão (últimos 30 dias)
 * @param {number} days - Número de dias para buscar (padrão: 30)
 * @returns {Promise<Array>} Array com métricas diárias
 */
async function getConversionMetrics(days = 30) {
  try {
    const { data, error } = await supabase
      .from('v_conversion_metrics')
      .select('*')
      .limit(days);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('❌ [CONVERSION] Erro ao buscar métricas de conversão:', err);
    return [];
  }
}

/**
 * Obter performance por produto (últimos 30 dias)
 * @returns {Promise<Array>} Array com performance de cada produto
 */
async function getProductPerformance() {
  try {
    const { data, error } = await supabase
      .from('v_product_performance')
      .select('*');
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('❌ [PERFORMANCE] Erro ao buscar performance de produtos:', err);
    return [];
  }
}

/**
 * Obter tempos médios de processamento (últimos 30 dias)
 * @returns {Promise<Array>} Array com tempos médios por dia
 */
async function getProcessingTimes() {
  try {
    const { data, error } = await supabase
      .from('v_processing_times')
      .select('*')
      .limit(30);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('❌ [PROCESSING] Erro ao buscar tempos de processamento:', err);
    return [];
  }
}

/**
 * Obter top clientes (maiores compradores)
 * @param {number} limit - Número de clientes (padrão: 50)
 * @returns {Promise<Array>} Array com top clientes
 */
async function getTopCustomers(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('v_top_customers')
      .select('*')
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('❌ [CUSTOMERS] Erro ao buscar top clientes:', err);
    return [];
  }
}

/**
 * Obter resumo de conversão para exibir no admin
 * @returns {Promise<Object>} Resumo formatado
 */
async function getConversionSummary() {
  try {
    const metrics = await getConversionMetrics(7);
    
    if (metrics.length === 0) {
      return {
        avgConversionRate: 0,
        avgProofRate: 0,
        avgValidationRate: 0,
        totalRevenue: 0,
        days: 0
      };
    }
    
    const avgConversionRate = metrics.reduce((sum, m) => sum + parseFloat(m.conversion_rate || 0), 0) / metrics.length;
    const avgProofRate = metrics.reduce((sum, m) => sum + parseFloat(m.proof_rate || 0), 0) / metrics.length;
    const avgValidationRate = metrics.reduce((sum, m) => sum + parseFloat(m.validation_rate || 0), 0) / metrics.length;
    const totalRevenue = metrics.reduce((sum, m) => sum + parseFloat(m.daily_revenue || 0), 0);
    
    return {
      avgConversionRate: avgConversionRate.toFixed(2),
      avgProofRate: avgProofRate.toFixed(2),
      avgValidationRate: avgValidationRate.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      days: metrics.length
    };
  } catch (err) {
    console.error('❌ [SUMMARY] Erro ao gerar resumo:', err);
    return {
      avgConversionRate: 0,
      avgProofRate: 0,
      avgValidationRate: 0,
      totalRevenue: 0,
      days: 0
    };
  }
}

module.exports = {
  supabase,
  getOrCreateUser,
  getUserByUUID,
  getUserByTelegramId,
  isUserAdmin,
  isUserCreator,
  setUserAsCreator,
  getRecentUsers,
  getActiveBuyers,
  getAllUnblockedUsers,
  getAllAdmins,
  getProduct,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  productHasTransactions,
  createTransaction,
  getTransactionByTxid,
  getLastPendingTransaction,
  getUserTransactions,
  getTransactionsByUserAndAmount,
  updateTransactionProof,
  validateTransaction,
  markAsDelivered,
  markDeliveryFailed,
  getFailedDeliveries,
  getAllDeliveryFailures,
  cancelTransaction,
  reverseTransaction,
  getPendingTransactions,
  getStats,
  getCreatorStats,
  recalculateTotalSales,
  getSetting,
  setSetting,
  getPixKey,
  setPixKey,
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
  getGroupMember,
  getOCRResult,
  saveOCRResult,
  getMonthlyUsers,
  updateProofFileUrl,
  // Media Packs
  getAllMediaPacks,
  getMediaPackById,
  createMediaPack,
  addMediaItem,
  getMediaItems,
  getRandomMediaItems,
  recordMediaDelivery,
  deleteMediaPack,
  deleteMediaItem,
  // Bloqueio por DDD
  getBlockedAreaCodes,
  isAreaCodeBlocked,
  addBlockedAreaCode,
  removeBlockedAreaCode,
  updateUserPhone,
  extractAreaCode,
  getUserReport,
  // Gerenciamento de bloqueios individuais
  unblockUserByTelegramId,
  blockUserByTelegramId,
  checkBlockStatus,
  // Sistema de tickets de suporte
  createSupportTicket,
  getSupportTicket,
  getUserTickets,
  getAllOpenTickets,
  addTicketMessage,
  getTicketMessages,
  updateTicketStatus,
  assignTicket,
  // Validação de duplicatas
  generateProofHash,
  checkDuplicateProof,
  // Sistema de confiança e aprendizado
  getTrustedUser,
  updateTrustedUser,
  addTrustedUser,
  getProofPatterns,
  updateProofPattern,
  // Respostas automáticas
  getAutoResponse,
  getAllAutoResponses,
  createAutoResponse,
  updateAutoResponseUsage,
  // Monitoramento e estatísticas avançadas
  getBotStatistics,
  getConversionMetrics,
  getProductPerformance,
  getProcessingTimes,
  getTopCustomers,
  getConversionSummary
};

module.exports = {
  recalculateTotalSales,
  getBotStatistics,
  getConversionMetrics,
  getProductPerformance,
  getProcessingTimes,
  getTopCustomers,
  getConversionSummary
};
