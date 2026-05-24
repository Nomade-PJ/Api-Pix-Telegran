// src/db/stats.js
const { supabase } = require('./client');
const cache = require('../cache');


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

module.exports = {
  getPendingTransactions,
  getTodayStartBrasil,
  getMonthStartBrasil,
  getPreviousMonthStartBrasil,
  getStats,
  getCreatorStats,
  getRecentUsers,
  getActiveBuyers,
  getAllUnblockedUsers,
  getAllAdmins
};
