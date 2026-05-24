// src/db/analytics.js
const { supabase } = require('./client');

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

module.exports = {
  recalculateTotalSales,
  getBotStatistics,
  getConversionMetrics,
  getProductPerformance,
  getProcessingTimes,
  getTopCustomers,
  getConversionSummary
};
