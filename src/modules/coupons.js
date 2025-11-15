// src/modules/coupons.js
const db = require('../database');

/**
 * Criar novo cupom
 */
async function createCoupon({ code, type, value, maxUses = null, expiresAt = null, products = null, createdBy }) {
  try {
    const { data, error } = await db.supabase
      .from('coupons')
      .insert([{
        code: code.toUpperCase(),
        type,
        value,
        max_uses: maxUses,
        expires_at: expiresAt,
        products,
        created_by: createdBy
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao criar cupom:', err);
    throw err;
  }
}

/**
 * Validar cupom
 */
async function validateCoupon(code, productId = null) {
  try {
    const { data: coupon, error } = await db.supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();
    
    if (error) {
      return { valid: false, message: '❌ Cupom não encontrado ou inválido.' };
    }
    
    // Verificar expiração
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, message: '❌ Cupom expirado.' };
    }
    
    // Verificar limite de usos
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, message: '❌ Cupom esgotado.' };
    }
    
    // Verificar se aplica ao produto
    if (coupon.products && productId && !coupon.products.includes(productId)) {
      return { valid: false, message: '❌ Cupom não válido para este produto.' };
    }
    
    return { valid: true, coupon };
  } catch (err) {
    console.error('Erro ao validar cupom:', err);
    return { valid: false, message: '❌ Erro ao validar cupom.' };
  }
}

/**
 * Aplicar cupom (incrementar uso)
 */
async function applyCoupon(couponId) {
  try {
    const { error } = await db.supabase
      .from('coupons')
      .update({
        current_uses: db.supabase.sql`current_uses + 1`,
        updated_at: new Date().toISOString()
      })
      .eq('id', couponId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao aplicar cupom:', err);
    return false;
  }
}

/**
 * Calcular desconto
 */
function calculateDiscount(amount, coupon) {
  if (coupon.type === 'percent') {
    return (parseFloat(amount) * parseFloat(coupon.value)) / 100;
  } else {
    return parseFloat(coupon.value);
  }
}

/**
 * Listar todos os cupons
 */
async function getAllCoupons(activeOnly = false) {
  try {
    let query = db.supabase
      .from('coupons')
      .select(`
        *,
        creator:created_by(username, first_name)
      `)
      .order('created_at', { ascending: false });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao listar cupons:', err);
    return [];
  }
}

/**
 * Desativar cupom
 */
async function deactivateCoupon(couponId) {
  try {
    const { error } = await db.supabase
      .from('coupons')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', couponId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao desativar cupom:', err);
    return false;
  }
}

/**
 * Estatísticas de cupom
 */
async function getCouponStats(couponId) {
  try {
    // Buscar cupom
    const { data: coupon, error: couponError } = await db.supabase
      .from('coupons')
      .select('*')
      .eq('id', couponId)
      .single();
    
    if (couponError) throw couponError;
    
    // Buscar transações com o cupom
    const { data: transactions, error: txError } = await db.supabase
      .from('transactions')
      .select('amount, discount_amount, status')
      .eq('coupon_id', couponId);
    
    if (txError) throw txError;
    
    const totalUses = transactions.length;
    const totalDiscount = transactions.reduce((sum, tx) => sum + parseFloat(tx.discount_amount || 0), 0);
    const totalRevenue = transactions
      .filter(tx => tx.status === 'delivered')
      .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    
    return {
      coupon,
      totalUses,
      totalDiscount,
      totalRevenue
    };
  } catch (err) {
    console.error('Erro ao buscar stats do cupom:', err);
    return null;
  }
}

module.exports = {
  createCoupon,
  validateCoupon,
  applyCoupon,
  calculateDiscount,
  getAllCoupons,
  deactivateCoupon,
  getCouponStats
};

