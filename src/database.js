// src/database.js
const { createClient } = require('@supabase/supabase-js');
const cache = require('./cache');
const crypto = require('crypto');

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ===== USUÁRIOS =====

async function getUserByUUID(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return user || null;
  } catch (err) {
    console.error('Erro ao buscar usuário por UUID:', err);
    return null;
  }
}

async function getUserByTelegramId(telegramId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return null; // Não encontrado
    }
    
    if (error) throw error;
    return user;
  } catch (err) {
    console.error('Erro ao buscar usuário:', err.message);
    return null;
  }
}

async function getOrCreateUser(telegramUser) {
  try {
    const { id, username, first_name, language_code } = telegramUser;
    
    // Buscar usuário existente
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', id)
      .single();
    
    // Se não existe, criar
    if (error && error.code === 'PGRST116') {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          telegram_id: id,
          username,
          first_name,
          language_code
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newUser;
    }
    
    if (error) throw error;
    
    // OTIMIZAÇÃO #3: Só atualizar se realmente mudou algo
    const needsUpdate = 
      user.username !== username || 
      user.first_name !== first_name;
    
    if (needsUpdate) {
      await supabase
        .from('users')
        .update({
          username,
          first_name,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', id);
      
      // Atualizar objeto local
      user.username = username;
      user.first_name = first_name;
    }
    
    return user;
  } catch (err) {
    console.error('Erro get/create user:', err.message);
    throw err;
  }
}

async function isUserAdmin(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error) return false;
    return data?.is_admin || false;
  } catch (err) {
    return false;
  }
}

async function isUserCreator(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_creator')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error) {
      console.log(`🔍 [DB] Erro ao verificar criador ${telegramId}:`, error.message);
      return false;
    }
    
    const result = data?.is_creator || false;
    console.log(`🔍 [DB] Usuário ${telegramId} - is_creator: ${result}`);
    return result;
  } catch (err) {
    console.error(`❌ [DB] Erro ao verificar criador ${telegramId}:`, err.message);
    return false;
  }
}

async function setUserAsCreator(telegramId) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_creator: true })
      .eq('telegram_id', telegramId);
    
    if (error) throw error;
    console.log(`✅ Usuário ${telegramId} definido como criador`);
    return true;
  } catch (err) {
    console.error('Erro ao definir como criador:', err);
    return false;
  }
}

// ===== PRODUTOS =====

async function getProduct(productId, includeInactive = false) {
  try {
    if (!productId) {
      console.log('⚠️ [GET_PRODUCT] productId está vazio ou undefined');
      return null;
    }
    
    let query = supabase
      .from('products')
      .select('*')
      .eq('product_id', productId);
    
    // Só filtrar por is_active se não for para incluir inativos
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      // PGRST116 = produto não encontrado (0 rows) - isso é esperado e não é um erro
      if (error.code === 'PGRST116') {
        // Logar apenas se estiver buscando produtos inativos também (para debug)
        if (includeInactive) {
          console.log(`ℹ️ [GET_PRODUCT] Produto "${productId}" não encontrado (mesmo incluindo inativos). Verifique se o product_id está correto no banco de dados.`);
        }
        return null;
      }
      // Outros erros devem ser tratados
      throw error;
    }
    
    // Logar sucesso apenas se produto estava inativo e foi encontrado
    if (includeInactive && data && !data.is_active) {
      console.log(`ℹ️ [GET_PRODUCT] Produto "${productId}" encontrado, mas está INATIVO (is_active = false)`);
    }
    
    return data;
  } catch (err) {
    // Só logar se não for o erro esperado de "não encontrado"
    if (err.code !== 'PGRST116') {
      console.error(`❌ [GET_PRODUCT] Erro ao buscar produto "${productId}":`, {
        code: err.code,
        message: err.message,
        details: err.details,
        includeInactive
      });
    }
    return null;
  }
}

async function getAllProducts(includeInactive = false) {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .order('price', { ascending: true });
    
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return [];
  }
}

