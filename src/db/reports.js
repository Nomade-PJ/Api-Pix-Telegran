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

module.exports = {
  getMonthlyUsers,
  getUserReport,
  unblockUserByTelegramId,
  blockUserByTelegramId,
  checkBlockStatus
};
