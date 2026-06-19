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

/**
 * Busca transações por ID do Telegram e valor
 * Útil para encontrar transações específicas para reversão
 */
async function getTransactionsByUserAndAmount(telegramId, amount) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('amount', amount)
      .in('status', ['validated', 'delivered'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar transações por usuário e valor:', err);
    return [];
  }
}

/**
 * Gera hash do comprovante para verificação de duplicatas
 */
function generateProofHash(fileId, amount, pixKey) {
  const hashString = `${fileId}_${amount}_${pixKey}`;
  return crypto.createHash('sha256').update(hashString).digest('hex');
}

/**
 * Verifica se o comprovante já foi usado anteriormente
 */
async function checkDuplicateProof(proofHash) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('txid, telegram_id, created_at, status')
      .eq('proof_hash', proofHash)
      .in('status', ['delivered', 'validated', 'proof_sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao verificar comprovante duplicado:', err);
    return null;
  }
}

async function updateTransactionProof(txid, fileId, amount = null, pixKey = null) {
  try {
    // Gerar hash do comprovante se tiver amount e pixKey
    let proofHash = null;
    if (amount && pixKey) {
      proofHash = generateProofHash(fileId, amount, pixKey);
      
      // Verificar duplicata
      const duplicate = await checkDuplicateProof(proofHash);
      if (duplicate && duplicate.txid !== txid) {
        console.warn(`⚠️ [DUPLICATE] Comprovante duplicado detectado! TXID anterior: ${duplicate.txid}`);
        return {
          success: false,
          isDuplicate: true,
          duplicateTxid: duplicate.txid,
          duplicateDate: duplicate.created_at
        };
      }
    }
    
    const updateData = {
      proof_file_id: fileId,
      proof_received_at: new Date().toISOString(),
      status: 'proof_sent',
      updated_at: new Date().toISOString()
    };
    
    if (proofHash) {
      updateData.proof_hash = proofHash;
    }
    
    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('txid', txid);
    
    if (error) throw error;
    console.log('Comprovante registrado:', txid);
    return { success: true, isDuplicate: false };
  } catch (err) {
    console.error('Erro ao atualizar comprovante:', err);
    return { success: false, isDuplicate: false, error: err.message };
  }
}

async function validateTransaction(txid, validatedBy) {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'validated',
        validated_at: new Date().toISOString(),
        validated_by: validatedBy,
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) throw error;
    console.log('Transação validada:', txid);
    
    // 🚀 CACHE: Invalidar cache de estatísticas quando transação é validada
    cache.delete('stats_admin');
    cache.delete('stats_creator');
    
    return true;
  } catch (err) {
    console.error('Erro ao validar transação:', err);
    return false;
  }
}

async function markAsDelivered(txid) {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        delivery_error: null,
        delivery_error_type: null
      })
      .eq('txid', txid);

    if (error) throw error;
    console.log('Transação marcada como entregue:', txid);

    cache.delete('stats_admin');
    cache.delete('stats_creator');

    return true;
  } catch (err) {
    console.error('Erro ao marcar como entregue:', err);
    return false;
  }
}

/**
 * Registra falha de entrega e incrementa contador de tentativas.
 * errorType: 'blocked' | 'temporary' | 'unknown'
 */
async function markDeliveryFailed(txid, errorMessage, errorType = 'unknown') {
  try {
    const { data: tx } = await supabase
      .from('transactions')
      .select('delivery_attempts')
      .eq('txid', txid)
      .single();

    const attempts = (tx?.delivery_attempts || 0) + 1;

    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'delivery_failed',
        delivery_error: errorMessage,
        delivery_error_type: errorType,
        delivery_attempts: attempts,
        last_delivery_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);

    if (error) throw error;

    console.log(`⚠️ [DB] Falha de entrega registrada: ${txid} | tipo: ${errorType} | tentativas: ${attempts}`);
    cache.delete('stats_admin');
    return true;
  } catch (err) {
    console.error('Erro ao registrar falha de entrega:', err);
    return false;
  }
}

/**
 * Busca transações com falha temporária candidatas a reenvio automático
 */
async function getFailedDeliveries() {
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, user:user_id (first_name, username, telegram_id)')
        .eq('status', 'delivery_failed')
        .neq('delivery_error_type', 'blocked')
        .lt('delivery_attempts', 5)
        .order('last_delivery_attempt_at', { ascending: true });

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
            console.warn(`⚠️ [DB] Erro de conexão ao buscar entregas com falha: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue;
          }
        }
        throw error;
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
          console.warn(`⚠️ [DB] Erro de conexão ao buscar entregas com falha: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue;
        }
      }
      
      console.error('Erro ao buscar entregas com falha:', err);
      return [];
    }
  }
  return [];
}

/**
 * Busca TODAS as falhas de entrega para exibir no painel admin
 */
