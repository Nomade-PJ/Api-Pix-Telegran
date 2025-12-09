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
    
    // Buscar APENAS transações pendentes (SEM comprovante)
    // NÃO expirar transações com comprovante enviado (proof_sent) - essas aguardam aprovação do admin
    // Adicionar retry em caso de erro de conexão
    let transactions, error;
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const result = await db.supabase
          .from('transactions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        
        // Verificar se houve erro na resposta
        if (result.error) {
          // Verificar se é erro de conexão
          const errorMessage = result.error.message || '';
          const errorDetails = result.error.details || '';
          const errorString = JSON.stringify(result.error);
          
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
            errorString.includes('UND_ERR_SOCKET')
          );
          
          if (isConnectionError) {
            // É erro de conexão - tratar como exceção para entrar no catch
            throw result.error;
          } else {
            // Erro real do Supabase (erro na query, não conexão)
            error = result.error;
            break;
          }
        }
        
        // Verificar se result.data existe (sucesso)
        if (result.data !== undefined) {
          transactions = result.data;
          error = null;
          break; // Sucesso, sair do loop
        }
        
        // Se chegou aqui, algo inesperado aconteceu
        throw new Error('Resposta inválida do Supabase');
        
      } catch (fetchError) {
        // Erro de conexão/network (SocketError, fetch failed, etc)
        lastError = fetchError;
        retries--;
        
        // Verificar se é erro de conexão (verificar message, details e code)
        const errorMessage = fetchError.message || '';
        const errorDetails = fetchError.details || '';
        const errorCode = fetchError.code || '';
        const errorString = JSON.stringify(fetchError);
        
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
          errorString.includes('UND_ERR_SOCKET') ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'ETIMEDOUT'
        );
        
        if (!isConnectionError) {
          // Não é erro de conexão, não tentar retry
          console.error('❌ [EXPIRE-JOB] Erro ao buscar transações (não é erro de conexão):', errorMessage);
          error = fetchError; // Marcar como erro real
          break; // Sair do loop
        }
        
        if (retries > 0) {
          console.warn(`⚠️ [EXPIRE-JOB] Erro de conexão detectado: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [EXPIRE-JOB] Tentando novamente... (${retries} tentativas restantes)`);
          // Aguardar 2 segundos antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Última tentativa falhou - marcar como erro de conexão temporário
          console.warn(`⚠️ [EXPIRE-JOB] Erro de conexão após 3 tentativas - será tentado novamente no próximo ciclo`);
          // Não logar como erro crítico - apenas retornar silenciosamente
          return { expired: 0 }; // Retornar sem erro para não logar como crítico
        }
      }
    }
    
    // Se ainda tiver erro após retries, verificar se é erro de conexão
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
        errorString.includes('UND_ERR_SOCKET')
      );
      
      if (isConnectionError) {
        // Erro de conexão temporário - não logar como erro crítico
        console.warn('⚠️ [EXPIRE-JOB] Erro de conexão temporário com Supabase - será tentado novamente no próximo ciclo');
        return { expired: 0, error: 'Erro de conexão temporário' };
      } else {
        // Erro real do Supabase
        console.error('❌ [EXPIRE-JOB] Erro do Supabase:', error);
        return { expired: 0, error: error.message || JSON.stringify(error) };
      }
    }
    
    // Se lastError existe mas não foi capturado como error, verificar
    if (lastError && !transactions) {
      const errorMessage = lastError.message || '';
      const errorDetails = lastError.details || '';
      const errorString = JSON.stringify(lastError);
      
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
        errorString.includes('UND_ERR_SOCKET')
      );
      
      if (isConnectionError) {
        console.warn('⚠️ [EXPIRE-JOB] Erro de conexão temporário com Supabase - será tentado novamente no próximo ciclo');
        return { expired: 0, error: 'Erro de conexão temporário' };
      }
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
    // Verificar se é erro de conexão
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
      errorString.includes('UND_ERR_SOCKET')
    );
    
    if (isConnectionError) {
      // Erro de conexão temporário - não logar como crítico
      console.warn('⚠️ [EXPIRE-JOB] Erro de conexão temporário - será tentado novamente no próximo ciclo');
      return { expired: 0 };
    } else {
      // Erro crítico real
      console.error('❌ [EXPIRE-JOB] Erro crítico:', err);
      return { expired: 0, error: err.message };
    }
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

