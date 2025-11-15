// src/modules/reviews.js
const db = require('../database');

/**
 * Criar avaliação
 */
async function createReview(transactionId, userId, productId, rating, comment = null) {
  try {
    const { data, error } = await db.supabase
      .from('reviews')
      .insert([{
        transaction_id: transactionId,
        user_id: userId,
        product_id: productId,
        rating,
        comment
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao criar avaliação:', err);
    throw err;
  }
}

/**
 * Buscar avaliações de um produto
 */
async function getProductReviews(productId) {
  try {
    const { data, error } = await db.supabase
      .from('reviews')
      .select(`
        *,
        user:user_id(first_name, username)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar avaliações:', err);
    return [];
  }
}

/**
 * Calcular média de avaliações de um produto
 */
async function getProductAverageRating(productId) {
  try {
    const { data, error } = await db.supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', productId);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return { average: 0, count: 0 };
    }
    
    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / data.length;
    
    return {
      average: average.toFixed(1),
      count: data.length
    };
  } catch (err) {
    console.error('Erro ao calcular média:', err);
    return { average: 0, count: 0 };
  }
}

/**
 * Verificar se transação já foi avaliada
 */
async function hasReview(transactionId) {
  try {
    const { data, error } = await db.supabase
      .from('reviews')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (err) {
    console.error('Erro ao verificar avaliação:', err);
    return false;
  }
}

/**
 * Marcar que review foi solicitada
 */
async function markReviewRequested(transactionId) {
  try {
    const { error } = await db.supabase
      .from('transactions')
      .update({
        review_requested: true,
        review_requested_at: new Date().toISOString()
      })
      .eq('txid', transactionId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao marcar review solicitada:', err);
    return false;
  }
}

/**
 * Buscar todas as avaliações (admin)
 */
async function getAllReviews(limit = 50) {
  try {
    const { data, error } = await db.supabase
      .from('reviews')
      .select(`
        *,
        user:user_id(first_name, username),
        product:product_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar todas avaliações:', err);
    return [];
  }
}

/**
 * Estatísticas gerais de avaliações
 */
async function getReviewStats() {
  try {
    const { data, error } = await db.supabase
      .from('reviews')
      .select('rating, product_id');
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        total: 0,
        averageRating: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      };
    }
    
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    
    data.forEach(r => {
      distribution[r.rating]++;
      sum += r.rating;
    });
    
    return {
      total: data.length,
      averageRating: (sum / data.length).toFixed(1),
      distribution
    };
  } catch (err) {
    console.error('Erro ao buscar stats de avaliações:', err);
    return {
      total: 0,
      averageRating: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };
  }
}

module.exports = {
  createReview,
  getProductReviews,
  getProductAverageRating,
  hasReview,
  markReviewRequested,
  getAllReviews,
  getReviewStats
};