async function createProduct({ productId, name, description, price, deliveryType = 'link', deliveryUrl = null }) {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert([{
        product_id: productId,
        name,
        description,
        price,
        delivery_type: deliveryType,
        delivery_url: deliveryUrl,
        is_active: true
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Produto criado:', data.id);
    return data;
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    throw err;
  }
}

async function updateProduct(productId, updates) {
  try {
    const { error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('product_id', productId);
    
    if (error) throw error;
    console.log('Produto atualizado:', productId);
    return true;
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    return false;
  }
}

async function deleteProduct(productId) {
  try {
    // DELETAR EM CASCATA: Primeiro as transações, depois o produto
    
    // 1. Deletar todas as transações associadas ao produto
    const { error: transError } = await supabase
      .from('transactions')
      .delete()
      .eq('product_id', productId);
    
    if (transError) {
      console.error('Erro ao deletar transações do produto:', transError.message);
      throw transError;
    }
    
    console.log(`Transações do produto ${productId} deletadas`);
    
    // 2. Deletar o produto
    const { error: prodError } = await supabase
      .from('products')
      .delete()
      .eq('product_id', productId);
    
    if (prodError) throw prodError;
    
    console.log('Produto deletado permanentemente:', productId);
    return true;
  } catch (err) {
    console.error('Erro ao deletar produto:', err.message);
    return false;
  }
}

async function productHasTransactions(productId) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    
    if (error) throw error;
    
    // Se count for maior que 0, o produto tem transações
    return data && data.length > 0;
  } catch (err) {
    console.error('Erro ao verificar transações do produto:', err.message);
    // Em caso de erro, retornar true para evitar deleção acidental
    return true;
  }
}

// ===== TRANSAÇÕES =====

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
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) throw error;
    console.log('Transação marcada como entregue:', txid);
    
    // 🚀 CACHE: Invalidar cache de estatísticas quando transação é entregue
    cache.delete('stats_admin');
    cache.delete('stats_creator');
    
    return true;
  } catch (err) {
    console.error('Erro ao marcar como entregue:', err);
    return false;
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
          notes: 'Transação expirada - prazo de 30 minutos ultrapassado',
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

// ===== ADMIN =====

async function getPendingTransactions(limit = 10, offset = 0) {
  try {
    // Filtrar apenas transações dos últimos 30 minutos
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    const { data, error, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('status', 'proof_sent')
      .gte('created_at', thirtyMinutesAgo.toISOString())
      .order('proof_received_at', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    const transactions = data || [];
    
    // Buscar informações adicionais para cada transação
    for (const transaction of transactions) {
      // Buscar usuário
      if (transaction.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('telegram_id, username, first_name')
          .eq('id', transaction.user_id)
          .single();
        
        if (userData) {
          transaction.user = userData;
        }
      }
      
      // Buscar produto OU media pack
      if (transaction.product_id) {
        const { data: productData } = await supabase
          .from('products')
          .select('name, price')
          .eq('product_id', transaction.product_id)
          .single();
        
        if (productData) {
          transaction.product = productData;
        }
      } else if (transaction.media_pack_id) {
        const { data: packData } = await supabase
          .from('media_packs')
          .select('name, price')
          .eq('pack_id', transaction.media_pack_id)
          .single();
        
        if (packData) {
          transaction.media_pack = packData;
        }
      }
    }
    
    // count já foi retornado na query acima
    return {
      data: transactions,
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0)
    };
  } catch (err) {
    console.error('Erro ao buscar transações pendentes:', err);
    return {
      data: [],
      total: 0,
      limit,
      offset,
      hasMore: false
    };
  }
}

// Função auxiliar para calcular início do dia atual no horário de Brasília (UTC-3)
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

// Função para obter início do mês atual em Brasília
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
  
  // Criar data no início do mês (dia 01) em Brasília (00:00:00)
  const brasilMonthStart = `${year}-${month}-01T00:00:00`;
  const utcMonthStart = new Date(`${year}-${month}-01T03:00:00Z`);
  
  return utcMonthStart.toISOString();
}

// Função para obter início do mês anterior em Brasília
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
  
  // Calcular mês anterior
  let prevMonth = parseInt(month) - 1;
  let prevYear = parseInt(year);
  
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }
  
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  
  // Criar data no início do mês anterior (dia 01) em Brasília (00:00:00)
  const brasilPrevMonthStart = `${prevYear}-${prevMonthStr}-01T00:00:00`;
  const utcPrevMonthStart = new Date(`${prevYear}-${prevMonthStr}-01T03:00:00Z`);
  
  return utcPrevMonthStart.toISOString();
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
    
    // Total de usuários
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Total de transações
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });
    
    // Transações pendentes
    const { count: pendingTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'proof_sent');
    
    // Total em vendas (entregues) - SEMPRE calcula automaticamente pelas transações
    // Atualização automática em tempo real - não usa valores manuais
    const { data: sales } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'delivered');
    
    const totalSales = sales?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
    console.log('💰 [STATS] Valor calculado automaticamente pelas transações:', totalSales.toFixed(2));
    
    // Transações validadas (apenas status validated)
    const { count: validatedTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'validated');
    
    // Transações entregues (apenas status delivered)
    const { count: deliveredTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered');
    
    // Transações aprovadas (validated + delivered)
    const { count: approvedTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['validated', 'delivered']);
    
    // Transações rejeitadas
    const { count: rejectedTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected');
    
    // Calcular ticket médio (valor médio por transação entregue)
    const avgTicket = deliveredTransactions > 0 
      ? (totalSales / deliveredTransactions).toFixed(2)
      : '0.00';
    
    // Vendas de HOJE (usando delivered_at no horário de Brasília)
    // Atualiza automaticamente em tempo real a cada chamada
    const todayStartISO = getTodayStartBrasil();
    
    const { data: todaySalesData } = await supabase
      .from('transactions')
      .select('amount, delivered_at')
      .eq('status', 'delivered')
      .gte('delivered_at', todayStartISO);
    
    const todaySales = todaySalesData?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    const todayTransactions = todaySalesData?.length || 0;
    
    return {
      totalUsers: totalUsers || 0,
      totalTransactions: totalTransactions || 0,
      pendingTransactions: pendingTransactions || 0,
      validatedTransactions: validatedTransactions || 0,
      deliveredTransactions: deliveredTransactions || 0,
      totalSales: totalSales.toFixed(2),
      avgTicket: avgTicket,
      approvedTransactions: approvedTransactions || 0,
      rejectedTransactions: rejectedTransactions || 0,
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
    
    // Apenas transações entregues (delivered) - mesmo padrão do painel administrativo
    const { count: approvedCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered');
    
    // Total em vendas (apenas entregues) - SEMPRE calcula automaticamente pelas transações
    // Atualização automática em tempo real - não usa valores manuais
    const { data: approvedSales } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'delivered');
    
    const totalSales = approvedSales?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
    console.log('💰 [CREATOR-STATS] Valor calculado automaticamente pelas transações:', totalSales.toFixed(2));
    
    // Vendas de HOJE (usando delivered_at no horário de Brasília)
    // Atualiza automaticamente em tempo real a cada chamada
    const todayStartISO = getTodayStartBrasil();
    
    const { data: todaySalesData } = await supabase
      .from('transactions')
      .select('amount, delivered_at')
      .eq('status', 'delivered')
      .gte('delivered_at', todayStartISO);
    
    const todaySales = todaySalesData?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    const todayTransactions = todaySalesData?.length || 0;
    
    // Transações pendentes (para mostrar)
    const { count: pendingCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'proof_sent');
    
    // Vendas do mês atual (usando delivered_at no horário de Brasília)
    const monthStartISO = getMonthStartBrasil();
    
    const { data: monthSalesData } = await supabase
      .from('transactions')
      .select('amount, delivered_at')
      .eq('status', 'delivered')
      .gte('delivered_at', monthStartISO);
    
    const monthSales = monthSalesData?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
    const monthTransactions = monthSalesData?.length || 0;
    
    // Vendas do mês anterior
    const prevMonthStartISO = getPreviousMonthStartBrasil();
    
    // Fim do mês anterior = início do mês atual
    const { data: prevMonthSalesData } = await supabase
      .from('transactions')
      .select('amount, delivered_at')
      .eq('status', 'delivered')
      .gte('delivered_at', prevMonthStartISO)
      .lt('delivered_at', monthStartISO);
    
    const prevMonthSales = prevMonthSalesData?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
    const prevMonthTransactions = prevMonthSalesData?.length || 0;
    
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

async function getSetting(key) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error) {
      // Se não existe, retornar do env como fallback
      if (key === 'pix_key') {
        return process.env.MY_PIX_KEY || null;
      }
      return null;
    }
    
    return data.value;
  } catch (err) {
    console.error('Erro ao buscar setting:', err.message);
    // Fallback para variável de ambiente
    if (key === 'pix_key') {
      return process.env.MY_PIX_KEY || null;
    }
    return null;
  }
}

