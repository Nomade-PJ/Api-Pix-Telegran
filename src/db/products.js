// src/db/products.js
const { supabase } = require('./client');

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


module.exports = {
  getProduct,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  productHasTransactions
};
