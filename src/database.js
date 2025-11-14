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
    
    // Atualizar informações se mudaram
    await supabase
      .from('users')
      .update({
        username,
        first_name,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_id', id);
    
    return user;
  } catch (err) {
    console.error('Erro ao get/create user:', err);
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

async function getAllProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return [];
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

module.exports = {
  supabase,
  getOrCreateUser,
  isUserAdmin,
  getProduct,
  getAllProducts,
  createTransaction,
  getTransactionByTxid,
  getLastPendingTransaction,
  updateTransactionProof,
  validateTransaction,
  markAsDelivered,
  getPendingTransactions,
  getStats
};