async function setSetting(key, value, updatedBy = null) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key,
        value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();
    
    if (error) throw error;
    console.log('Setting atualizado:', key);
    return data;
  } catch (err) {
    console.error('Erro ao salvar setting:', err.message);
    throw err;
  }
}

async function getPixKey() {
  return await getSetting('pix_key');
}

async function setPixKey(pixKey, updatedBy = null) {
  return await setSetting('pix_key', pixKey, updatedBy);
}

// ===== GRUPOS =====

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
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('group_id', groupId);
    
    if (error) throw error;
    console.log('Grupo deletado:', groupId);
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
async function getOCRResult(txid) {
  try {
    console.log(`🔍 [DB-CACHE] Buscando cache OCR para TXID: ${txid}`);
    const { data, error } = await supabase
      .from('transactions')
      .select('ocr_result, ocr_confidence, ocr_analyzed_at')
      .eq('txid', txid)
      .single();
    
    // PGRST116 = not found (transação não existe ou campos não existem ainda)
    if (error && error.code === 'PGRST116') {
      console.log(`ℹ️ [DB-CACHE] Nenhum cache encontrado para TXID ${txid} (primeira análise)`);
      return null;
    }
    
    if (error) {
      console.error(`❌ [DB-CACHE] Erro ao buscar cache:`, error.message);
      return null;
    }
    
    // Se existe resultado e foi analisado recentemente (últimas 24h), retornar
    if (data && data.ocr_result && data.ocr_analyzed_at) {
      const analyzedAt = new Date(data.ocr_analyzed_at);
      const now = new Date();
      const hoursDiff = (now - analyzedAt) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        console.log(`✅ [DB-CACHE] Cache OCR encontrado para TXID ${txid} (${hoursDiff.toFixed(1)}h atrás)`);
        return {
          isValid: data.ocr_result.isValid,
          confidence: data.ocr_confidence,
          details: data.ocr_result.details || {}
        };
      } else {
        console.log(`⏰ [DB-CACHE] Cache expirado para TXID ${txid} (${hoursDiff.toFixed(1)}h atrás, > 24h)`);
      }
    } else {
      console.log(`ℹ️ [DB-CACHE] Nenhum resultado OCR salvo ainda para TXID ${txid}`);
    }
    
    return null;
  } catch (err) {
    console.error(`❌ [DB-CACHE] Erro ao buscar cache OCR:`, err.message);
    console.error(`❌ [DB-CACHE] Stack:`, err.stack);
    return null;
  }
}

