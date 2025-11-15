// src/modules/reports.js
const db = require('../database');

/**
 * Relatório de hoje
 */
async function getTodayReport() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Vendas de hoje
    const { data: sales, error: salesError } = await db.supabase
      .from('transactions')
      .select('amount, status, created_at')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    
    if (salesError) throw salesError;
    
    // Novos usuários hoje
    const { count: newUsers, error: usersError } = await db.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    
    if (usersError) throw usersError;
    
    // Pendentes
    const { count: pending, error: pendingError } = await db.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'proof_sent');
    
    if (pendingError) throw pendingError;
    
    const totalSales = sales.filter(s => s.status === 'delivered').length;
    const totalRevenue = sales
      .filter(s => s.status === 'delivered')
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);
    
    return {
      date: today,
      totalRevenue: totalRevenue.toFixed(2),
      totalSales,
      newUsers: newUsers || 0,
      pendingPayments: pending || 0
    };
  } catch (err) {
    console.error('Erro ao gerar relatório de hoje:', err);
    return null;
  }
}

/**
 * Relatório por período
 */
async function getReportByPeriod(days) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data: transactions, error } = await db.supabase
      .from('transactions')
      .select(`
        *,
        product:product_id(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (error) throw error;
    
    const delivered = transactions.filter(t => t.status === 'delivered');
    const totalRevenue = delivered.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const averageTicket = delivered.length > 0 ? totalRevenue / delivered.length : 0;
    
    // Produtos mais vendidos
    const productSales = {};
    delivered.forEach(t => {
      const productName = t.product?.name || t.product_id;
      productSales[productName] = (productSales[productName] || 0) + 1;
    });
    
    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    return {
      period: `${days} dias`,
      startDate,
      endDate,
      totalTransactions: transactions.length,
      totalSales: delivered.length,
      totalRevenue: totalRevenue.toFixed(2),
      averageTicket: averageTicket.toFixed(2),
      topProducts
    };
  } catch (err) {
    console.error('Erro ao gerar relatório por período:', err);
    return null;
  }
}

/**
 * Relatório do mês atual
 */
async function getMonthReport() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const { data: transactions, error } = await db.supabase
      .from('transactions')
      .select(`
        *,
        product:product_id(name)
      `)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());
    
    if (error) throw error;
    
    const delivered = transactions.filter(t => t.status === 'delivered');
    const totalRevenue = delivered.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    // Produto mais vendido
    const productSales = {};
    delivered.forEach(t => {
      const productName = t.product?.name || t.product_id;
      productSales[productName] = (productSales[productName] || 0) + 1;
    });
    
    const topProduct = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)[0];
    
    return {
      month: now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
      totalRevenue: totalRevenue.toFixed(2),
      totalSales: delivered.length,
      topProduct: topProduct ? topProduct[0] : 'N/A',
      topProductSales: topProduct ? topProduct[1] : 0
    };
  } catch (err) {
    console.error('Erro ao gerar relatório do mês:', err);
    return null;
  }
}

/**
 * Exportar para CSV
 */
function generateCSV(transactions) {
  let csv = 'TXID,Data,Cliente,Produto,Valor,Status,Cupom,Desconto\n';
  
  transactions.forEach(t => {
    const date = new Date(t.created_at).toLocaleString('pt-BR');
    const client = t.user?.first_name || 'N/A';
    const product = t.product?.name || t.product_id;
    const amount = parseFloat(t.amount).toFixed(2);
    const status = t.status;
    const coupon = t.coupon_id ? 'Sim' : 'Não';
    const discount = t.discount_amount ? parseFloat(t.discount_amount).toFixed(2) : '0.00';
    
    csv += `${t.txid},${date},${client},${product},${amount},${status},${coupon},${discount}\n`;
  });
  
  return csv;
}

/**
 * Gerar relatório de vendas por dia (para gráficos)
 */
async function getSalesByDay(days = 7) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data: transactions, error } = await db.supabase
      .from('transactions')
      .select('amount, status, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'delivered');
    
    if (error) throw error;
    
    // Agrupar por dia
    const salesByDay = {};
    transactions.forEach(t => {
      const day = new Date(t.created_at).toLocaleDateString('pt-BR');
      if (!salesByDay[day]) {
        salesByDay[day] = { date: day, sales: 0, revenue: 0 };
      }
      salesByDay[day].sales++;
      salesByDay[day].revenue += parseFloat(t.amount);
    });
    
    return Object.values(salesByDay);
  } catch (err) {
    console.error('Erro ao gerar vendas por dia:', err);
    return [];
  }
}

module.exports = {
  getTodayReport,
  getReportByPeriod,
  getMonthReport,
  generateCSV,
  getSalesByDay
};

