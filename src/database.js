// src/database.js
const { createClient } = require('@supabase/supabase-js');

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ===== USUÁRIOS =====

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

// ===== PRODUTOS =====

async function getProduct(productId) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
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
    // DELETAR PERMANENTEMENTE (não apenas desativar)
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('product_id', productId);
    
    if (error) throw error;
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

async function createTransaction({ txid, userId, telegramId, productId, amount, pixKey, pixPayload }) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        txid,
        user_id: userId,
        telegram_id: telegramId,
        product_id: productId,
        amount,
        pix_key: pixKey,
        pix_payload: pixPayload,
        status: 'pending'
      }])
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
      .select(`
        *,
        user:user_id(telegram_id, username, first_name),
        product:product_id(name, price)
      `)
      .eq('txid', txid)
      .single();
    
    if (error) throw error;
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

// ===== ADMIN =====

async function getPendingTransactions(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        user:user_id(telegram_id, username, first_name),
        product:product_id(name, price)
      `)
      .eq('status', 'proof_sent')
      .order('proof_received_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar transações pendentes:', err);
    return [];
  }
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
    
    // Total em vendas (entregues)
    const { data: sales } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'delivered');
    
    const totalSales = sales?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
    return {
      totalUsers: totalUsers || 0,
      totalTransactions: totalTransactions || 0,
      pendingTransactions: pendingTransactions || 0,
      totalSales: totalSales.toFixed(2)
    };
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    return {
      totalUsers: 0,
      totalTransactions: 0,
      pendingTransactions: 0,
      totalSales: '0.00'
    };
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

module.exports = {
  supabase,
  getOrCreateUser,
  isUserAdmin,
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
  getPendingTransactions,
  getStats,
  getSetting,
  setSetting,
  getPixKey,
  setPixKey
};