/**
 * Salva resultado do OCR no banco para cache
 */
async function saveOCRResult(txid, ocrResult) {
  try {
    console.log(`💾 [DB-CACHE] Salvando resultado OCR no cache para TXID: ${txid}`);
    const { error } = await supabase
      .from('transactions')
      .update({
        ocr_result: ocrResult,
        ocr_confidence: ocrResult.confidence || 0,
        ocr_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) {
      console.error(`❌ [DB-CACHE] Erro ao salvar cache:`, error.message);
      throw error;
    }
    
    console.log(`✅ [DB-CACHE] Resultado OCR salvo no cache para TXID ${txid} (confiança: ${ocrResult.confidence || 0}%)`);
    return true;
  } catch (err) {
    console.error(`❌ [DB-CACHE] Erro ao salvar cache OCR:`, err.message);
    console.error(`❌ [DB-CACHE] Stack:`, err.stack);
    return false;
  }
}

/**
 * Atualiza URL do arquivo de comprovante (para uso futuro com Supabase Storage)
 */
async function updateProofFileUrl(txid, fileUrl) {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        proof_file_url: fileUrl,
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) {
      console.warn(`⚠️ [DB-CACHE] Erro ao atualizar URL do arquivo:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`⚠️ [DB-CACHE] Erro ao atualizar URL do arquivo:`, err.message);
    return false;
  }
}

// ===== MEDIA PACKS =====

async function getAllMediaPacks() {
  try {
    const { data, error } = await supabase
      .from('media_packs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const packs = data || [];
    
    // Buscar contagem de itens para cada pack separadamente
    for (const pack of packs) {
      const { count } = await supabase
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('pack_id', pack.pack_id);
      
      pack.items_count = count || 0;
    }
    
    return packs;
  } catch (err) {
    console.error('Erro ao buscar media packs:', err.message);
    return [];
  }
}

async function getMediaPackById(packId) {
  try {
    const { data, error } = await supabase
      .from('media_packs')
      .select('*')
      .eq('pack_id', packId)
      .single();
    
    if (error) {
      // PGRST116 = pack não encontrado (0 rows) - isso é esperado e não é um erro
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    return data;
  } catch (err) {
    // Só logar se não for o erro esperado de "não encontrado"
    if (err.code !== 'PGRST116') {
      console.error('Erro ao buscar media pack:', err.message);
    }
    return null;
  }
}

async function createMediaPack({ packId, name, description, price, itemsPerDelivery = 3 }) {
  try {
    const { data, error } = await supabase
      .from('media_packs')
      .insert([{
        pack_id: packId,
        name,
        description,
        price,
        items_per_delivery: itemsPerDelivery
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Media pack criado:', packId);
    return data;
  } catch (err) {
    console.error('Erro ao criar media pack:', err.message);
    throw err;
  }
}

async function addMediaItem({ packId, fileName, fileUrl, fileType, storagePath, thumbnailUrl = null, sizeBytes = null }) {
  try {
    const { data, error } = await supabase
      .from('media_items')
      .insert([{
        pack_id: packId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        storage_path: storagePath,
        thumbnail_url: thumbnailUrl,
        size_bytes: sizeBytes
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Media item adicionado:', fileName);
    return data;
  } catch (err) {
    console.error('Erro ao adicionar media item:', err.message);
    throw err;
  }
}

async function getMediaItems(packId) {
  try {
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar media items:', err.message);
    return [];
  }
}

async function getRandomMediaItems(packId, userId, count = 3) {
  try {
    // Buscar itens já entregues para este usuário
    const { data: delivered, error: deliveredError } = await supabase
      .from('media_deliveries')
      .select('media_item_id')
      .eq('pack_id', packId)
      .eq('user_id', userId);
    
    if (deliveredError) throw deliveredError;
    
    const deliveredIds = delivered ? delivered.map(d => d.media_item_id) : [];
    
    // Buscar todos os itens do pack
    const { data: allItems, error: itemsError } = await supabase
      .from('media_items')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_active', true);
    
    if (itemsError) throw itemsError;
    
    if (!allItems || allItems.length === 0) {
      throw new Error('Pack sem itens de mídia cadastrados');
    }
    
    // Filtrar itens não entregues
    let availableItems = allItems.filter(item => !deliveredIds.includes(item.id));
    
    // Se não há itens disponíveis, resetar e usar todos
    if (availableItems.length === 0) {
      console.log('Todos os itens já foram entregues, resetando pool');
      availableItems = allItems;
    }
    
    // Selecionar itens aleatórios
    const shuffled = availableItems.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    
    return selected;
  } catch (err) {
    console.error('Erro ao buscar media items aleatórios:', err.message);
    throw err;
  }
}

async function recordMediaDelivery({ transactionId, userId, packId, mediaItemId }) {
  try {
    const { data, error } = await supabase
      .from('media_deliveries')
      .insert([{
        transaction_id: transactionId,
        user_id: userId,
        pack_id: packId,
        media_item_id: mediaItemId
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao registrar entrega de mídia:', err.message);
    return null;
  }
}

async function deleteMediaPack(packId) {
  try {
    // Deletar itens de mídia (cascata)
    const { error: itemsError } = await supabase
      .from('media_items')
      .delete()
      .eq('pack_id', packId);
    
    if (itemsError) throw itemsError;
    
    // Deletar pack
    const { error: packError } = await supabase
      .from('media_packs')
      .delete()
      .eq('pack_id', packId);
    
    if (packError) throw packError;
    
    console.log('Media pack deletado:', packId);
    return true;
  } catch (err) {
    console.error('Erro ao deletar media pack:', err.message);
    return false;
  }
}

async function deleteMediaItem(itemId) {
  try {
    const { error } = await supabase
      .from('media_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    console.log('Media item deletado:', itemId);
    return true;
  } catch (err) {
    console.error('Erro ao deletar media item:', err.message);
    return false;
  }
}

// ===== BLOQUEIO POR DDD =====

async function getBlockedAreaCodes() {
  try {
    const { data, error } = await supabase
      .from('blocked_area_codes')
      .select('*')
      .order('area_code');
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar DDDs bloqueados:', err);
    return [];
  }
}

async function isAreaCodeBlocked(areaCode) {
  try {
    const { data, error } = await supabase
      .from('blocked_area_codes')
      .select('*')
      .eq('area_code', areaCode)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return false; // Não encontrado = não bloqueado
    }
    
    if (error) throw error;
    return true; // Encontrado = bloqueado
  } catch (err) {
    console.error('Erro ao verificar DDD:', err);
    return false;
  }
}

async function addBlockedAreaCode(areaCode, state, reason = '') {
  try {
    const { data, error } = await supabase
      .from('blocked_area_codes')
      .insert([{ area_code: areaCode, state, reason }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao adicionar DDD bloqueado:', err);
    return null;
  }
}

async function removeBlockedAreaCode(areaCode) {
  try {
    const { error } = await supabase
      .from('blocked_area_codes')
      .delete()
      .eq('area_code', areaCode);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao remover DDD bloqueado:', err);
    return false;
  }
}

async function updateUserPhone(telegramId, phoneNumber) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ phone_number: phoneNumber })
      .eq('telegram_id', telegramId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar telefone:', err);
    return null;
  }
}

function extractAreaCode(phoneNumber) {
  // Remove todos os caracteres não numéricos
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Formato brasileiro: +55 (DDD) XXXXX-XXXX
  // Pode vir como: 5511999999999, 11999999999, (11) 99999-9999, etc.
  
  if (cleaned.length >= 12 && cleaned.startsWith('55')) {
    // Formato internacional: 5511999999999
    return cleaned.substring(2, 4);
  } else if (cleaned.length === 11 && cleaned.startsWith('5')) {
    // Formato especial: 59892253870 (DDD nas posições 2-3, não nas posições 0-1)
    // Verificar se posições 2-3 formam um DDD válido bloqueado (98, 86, 64)
    const possibleDDD = cleaned.substring(1, 3);
    if (['98', '86', '64'].includes(possibleDDD)) {
      return possibleDDD;
    }
    // Se não for um DDD bloqueado conhecido, retorna os primeiros 2 dígitos
    return cleaned.substring(0, 2);
  } else if (cleaned.length >= 10) {
    // Formato nacional: 11999999999
    return cleaned.substring(0, 2);
  }
  
  return null;
}

// Função para obter usuários mensais (últimos 30 dias)
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

// ===== SISTEMA DE TICKETS DE SUPORTE =====

/**
 * Cria um novo ticket de suporte
 */
async function createSupportTicket(telegramId, userId, subject, message) {
  try {
    // Gerar número do ticket manualmente
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // Buscar último ticket do dia
    const { data: lastTicket } = await supabase
      .from('support_tickets')
      .select('ticket_number')
      .like('ticket_number', `TKT-${today}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let ticketNumber;
    if (lastTicket && lastTicket.ticket_number) {
      const lastNum = parseInt(lastTicket.ticket_number.split('-')[2]) || 0;
      ticketNumber = `TKT-${today}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      ticketNumber = `TKT-${today}-0001`;
    }
    
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        telegram_id: telegramId,
        ticket_number: ticketNumber,
        subject: subject || 'Sem assunto',
        message: message,
        status: 'open'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Adicionar mensagem inicial
    await supabase
      .from('support_messages')
      .insert({
        ticket_id: data.id,
        user_id: userId,
        is_admin: false,
        message: message
      });
    
    return data;
  } catch (err) {
    console.error('Erro ao criar ticket:', err);
    throw err;
  }
}

/**
 * Busca um ticket por número ou ID
 */
async function getSupportTicket(ticketNumberOrId) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .or(`ticket_number.eq.${ticketNumberOrId},id.eq.${ticketNumberOrId}`)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao buscar ticket:', err);
    return null;
  }
}

/**
 * Busca todos os tickets de um usuário
 */
async function getUserTickets(telegramId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar tickets do usuário:', err);
    return [];
  }
}

/**
 * Busca todos os tickets abertos (para admins)
 */
async function getAllOpenTickets(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select(`
        *,
        users:user_id (first_name, username, telegram_id)
      `)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar tickets abertos:', err);
    return [];
  }
}

/**
 * Adiciona uma mensagem a um ticket
 */
async function addTicketMessage(ticketId, userId, message, isAdmin = false) {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        is_admin: isAdmin,
        message: message
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Atualizar updated_at do ticket
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);
    
    return data;
  } catch (err) {
    console.error('Erro ao adicionar mensagem ao ticket:', err);
    throw err;
  }
}

/**
 * Busca todas as mensagens de um ticket
 */
async function getTicketMessages(ticketId) {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`
        *,
        users:user_id (first_name, username, telegram_id)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar mensagens do ticket:', err);
    return [];
  }
}

/**
 * Atualiza o status de um ticket
 */
async function updateTicketStatus(ticketId, status, adminId = null) {
  try {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'resolved' && !updateData.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }
    if (status === 'closed' && !updateData.closed_at) {
      updateData.closed_at = new Date().toISOString();
    }
    if (adminId) {
      updateData.assigned_to = adminId;
    }
    
    const { data, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar status do ticket:', err);
    throw err;
  }
}

/**
 * Atribui um ticket a um admin
 */
async function assignTicket(ticketId, adminId) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        assigned_to: adminId,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atribuir ticket:', err);
    throw err;
  }
}

