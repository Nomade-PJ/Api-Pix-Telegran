// src/jobs/expireTransactions.js
// Job automático para expirar transações pendentes após 30 minutos

const db = require('../database');

/**
 * Expira transações pendentes que ultrapassaram 30 minutos
 * Roda automaticamente a cada 5 minutos
 */
async function expireOldTransactions() {
  try {
    console.log('🕐 [EXPIRE-JOB] Iniciando verificação de transações expiradas...');
    
    // Buscar todas as transações pendentes ou com comprovante enviado
    const { data: transactions, error } = await db.supabase
      .from('transactions')
      .select('*')
      .in('status', ['pending', 'proof_sent'])
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ [EXPIRE-JOB] Erro ao buscar transações:', error);
      return { expired: 0, error: error.message };
    }
    
    if (!transactions || transactions.length === 0) {
      console.log('✅ [EXPIRE-JOB] Nenhuma transação pendente encontrada');
      return { expired: 0 };
    }
    
    console.log(`📊 [EXPIRE-JOB] ${transactions.length} transações pendentes encontradas`);
    
    const now = new Date();
    let expiredCount = 0;
    
    for (const transaction of transactions) {
      const createdAt = new Date(transaction.created_at);
      const diffMinutes = (now - createdAt) / (1000 * 60);
      
      // Se passou de 30 minutos, expirar
      if (diffMinutes > 30) {
        console.log(`⏰ [EXPIRE-JOB] Expirando transação ${transaction.txid} (${Math.floor(diffMinutes)} minutos)`);
        
        const canceled = await db.cancelTransaction(transaction.txid);
        
        if (canceled) {
          expiredCount++;
          console.log(`✅ [EXPIRE-JOB] Transação ${transaction.txid} expirada com sucesso`);
        } else {
          console.error(`❌ [EXPIRE-JOB] Erro ao expirar transação ${transaction.txid}`);
        }
      } else {
        const minutesLeft = Math.floor(30 - diffMinutes);
        console.log(`⏳ [EXPIRE-JOB] Transação ${transaction.txid} ainda válida (${minutesLeft} minutos restantes)`);
      }
    }
    
    if (expiredCount > 0) {
      console.log(`✅ [EXPIRE-JOB] ${expiredCount} transação(ões) expirada(s)`);
    } else {
      console.log('✅ [EXPIRE-JOB] Nenhuma transação expirada neste ciclo');
    }
    
    return { expired: expiredCount, total: transactions.length };
    
  } catch (err) {
    console.error('❌ [EXPIRE-JOB] Erro crítico:', err);
    return { expired: 0, error: err.message };
  }
}

/**
 * Inicia o job de expiração automática
 * Executa a cada 5 minutos
 */
function startExpirationJob() {
  console.log('🚀 [EXPIRE-JOB] Job de expiração iniciado - executará a cada 5 minutos');
  
  // Executar imediatamente na inicialização
  expireOldTransactions();
  
  // Executar a cada 5 minutos (300.000ms)
  const interval = setInterval(() => {
    expireOldTransactions();
  }, 5 * 60 * 1000); // 5 minutos
  
  // Retornar interval para poder cancelar se necessário
  return interval;
}

module.exports = {
  expireOldTransactions,
  startExpirationJob
};

