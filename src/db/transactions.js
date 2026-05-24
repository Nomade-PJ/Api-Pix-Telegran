// src/db/transactions.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');


async function createTransaction({ txid, userId, telegramId, productId, mediaPackId, groupId, amount, pixKey, pixPayload }) {
  try {
    const insertData = {
      txid,
      user_id: userId,
      telegram_id: telegramId,
      amount,
      pix_key: pixKey,
      pix_payload: pixPayload,
      status: 'pending'
    };
    
    // Adicionar product_id OU media_pack_id OU group_id (nunca múltiplos ao mesmo tempo)
    if (groupId) {
      insertData.group_id = groupId;
    } else if (mediaPackId) {
      insertData.media_pack_id = mediaPackId;
    } else if (productId) {
      insertData.product_id = productId;
    }
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([insertData])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Transação criada:', data.id);
    return data;
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    throw err;
  }
}

async function getTransactionByTxid(txid) {
  // Adicionar retry logic para erros de conexão
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('txid', txid)
        .single();
      
      if (error) {
        // Se for erro "not found" (PGRST116), não é erro de conexão - retornar null
        if (error.code === 'PGRST116') {
          return null;
        }
        
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
            console.warn(`⚠️ [DB] Erro de conexão ao buscar transação ${txid}: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue;
          } else {
            console.warn(`⚠️ [DB] Erro de conexão ao buscar transação ${txid} após 3 tentativas - retornando null`);
            return null;
          }
        } else {
          throw error;
        }
      }
      
      // Se chegou aqui, a query foi bem-sucedida
      if (!data) {
        return null;
      }
    
    // Buscar informações do usuário separadamente se necessário
    if (data.user_id) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('telegram_id, username, first_name')
          .eq('id', data.user_id)
          .single();
        
        // PGRST116 = usuário não encontrado - isso é esperado
        if (!userError && userData) {
          data.user = userData;
        }
      } catch (err) {
        // Ignorar erro se usuário não foi encontrado
        if (err.code !== 'PGRST116') {
          console.error('Erro ao buscar usuário na transação:', err);
        }
      }
    }
    
    // Buscar informações do produto OU media pack separadamente
    if (data.product_id) {
      try {
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('name, price')
          .eq('product_id', data.product_id)
          // Não filtrar por is_active aqui, pois pode ser transação antiga com produto desativado
          .single();
        
        // PGRST116 = produto não encontrado - isso é esperado (produto pode ter sido removido)
        if (productError) {
          if (productError.code !== 'PGRST116') {
            console.error(`❌ [GET_TRANSACTION] Erro ao buscar produto "${data.product_id}":`, productError);
          }
          // Não fazer nada se produto não foi encontrado (é esperado)
        } else if (productData) {
          data.product = productData;
        }
      } catch (err) {
        // Ignorar erro PGRST116 se produto não foi encontrado
        if (err.code !== 'PGRST116') {
          console.error('❌ [GET_TRANSACTION] Erro ao buscar produto na transação:', err);
        }
      }
    } else if (data.media_pack_id) {
      try {
        const { data: packData, error: packError } = await supabase
          .from('media_packs')
          .select('name, price')
          .eq('pack_id', data.media_pack_id)
          .single();
        
        // PGRST116 = pack não encontrado - isso é esperado (pack pode ter sido removido)
        if (packError) {
          if (packError.code !== 'PGRST116') {
            console.error(`❌ [GET_TRANSACTION] Erro ao buscar media pack "${data.media_pack_id}":`, packError);
          }
          // Não fazer nada se pack não foi encontrado (é esperado)
        } else if (packData) {
          data.media_pack = packData;
        }
      } catch (err) {
        // Ignorar erro PGRST116 se pack não foi encontrado
        if (err.code !== 'PGRST116') {
          console.error('❌ [GET_TRANSACTION] Erro ao buscar media pack na transação:', err);
        }
      }
    }
    
      return data;
      
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
          console.warn(`⚠️ [DB] Erro de conexão ao buscar transação ${txid}: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue;
        } else {
          console.warn(`⚠️ [DB] Erro de conexão ao buscar transação ${txid} após 3 tentativas - retornando null`);
          return null;
        }
      } else {
        // Se for erro "not found", retornar null (não é erro crítico)
        if (err.code === 'PGRST116') {
          return null;
        }
        console.error('❌ [DB] Erro ao buscar transação:', err);
        return null;
      }
    }
  }
  
  return null;
}

async function getLastPendingTransaction(telegramId) {
  try {
    const { data, error} = await supabase
      .from('transactions')
      .select('*')
      .eq('telegram_id', telegramId)
      .in('status', ['pending', 'proof_sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar transação pendente:', err);
    return null;
  }
}

async function getUserTransactions(telegramId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    const transactions = data || [];
    
    // Buscar informações adicionais para cada transação
    for (const transaction of transactions) {
      // Buscar produto
      if (transaction.product_id) {
        try {
          const { data: productData } = await supabase
            .from('products')
            .select('name')
            .eq('product_id', transaction.product_id)
            .single();
          
          if (productData) {
            transaction.product_name = productData.name;
          }
        } catch (err) {
          // Ignorar erro se produto não encontrado
        }
      }
      
      // Buscar media pack
      if (transaction.media_pack_id) {
        try {
          const { data: packData } = await supabase
            .from('media_packs')
            .select('name')
            .eq('pack_id', transaction.media_pack_id)
            .single();
          
          if (packData) {
            transaction.product_name = packData.name;
          }
        } catch (err) {
          // Ignorar erro se pack não encontrado
        }
      }
      
      // Buscar grupo
      if (transaction.group_id) {
        try {
          const { data: groupData } = await supabase
            .from('groups')
            .select('group_name')
            .eq('id', transaction.group_id)
            .single();
          
          if (groupData) {
            transaction.product_name = groupData.group_name || 'Grupo';
          }
        } catch (err) {
          // Ignorar erro se grupo não encontrado
        }
      }
    }
    
    return transactions;
  } catch (err) {
    console.error('Erro ao buscar transações do usuário:', err);
    return [];
  }
}

module.exports = {
  createTransaction,
  getTransactionByTxid,
  getLastPendingTransaction,
  getUserTransactions,
  getTransactionsByUserAndAmount,
  generateProofHash,
  checkDuplicateProof,
  updateTransactionProof,
  validateTransaction,
  markAsDelivered,
  markDeliveryFailed,
  getFailedDeliveries,
  getAllDeliveryFailures,
  cancelTransaction,
  reverseTransaction
};