// ===== SISTEMA DE CONFIANÇA E APRENDIZADO =====

/**
 * Busca informações de usuário confiável
 */
async function getTrustedUser(telegramId) {
  try {
    const { data, error } = await supabase
      .from('trusted_users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao buscar usuário confiável:', err);
    return null;
  }
}

/**
 * Atualiza ou cria registro de usuário confiável
 */
async function updateTrustedUser(telegramId, userId, isApproved = true) {
  try {
    const trusted = await getTrustedUser(telegramId);
    
    let trustScore = 50; // Score inicial
    let approvedCount = 0;
    let rejectedCount = 0;
    
    if (trusted) {
      trustScore = parseFloat(trusted.trust_score) || 50;
      approvedCount = trusted.approved_transactions || 0;
      rejectedCount = trusted.rejected_transactions || 0;
    }
    
    // Atualizar score baseado na aprovação/rejeição
    if (isApproved) {
      approvedCount++;
      trustScore = Math.min(100, trustScore + 2); // Aumenta confiança
    } else {
      rejectedCount++;
      trustScore = Math.max(0, trustScore - 5); // Diminui confiança
    }
    
    // Calcular threshold automático (quanto maior a confiança, menor o threshold necessário)
    const autoApproveThreshold = Math.max(40, 70 - (trustScore / 2));
    
    const { data, error } = await supabase
      .from('trusted_users')
      .upsert({
        telegram_id: telegramId,
        user_id: userId,
        trust_score: trustScore,
        approved_transactions: approvedCount,
        rejected_transactions: rejectedCount,
        auto_approve_threshold: autoApproveThreshold,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'telegram_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar usuário confiável:', err);
    throw err;
  }
}

/**
 * Adiciona usuário à whitelist manualmente
 */
async function addTrustedUser(telegramId, userId, initialScore = 80) {
  try {
    const { data, error } = await supabase
      .from('trusted_users')
      .upsert({
        telegram_id: telegramId,
        user_id: userId,
        trust_score: initialScore,
        auto_approve_threshold: Math.max(40, 70 - (initialScore / 2)),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'telegram_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao adicionar usuário confiável:', err);
    throw err;
  }
}

/**
 * Busca padrões de comprovantes válidos
 */
async function getProofPatterns(patternType = null) {
  try {
    let query = supabase
      .from('proof_patterns')
      .select('*')
      .order('confidence_score', { ascending: false });
    
    if (patternType) {
      query = query.eq('pattern_type', patternType);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar padrões:', err);
    return [];
  }
}

/**
 * Atualiza padrão de comprovante (aprendizado)
 */
async function updateProofPattern(patternType, patternValue, isValid) {
  try {
    // Buscar padrão existente
    const { data: existing } = await supabase
      .from('proof_patterns')
      .select('*')
      .eq('pattern_type', patternType)
      .eq('pattern_value', patternValue)
      .single();
    
    let successCount = isValid ? 1 : 0;
    let failureCount = isValid ? 0 : 1;
    let confidenceScore = isValid ? 60 : 40;
    
    if (existing) {
      successCount = existing.success_count + (isValid ? 1 : 0);
      failureCount = existing.failure_count + (isValid ? 0 : 1);
      
      // Calcular score de confiança (0-100)
      const total = successCount + failureCount;
      confidenceScore = total > 0 ? (successCount / total) * 100 : 50;
    }
    
    const { data, error } = await supabase
      .from('proof_patterns')
      .upsert({
        pattern_type: patternType,
        pattern_value: patternValue,
        confidence_score: confidenceScore,
        success_count: successCount,
        failure_count: failureCount,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'pattern_type,pattern_value'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar padrão:', err);
    throw err;
  }
}

// ===== SISTEMA DE RESPOSTAS AUTOMÁTICAS =====

/**
 * Busca resposta automática para uma palavra-chave
 */
async function getAutoResponse(keyword) {
  try {
    const keywordLower = keyword.toLowerCase().trim();
    
    // Buscar respostas ativas ordenadas por prioridade
    const { data, error } = await supabase
      .from('auto_responses')
      .select('*')
      .eq('is_active', true)
      .ilike('keyword', `%${keywordLower}%`)
      .order('priority', { ascending: false })
      .order('usage_count', { ascending: true })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Erro ao buscar resposta automática:', err);
    return null;
  }
}

/**
 * Busca todas as respostas automáticas
 */
async function getAllAutoResponses() {
  try {
    const { data, error } = await supabase
      .from('auto_responses')
      .select('*')
      .order('priority', { ascending: false })
      .order('keyword', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar respostas automáticas:', err);
    return [];
  }
}

/**
 * Cria nova resposta automática
 */
async function createAutoResponse(keyword, response, priority = 0) {
  try {
    const { data, error } = await supabase
      .from('auto_responses')
      .insert({
        keyword: keyword.toLowerCase().trim(),
        response: response,
        priority: priority,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao criar resposta automática:', err);
    throw err;
  }
}

/**
 * Atualiza contador de uso de resposta automática
 */
async function updateAutoResponseUsage(responseId) {
  try {
    const { data: current } = await supabase
      .from('auto_responses')
      .select('usage_count')
      .eq('id', responseId)
      .single();
    
    const usageCount = (current?.usage_count || 0) + 1;
    
    const { data, error } = await supabase
      .from('auto_responses')
      .update({
        usage_count: usageCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', responseId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar uso de resposta:', err);
    return null;
  }
}

/**
 * Recalcula e atualiza o valor total de vendas baseado em todas as transações entregues
 * Útil para sincronizar valores após mudanças ou correções
 * Também corrige inconsistências automaticamente
 */
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
    
    // Calcular total
    const totalSales = sales.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const totalTransactions = sales.length;
    
    // Calcular por período
    const todayStartISO = getTodayStartBrasil();
    const todaySales = sales
      .filter(t => t.delivered_at && new Date(t.delivered_at) >= new Date(todayStartISO))
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const todayTransactions = sales.filter(t => t.delivered_at && new Date(t.delivered_at) >= new Date(todayStartISO)).length;
    
    const fixedCount = (validatedWithDelivered?.length || 0) + (validatedWithoutDelivered?.length || 0);
    
    console.log(`✅ [RECALC] Recalculado com sucesso:`);
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
      message: `Recalculado: R$ ${totalSales.toFixed(2)} em ${totalTransactions} transações${fixedCount > 0 ? ` (${fixedCount} corrigidas)` : ''}`
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

