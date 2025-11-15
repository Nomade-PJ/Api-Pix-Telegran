// src/modules/backup.js
const db = require('../database');

/**
 * Exportar usuários
 */
async function exportUsers() {
  try {
    const { data, error } = await db.supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Gerar CSV
    let csv = 'ID,Telegram ID,Username,Nome,Admin,Bloqueado,Data Cadastro\n';
    
    data.forEach(u => {
      const date = new Date(u.created_at).toLocaleString('pt-BR');
      csv += `${u.id},${u.telegram_id},${u.username || 'N/A'},${u.first_name || 'N/A'},${u.is_admin ? 'Sim' : 'Não'},${u.is_blocked ? 'Sim' : 'Não'},${date}\n`;
    });
    
    return csv;
  } catch (err) {
    console.error('Erro ao exportar usuários:', err);
    return null;
  }
}

/**
 * Exportar vendas
 */
async function exportSales() {
  try {
    const { data, error } = await db.supabase
      .from('transactions')
      .select(`
        *,
        user:user_id(first_name, username),
        product:product_id(name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Gerar CSV
    let csv = 'TXID,Data,Cliente,Username,Produto,Valor Original,Desconto,Valor Final,Status,Data Validação,Data Entrega\n';
    
    data.forEach(t => {
      const date = new Date(t.created_at).toLocaleString('pt-BR');
      const validatedDate = t.validated_at ? new Date(t.validated_at).toLocaleString('pt-BR') : 'N/A';
      const deliveredDate = t.delivered_at ? new Date(t.delivered_at).toLocaleString('pt-BR') : 'N/A';
      const originalAmount = t.original_amount ? parseFloat(t.original_amount).toFixed(2) : parseFloat(t.amount).toFixed(2);
      const discount = t.discount_amount ? parseFloat(t.discount_amount).toFixed(2) : '0.00';
      const finalAmount = parseFloat(t.amount).toFixed(2);
      
      csv += `${t.txid},${date},${t.user?.first_name || 'N/A'},${t.user?.username || 'N/A'},${t.product?.name || t.product_id},${originalAmount},${discount},${finalAmount},${t.status},${validatedDate},${deliveredDate}\n`;
    });
    
    return csv;
  } catch (err) {
    console.error('Erro ao exportar vendas:', err);
    return null;
  }
}

/**
 * Exportar produtos
 */
async function exportProducts() {
  try {
    const { data, error } = await db.supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Gerar JSON formatado
    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('Erro ao exportar produtos:', err);
    return null;
  }
}

/**
 * Gerar backup completo
 */
async function generateFullBackup() {
  try {
    const [users, products, transactions] = await Promise.all([
      db.supabase.from('users').select('*'),
      db.supabase.from('products').select('*'),
      db.supabase.from('transactions').select('*')
    ]);
    
    const backup = {
      generated_at: new Date().toISOString(),
      users: users.data || [],
      products: products.data || [],
      transactions: transactions.data || []
    };
    
    return JSON.stringify(backup, null, 2);
  } catch (err) {
    console.error('Erro ao gerar backup completo:', err);
    return null;
  }
}

/**
 * Estatísticas do banco de dados
 */
async function getDatabaseStats() {
  try {
    const [users, products, transactions, coupons, reviews] = await Promise.all([
      db.supabase.from('users').select('*', { count: 'exact', head: true }),
      db.supabase.from('products').select('*', { count: 'exact', head: true }),
      db.supabase.from('transactions').select('*', { count: 'exact', head: true }),
      db.supabase.from('coupons').select('*', { count: 'exact', head: true }),
      db.supabase.from('reviews').select('*', { count: 'exact', head: true })
    ]);
    
    return {
      users: users.count || 0,
      products: products.count || 0,
      transactions: transactions.count || 0,
      coupons: coupons.count || 0,
      reviews: reviews.count || 0
    };
  } catch (err) {
    console.error('Erro ao buscar stats do banco:', err);
    return null;
  }
}

module.exports = {
  exportUsers,
  exportSales,
  exportProducts,
  generateFullBackup,
  getDatabaseStats
};

