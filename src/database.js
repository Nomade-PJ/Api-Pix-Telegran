// src/database.js
const { createClient } = require('@supabase/supabase-js');

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
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('txid', txid)
      .single();
    
    if (error) throw error;
    
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
    console.error('Erro ao buscar transação:', err);
    return null;
  }
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

async function updateTransactionProof(txid, fileId) {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        proof_file_id: fileId,
        proof_received_at: new Date().toISOString(),
        status: 'proof_sent',
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) throw error;
    console.log('Comprovante registrado:', txid);
    return true;
  } catch (err) {
    console.error('Erro ao atualizar comprovante:', err);
    return false;
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
    return true;
  } catch (err) {
    console.error('Erro ao marcar como entregue:', err);
    return false;
  }
}

async function cancelTransaction(txid) {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'expired',
        notes: 'Transação expirada - prazo de 30 minutos ultrapassado',
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) throw error;
    console.log('Transação cancelada por expiração:', txid);
    return true;
  } catch (err) {
    console.error('Erro ao cancelar transação:', err);
    return false;
  }
}

// ===== ADMIN =====

async function getPendingTransactions(limit = 10) {
  try {
    // Filtrar apenas transações dos últimos 30 minutos
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'proof_sent')
      .gte('created_at', thirtyMinutesAgo.toISOString())
      .order('proof_received_at', { ascending: true })
      .limit(limit);
    
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
    
    return transactions;
  } catch (err) {
    console.error('Erro ao buscar transações pendentes:', err);
    return [];
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

async function getStats() {
  try {
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
    
    // Total em vendas (entregues) - TODAS desde o início do bot
    const { data: sales } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'delivered');
    
    const totalSales = sales?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
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
async function getCreatorStats() {
  try {
    // Apenas transações entregues (delivered) - mesmo padrão do painel administrativo
    const { count: approvedCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered');
    
    // Total em vendas (apenas entregues)
    const { data: approvedSales } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'delivered');
    
    const totalSales = approvedSales?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
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
    
    return {
      totalTransactions: approvedCount || 0, // Apenas aprovadas
      approvedTransactions: approvedCount || 0,
      rejectedTransactions: 0, // Criadores não veem rejeitadas
      pendingTransactions: pendingCount || 0,
      totalSales: totalSales.toFixed(2),
      todaySales: todaySales.toFixed(2),
      todayTransactions: todayTransactions || 0
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

async function getRecentUsers(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar usuários recentes:', err.message);
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
    
    const { data, error } = await supabase
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
    
    if (error) throw error;
    console.log('Membro adicionado:', telegramId);
    return data;
  } catch (err) {
    console.error('Erro ao adicionar membro:', err.message);
    throw err;
  }
}

async function getExpiringMembers() {
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
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar membros expirando:', err.message);
    return [];
  }
}

async function getExpiredMembers() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        *,
        user:user_id(telegram_id),
        group:group_id(group_id, group_name, subscription_price, subscription_days)
      `)
      .eq('status', 'active')
      .lt('expires_at', now);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar membros expirados:', err.message);
    return [];
  }
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
  } else if (cleaned.length >= 10) {
    // Formato nacional: 11999999999
    return cleaned.substring(0, 2);
  }
  
  return null;
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
  updateTransactionProof,
  validateTransaction,
  markAsDelivered,
  cancelTransaction,
  getPendingTransactions,
  getStats,
  getCreatorStats,
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
  getExpiredMembers,
  markMemberReminded,
  expireMember,
  getGroupMember,
  getOCRResult,
  saveOCRResult,
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
  extractAreaCode
};