async function getAllDeliveryFailures(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        txid, telegram_id, amount, delivery_error, delivery_error_type,
        delivery_attempts, last_delivery_attempt_at, product_id, media_pack_id, group_id,
        user:user_id (first_name, username)
      `)
      .eq('status', 'delivery_failed')
      .order('last_delivery_attempt_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar falhas de entrega:', err);
    return [];
  }
}

async function cancelTransaction(txid) {
  // Adicionar retry logic para erros de conexão
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'expired',
          notes: 'Transação expirada - prazo de 60 minutos ultrapassado',
          updated_at: new Date().toISOString()
        })
        .eq('txid', txid);
      
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
          // É erro de conexão - tentar retry
          lastError = error;
          retries--;
          
          if (retries > 0) {
            console.warn(`⚠️ [DB] Erro de conexão ao cancelar transação ${txid}: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
            console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
            // Aguardar 2 segundos antes de tentar novamente (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            continue; // Tentar novamente
          } else {
            // Última tentativa falhou
            console.warn(`⚠️ [DB] Erro de conexão ao cancelar transação ${txid} após 3 tentativas - será tentado novamente no próximo ciclo`);
            return false; // Retornar false mas não logar como erro crítico
          }
        } else {
          // Erro real do Supabase (não é conexão)
          throw error;
        }
      }
      
      // Sucesso
      console.log('✅ [DB] Transação cancelada por expiração:', txid);
      return true;
      
    } catch (err) {
      // Verificar se é erro de conexão no catch também
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
          console.warn(`⚠️ [DB] Erro de conexão ao cancelar transação ${txid}: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
          console.warn(`⚠️ [DB] Tentando novamente... (${retries} tentativas restantes)`);
          // Aguardar 2 segundos antes de tentar novamente (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
          continue; // Tentar novamente
        } else {
          // Última tentativa falhou
          console.warn(`⚠️ [DB] Erro de conexão ao cancelar transação ${txid} após 3 tentativas - será tentado novamente no próximo ciclo`);
          return false; // Retornar false mas não logar como erro crítico
        }
      } else {
        // Erro real (não é conexão) - logar e retornar
        console.error('❌ [DB] Erro ao cancelar transação:', err);
        return false;
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam por erro de conexão
  return false;
}

/**
 * Reverte uma transação entregue (cancela e remove acesso)
 * Remove usuário de grupos se necessário
 * Deleta entregas de mídia se houver
 */
async function reverseTransaction(txid, reason = 'Transação revertida manualmente pelo admin') {
  try {
    // Buscar transação
    const transaction = await getTransactionByTxid(txid);
    if (!transaction) {
      throw new Error('Transação não encontrada');
    }
    
    // Permitir reverter transações validadas ou entregues
    if (!['validated', 'delivered'].includes(transaction.status)) {
      throw new Error(`Transação não pode ser revertida. Status atual: ${transaction.status}`);
    }
    
    // 1. Deletar entregas de mídia se houver
    if (transaction.media_pack_id && transaction.id) {
      try {
        const { error: deleteMediaError } = await supabase
          .from('media_deliveries')
          .delete()
          .eq('transaction_id', transaction.id);
        
        if (deleteMediaError) {
          console.error('⚠️ [REVERSE] Erro ao deletar entregas de mídia:', deleteMediaError.message);
        } else {
          console.log(`✅ [REVERSE] Entregas de mídia deletadas para transação ${txid}`);
        }
      } catch (mediaErr) {
        console.error('⚠️ [REVERSE] Erro ao deletar entregas de mídia:', mediaErr.message);
        // Continuar mesmo se falhar
      }
    }
    
    // 2. Se tiver grupo, remover membro do grupo
    if (transaction.group_id) {
      try {
        // Buscar membro ativo do grupo
        const member = await getGroupMember(transaction.telegram_id, transaction.group_id);
        if (member) {
          // Expirar membro (marca como expired)
          await expireMember(member.id);
          console.log(`✅ [REVERSE] Membro removido do grupo: ${transaction.telegram_id}`);
        }
      } catch (groupErr) {
        console.error('⚠️ [REVERSE] Erro ao remover do grupo:', groupErr.message);
        // Continuar mesmo se falhar remoção do grupo
      }
    }
    
    // 3. Atualizar status da transação para cancelled
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'cancelled',
        notes: reason,
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (updateError) throw updateError;
    
    // 4. Invalidar cache de estatísticas
    cache.delete('stats_admin');
    cache.delete('stats_creator');
    
    console.log(`✅ [REVERSE] Transação ${txid} revertida com sucesso`);
    return {
      success: true,
      transaction: {
        ...transaction,
        status: 'cancelled'
      }
    };
  } catch (err) {
    console.error('❌ [REVERSE] Erro ao reverter transação:', err);
    return {
      success: false,
      error: err.message
    };
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
