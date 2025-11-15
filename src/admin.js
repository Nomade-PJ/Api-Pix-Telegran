// src/admin.js - VERSÃO REFATORADA COM TODOS OS RECURSOS
const { Markup } = require('telegraf');
const db = require('./database');
const deliver = require('./deliver');
const adminLogs = require('./modules/adminLogs');
const coupons = require('./modules/coupons');
const reports = require('./modules/reports');
const notifications = require('./modules/notifications');
const reviews = require('./modules/reviews');
const backup = require('./modules/backup');
const maintenance = require('./modules/maintenance');
const pixKeys = require('./modules/pixKeys');

// Registrar comandos admin
function registerAdminCommands(bot) {
  
  // ============================================
  // PAINEL ADMIN PRINCIPAL COM BOTÕES
  // ============================================
  bot.command('admin', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      // Buscar dados para o dashboard
      const [todayReport, monthReport, stats] = await Promise.all([
        reports.getTodayReport(),
        reports.getMonthReport(),
        db.getStats()
      ]);
      
      const message = `🔐 *PAINEL ADMINISTRATIVO*

📈 *HOJE:*
💰 R$ ${todayReport?.totalRevenue || '0.00'} em vendas (${todayReport?.totalSales || 0} transações)
👥 ${todayReport?.newUsers || 0} novos usuários
⏳ ${todayReport?.pendingPayments || 0} pagamentos pendentes

📊 *ESTE MÊS:*
💵 R$ ${monthReport?.totalRevenue || '0.00'} (total)
🛍️ ${monthReport?.totalSales || 0} vendas
📦 ${monthReport?.topProduct || 'N/A'} (mais vendido)

👥 Total de usuários: ${stats.totalUsers}
💳 Total de transações: ${stats.totalTransactions}`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Estatísticas', 'admin_stats'),
          Markup.button.callback('📈 Relatórios', 'admin_reports')
        ],
        [
          Markup.button.callback('💼 Vendas', 'admin_sales'),
          Markup.button.callback('🛍️ Produtos', 'admin_products')
        ],
        [
          Markup.button.callback('👥 Usuários', 'admin_users'),
          Markup.button.callback('📢 Broadcast', 'admin_broadcast')
        ],
        [
          Markup.button.callback('🎟️ Cupons', 'admin_coupons'),
          Markup.button.callback('⭐ Avaliações', 'admin_reviews')
        ],
        [
          Markup.button.callback('💾 Backup', 'admin_backup'),
          Markup.button.callback('⚙️ Configurações', 'admin_settings')
        ],
        [
          Markup.button.callback('🔄 Atualizar', 'admin_refresh')
        ]
      ]);
      
      await adminLogs.logAction(ctx.from.id, 'admin_panel_accessed');
      return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro no comando admin:', err);
      return ctx.reply('❌ Erro ao carregar painel.');
    }
  });
  
  // ============================================
  // CALLBACKS DO MENU PRINCIPAL
  // ============================================
  
  // Refresh do painel
  bot.action('admin_refresh', async (ctx) => {
    await ctx.answerCbQuery('🔄 Atualizando...');
    await ctx.deleteMessage();
    return ctx.telegram.sendMessage(ctx.chat.id, '/admin').then(() => {
      bot.handleUpdate({ message: { text: '/admin', from: ctx.from, chat: ctx.chat } });
    });
  });
  
  // Estatísticas detalhadas
  bot.action('admin_stats', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const stats = await db.getStats();
      const reviewStats = await reviews.getReviewStats();
      const notifStats = await notifications.getNotificationStats();
      
      const message = `📊 *ESTATÍSTICAS DETALHADAS*

👥 *Usuários:*
Total: ${stats.totalUsers}

💳 *Transações:*
Total: ${stats.totalTransactions}
⏳ Pendentes: ${stats.pendingTransactions}
✅ Entregues: ${stats.totalTransactions - stats.pendingTransactions}

💰 *Financeiro:*
Total em vendas: R$ ${stats.totalSales}
Ticket médio: R$ ${stats.totalTransactions > 0 ? (parseFloat(stats.totalSales) / stats.totalTransactions).toFixed(2) : '0.00'}

⭐ *Avaliações:*
Total: ${reviewStats.total}
Média: ${reviewStats.averageRating} estrelas
5⭐: ${reviewStats.distribution[5]} | 4⭐: ${reviewStats.distribution[4]} | 3⭐: ${reviewStats.distribution[3]}

📬 *Notificações:*
Enviadas: ${notifStats?.sent || 0}
Pendentes: ${notifStats?.pending || 0}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      await adminLogs.logAction(ctx.from.id, 'viewed_stats');
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro ao mostrar stats:', err);
      return ctx.answerCbQuery('❌ Erro ao carregar estatísticas');
    }
  });
  
  // Voltar ao menu principal
  bot.action('admin_back', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    return bot.handleUpdate({
      message: { text: '/admin', from: ctx.from, chat: ctx.chat }
    });
  });
  
  // ============================================
  // RELATÓRIOS
  // ============================================
  bot.action('admin_reports', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const message = `📈 *RELATÓRIOS*\n\nEscolha o período:`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📅 Hoje', 'report_today')],
        [Markup.button.callback('📊 Últimos 7 dias', 'report_7days')],
        [Markup.button.callback('📊 Últimos 30 dias', 'report_30days')],
        [Markup.button.callback('📆 Este mês', 'report_month')],
        [Markup.button.callback('📥 Exportar CSV', 'report_export')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro ao mostrar relatórios:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('report_today', async (ctx) => {
    try {
      await ctx.answerCbQuery('📊 Gerando relatório...');
      const report = await reports.getTodayReport();
      
      const message = `📅 *RELATÓRIO DE HOJE*\n\n💰 Vendas: R$ ${report.totalRevenue}\n🛍️ Transações: ${report.totalSales}\n👥 Novos usuários: ${report.newUsers}\n⏳ Pendentes: ${report.pendingPayments}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Voltar', 'admin_reports')]
      ]);
      
      await adminLogs.logAction(ctx.from.id, 'generated_report', 'today');
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action(/report_(\d+)days/, async (ctx) => {
    try {
      const days = parseInt(ctx.match[1]);
      await ctx.answerCbQuery('📊 Gerando relatório...');
      
      const report = await reports.getReportByPeriod(days);
      
      let message = `📊 *RELATÓRIO - ${report.period.toUpperCase()}*\n\n`;
      message += `💰 Receita total: R$ ${report.totalRevenue}\n`;
      message += `🛍️ Vendas: ${report.totalSales}\n`;
      message += `📈 Ticket médio: R$ ${report.averageTicket}\n\n`;
      message += `*Top 5 Produtos:*\n`;
      
      report.topProducts.forEach(([name, count], index) => {
        message += `${index + 1}. ${name} (${count} vendas)\n`;
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Voltar', 'admin_reports')]
      ]);
      
      await adminLogs.logAction(ctx.from.id, 'generated_report', `${days}_days`);
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('report_month', async (ctx) => {
    try {
      await ctx.answerCbQuery('📊 Gerando relatório...');
      const report = await reports.getMonthReport();
      
      const message = `📆 *RELATÓRIO DO MÊS*\n\n${report.month}\n\n💰 Receita: R$ ${report.totalRevenue}\n🛍️ Vendas: ${report.totalSales}\n📦 Mais vendido: ${report.topProduct} (${report.topProductSales}x)`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Voltar', 'admin_reports')]
      ]);
      
      await adminLogs.logAction(ctx.from.id, 'generated_report', 'month');
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('report_export', async (ctx) => {
    try {
      await ctx.answerCbQuery('📥 Exportando...');
      
      const { data: transactions } = await db.supabase
        .from('transactions')
        .select(`
          *,
          user:user_id(first_name, username),
          product:product_id(name)
        `)
        .order('created_at', { ascending: false });
      
      const csv = reports.generateCSV(transactions);
      
      await ctx.telegram.sendDocument(ctx.chat.id, {
        source: Buffer.from(csv),
        filename: `vendas_${new Date().toISOString().split('T')[0]}.csv`
      }, {
        caption: '📊 Relatório de vendas exportado!'
      });
      
      await adminLogs.logAction(ctx.from.id, 'exported_csv');
      return ctx.answerCbQuery('✅ Exportado!');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      return ctx.answerCbQuery('❌ Erro ao exportar');
    }
  });
  
  // ============================================
  // VENDAS
  // ============================================
  bot.action('admin_sales', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const pending = await db.getPendingTransactions(5);
      
      let message = `💼 *GERENCIAR VENDAS*\n\n`;
      
      if (pending.length > 0) {
        message += `⏳ *${pending.length} vendas pendentes:*\n\n`;
        pending.forEach(tx => {
          message += `🆔 ${tx.txid}\n`;
          message += `👤 ${tx.user?.first_name || 'N/A'}\n`;
          message += `💰 R$ ${tx.amount}\n\n`;
        });
      } else {
        message += `✅ Nenhuma venda pendente!`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Ver todas pendentes', 'sales_pending')],
        [Markup.button.callback('🔍 Buscar por TXID', 'sales_search')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('sales_pending', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📋 Use o comando /pendentes para ver todas as vendas pendentes.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ============================================
  // PRODUTOS
  // ============================================
  bot.action('admin_products', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const products = await db.getAllProducts(true);
      
      let message = `🛍️ *GERENCIAR PRODUTOS*\n\n`;
      message += `📦 Total: ${products.length}\n`;
      message += `✅ Ativos: ${products.filter(p => p.is_active).length}\n`;
      message += `❌ Inativos: ${products.filter(p => !p.is_active).length}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Listar produtos', 'products_list')],
        [Markup.button.callback('➕ Criar produto', 'products_create')],
        [Markup.button.callback('✏️ Editar produto', 'products_edit')],
        [Markup.button.callback('🗑️ Deletar produto', 'products_delete')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('products_list', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📋 Use o comando /produtos para ver todos os produtos.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  bot.action('products_create', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('➕ Use o comando /novoproduto para criar um produto.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ============================================
  // USUÁRIOS
  // ============================================
  bot.action('admin_users', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const { count: total } = await db.supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      const { count: admins } = await db.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', true);
      
      const { count: blocked } = await db.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_blocked', true);
      
      const message = `👥 *GERENCIAR USUÁRIOS*\n\n📊 Total: ${total}\n🔐 Admins: ${admins}\n🚫 Bloqueados: ${blocked}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Listar usuários', 'users_list')],
        [Markup.button.callback('🔍 Buscar usuário', 'users_search')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('users_list', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📋 Use o comando /users para ver todos os usuários.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ============================================
  // BROADCAST
  // ============================================
  bot.action('admin_broadcast', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📢 Use o comando /broadcast [mensagem] para enviar uma mensagem para todos os usuários.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ============================================
  // CUPONS
  // ============================================
  bot.action('admin_coupons', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const allCoupons = await coupons.getAllCoupons();
      const activeCoupons = allCoupons.filter(c => c.is_active);
      
      const message = `🎟️ *GERENCIAR CUPONS*\n\n📊 Total: ${allCoupons.length}\n✅ Ativos: ${activeCoupons.length}\n❌ Inativos: ${allCoupons.length - activeCoupons.length}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Listar cupons', 'coupons_list')],
        [Markup.button.callback('➕ Criar cupom', 'coupons_create')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('coupons_list', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📋 Use o comando /cupons para ver todos os cupons.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  bot.action('coupons_create', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('➕ Use o comando /novocupom para criar um cupom.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ============================================
  // AVALIAÇÕES
  // ============================================
  bot.action('admin_reviews', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const reviewStats = await reviews.getReviewStats();
      
      const message = `⭐ *AVALIAÇÕES*\n\n📊 Total: ${reviewStats.total}\n⭐ Média: ${reviewStats.averageRating} estrelas\n\n*Distribuição:*\n5⭐: ${reviewStats.distribution[5]}\n4⭐: ${reviewStats.distribution[4]}\n3⭐: ${reviewStats.distribution[3]}\n2⭐: ${reviewStats.distribution[2]}\n1⭐: ${reviewStats.distribution[1]}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Ver avaliações', 'reviews_list')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('reviews_list', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('📋 Use o comando /avaliacoes para ver todas as avaliações.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ============================================
  // BACKUP
  // ============================================
  bot.action('admin_backup', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const dbStats = await backup.getDatabaseStats();
      
      const message = `💾 *BACKUP E EXPORTAÇÕES*\n\n📊 *Registros no banco:*\n👥 Usuários: ${dbStats.users}\n📦 Produtos: ${dbStats.products}\n💳 Transações: ${dbStats.transactions}\n🎟️ Cupons: ${dbStats.coupons}\n⭐ Avaliações: ${dbStats.reviews}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 Exportar usuários', 'backup_users')],
        [Markup.button.callback('💳 Exportar vendas', 'backup_sales')],
        [Markup.button.callback('📦 Exportar produtos', 'backup_products')],
        [Markup.button.callback('📦 Backup completo', 'backup_full')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('backup_users', async (ctx) => {
    try {
      await ctx.answerCbQuery('📥 Exportando...');
      
      const csv = await backup.exportUsers();
      
      await ctx.telegram.sendDocument(ctx.chat.id, {
        source: Buffer.from(csv),
        filename: `usuarios_${new Date().toISOString().split('T')[0]}.csv`
      }, {
        caption: '👥 Usuários exportados!'
      });
      
      await adminLogs.logAction(ctx.from.id, 'exported_users');
      return ctx.answerCbQuery('✅ Exportado!');
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro ao exportar');
    }
  });
  
  bot.action('backup_sales', async (ctx) => {
    try {
      await ctx.answerCbQuery('📥 Exportando...');
      
      const csv = await backup.exportSales();
      
      await ctx.telegram.sendDocument(ctx.chat.id, {
        source: Buffer.from(csv),
        filename: `vendas_${new Date().toISOString().split('T')[0]}.csv`
      }, {
        caption: '💳 Vendas exportadas!'
      });
      
      await adminLogs.logAction(ctx.from.id, 'exported_sales');
      return ctx.answerCbQuery('✅ Exportado!');
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro ao exportar');
    }
  });
  
  bot.action('backup_products', async (ctx) => {
    try {
      await ctx.answerCbQuery('📥 Exportando...');
      
      const json = await backup.exportProducts();
      
      await ctx.telegram.sendDocument(ctx.chat.id, {
        source: Buffer.from(json),
        filename: `produtos_${new Date().toISOString().split('T')[0]}.json`
      }, {
        caption: '📦 Produtos exportados!'
      });
      
      await adminLogs.logAction(ctx.from.id, 'exported_products');
      return ctx.answerCbQuery('✅ Exportado!');
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro ao exportar');
    }
  });
  
  bot.action('backup_full', async (ctx) => {
    try {
      await ctx.answerCbQuery('📥 Gerando backup completo...');
      
      const json = await backup.generateFullBackup();
      
      await ctx.telegram.sendDocument(ctx.chat.id, {
        source: Buffer.from(json),
        filename: `backup_completo_${new Date().toISOString().split('T')[0]}.json`
      }, {
        caption: '📦 Backup completo gerado!'
      });
      
      await adminLogs.logAction(ctx.from.id, 'generated_full_backup');
      return ctx.answerCbQuery('✅ Backup gerado!');
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro ao gerar backup');
    }
  });
  
  // ============================================
  // CONFIGURAÇÕES
  // ============================================
  bot.action('admin_settings', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const maintStatus = await maintenance.getMaintenanceStatus();
      
      const message = `⚙️ *CONFIGURAÇÕES*\n\n🔧 Modo manutenção: ${maintStatus?.is_active ? '✅ Ativo' : '❌ Inativo'}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔑 Alterar PIX', 'settings_pix')],
        [Markup.button.callback('🔧 Modo manutenção', 'settings_maintenance')],
        [Markup.button.callback('📜 Ver logs', 'settings_logs')],
        [Markup.button.callback('⬅️ Voltar', 'admin_back')]
      ]);
      
      return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('settings_pix', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('🔑 Use o comando /setpix [chave] para alterar a chave PIX.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  bot.action('settings_maintenance', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('🔧 Use o comando /manutencao para gerenciar o modo manutenção.');
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  bot.action('settings_logs', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const logs = await adminLogs.getRecentLogs(10);
      
      let message = `📜 ÚLTIMOS 10 LOGS\n\n`;
      
      logs.forEach(log => {
        const date = new Date(log.created_at).toLocaleString('pt-BR');
        const admin = log.admin?.first_name || 'Sistema';
        // Substituir underscores por espaços para melhor leitura
        const actionFormatted = log.action.replace(/_/g, ' ');
        message += `${date}\n${admin}: ${actionFormatted}\n\n`;
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Voltar', 'admin_settings')]
      ]);
      
      // Removido parse_mode para evitar erro com underscores
      return ctx.editMessageText(message, keyboard);
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });

  
  // ============================================
  // COMANDOS LEGADOS (TEXTO)
  // ============================================
  
  // ===== LISTAR PRODUTOS =====
  bot.command('produtos', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const products = await db.getAllProducts(true); // incluir inativos
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto cadastrado ainda.\n\nUse /novoproduto para criar um.');
      }
      
      let message = `🛍️ PRODUTOS CADASTRADOS:\n\n`;
      
      for (const product of products) {
        const status = product.is_active ? '✅' : '❌';
        message += `${status} ${product.name}\n`;
        message += `🆔 ID: ${product.product_id}\n`;
        message += `💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}\n`;
        if (product.description) message += `📝 ${product.description}\n`;
        message += `📦 Entrega: ${product.delivery_type === 'file' ? '📄 Arquivo' : '🔗 Link'}\n`;
        if (product.delivery_url) {
          const urlPreview = product.delivery_url.length > 50 
            ? product.delivery_url.substring(0, 50) + '...' 
            : product.delivery_url;
          message += `🔗 ${urlPreview}\n`;
        } else {
          message += `🔗 Não configurada\n`;
        }
        message += `\n`;
      }
      
      message += `\nComandos:\n`;
      message += `• /novoproduto - Criar novo\n`;
      message += `• /editarproduto - Editar\n`;
      message += `• /deletarproduto - Remover`;
      
      await adminLogs.logAction(ctx.from.id, 'viewed_products');
      return ctx.reply(message);
    } catch (err) {
      console.error('Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao buscar produtos.');
    }
  });
  
  // ===== CRIAR NOVO PRODUTO (INTERATIVO) =====
  bot.command('novoproduto', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      // Iniciar sessão de criação
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'create_product',
        step: 'name',
        data: {}
      };
      
      return ctx.reply(`🎯 *CRIAR NOVO PRODUTO*

*Passo 1/4:* Digite o *nome* do produto:
Exemplo: Pack Premium, Curso Avançado, etc.

_Digite /cancelar para cancelar_`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao iniciar criação:', err);
      return ctx.reply('❌ Erro ao iniciar criação.');
    }
  });
  
  // ===== EDITAR PRODUTO =====
  bot.command('editarproduto', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto para editar.');
      }
      
      let message = `📝 EDITAR PRODUTO\n\nDigite o ID do produto que deseja editar:\n\n`;
      
      for (const product of products) {
        message += `• ${product.product_id} - ${product.name}\n`;
      }
      
      message += `\nExemplo: /edit_packA\nCancelar: /cancelar`;
      
      // Iniciar sessão
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product_select',
        step: 'select_id'
      };
      
      return ctx.reply(message);
      
    } catch (err) {
      console.error('Erro ao editar:', err);
      return ctx.reply('❌ Erro ao editar produto.');
    }
  });
  
  // Handler para /edit_[productId]
  bot.hears(/^\/edit_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId);
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'field',
        data: { productId, product }
      };
      
      return ctx.reply(`📝 EDITAR: ${product.name}

O que deseja editar?

1️⃣ /edit_name - Nome
2️⃣ /edit_price - Preço
3️⃣ /edit_description - Descrição
4️⃣ /edit_url - URL de entrega
5️⃣ /edit_status - Ativar/Desativar

Cancelar: /cancelar`);
      
    } catch (err) {
      console.error('Erro ao selecionar produto:', err);
    }
  });
  
  // ===== DELETAR PRODUTO =====
  bot.command('deletarproduto', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto para remover.');
      }
      
      let message = `🗑️ REMOVER PRODUTO\n\n⚠️ Isso desativará o produto (não deleta do banco).\n\nDigite o ID do produto:\n\n`;
      
      for (const product of products) {
        if (product.is_active) {
          message += `• ${product.product_id} - ${product.name}\n`;
        }
      }
      
      message += `\nExemplo: /delete_packA\nCancelar: /cancelar`;
      
      return ctx.reply(message);
      
    } catch (err) {
      console.error('Erro ao deletar:', err);
      return ctx.reply('❌ Erro ao remover produto.');
    }
  });
  
  // Handler para /delete_[productId]
  bot.hears(/^\/delete_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId);
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      await db.deleteProduct(productId);
      await adminLogs.logAction(ctx.from.id, 'deleted_product', productId);
      
      return ctx.reply(`✅ *Produto desativado com sucesso!*

🛍️ ${product.name}
🆔 ID: ${productId}

O produto não aparecerá mais no menu de compras.
Use /produtos para ver todos.`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
      return ctx.reply('❌ Erro ao remover produto.');
    }
  });
  
  // ===== CANCELAR OPERAÇÃO =====
  bot.command('cancelar', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Operação cancelada.');
    }
  });
  
  // ===== PENDENTES =====
  bot.command('pendentes', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const pending = await db.getPendingTransactions(10);
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!');
      }
      
      let message = `⏳ *${pending.length} TRANSAÇÕES PENDENTES:*\n\n`;
      
      for (const tx of pending) {
        message += `🆔 TXID: ${tx.txid}\n`;
        message += `👤 User: ${tx.user?.first_name || 'N/A'} (@${tx.user?.username || 'N/A'})\n`;
        message += `📦 Produto: ${tx.product?.name || tx.product_id}\n`;
        message += `💵 Valor: R$ ${tx.amount}\n`;
        message += `📅 Recebido: ${new Date(tx.proof_received_at).toLocaleString('pt-BR')}\n`;
        message += `\n/validar_${tx.txid}\n`;
        message += `——————————\n\n`;
      }
      
      await adminLogs.logAction(ctx.from.id, 'viewed_pending_transactions');
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar pendentes:', err);
      return ctx.reply('❌ Erro ao buscar pendentes.');
    }
  });
  
  // ===== VALIDAR COM PREVIEW =====
  bot.hears(/^\/validar[_\s](.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const txid = ctx.match[1].trim();
      
      const transaction = await db.getTransactionByTxid(txid);
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (transaction.status === 'delivered') {
        return ctx.reply('⚠️ Esta transação já foi entregue.');
      }
      
      const message = `📋 *VALIDAR VENDA #${txid}*\n\n👤 *Cliente:* ${transaction.user?.first_name} (@${transaction.user?.username || 'N/A'})\n📦 *Produto:* ${transaction.product?.name || transaction.product_id}\n💰 *Valor:* R$ ${transaction.amount}\n📅 *Recebido:* ${new Date(transaction.proof_received_at).toLocaleString('pt-BR')}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Validar e Entregar', `validate_${txid}`)],
        [Markup.button.callback('❌ Recusar', `reject_${txid}`)],
        [Markup.button.callback('⏸️ Aguardar', `wait_${txid}`)]
      ]);
      
      if (transaction.proof_file_id) {
        await ctx.telegram.sendPhoto(ctx.chat.id, transaction.proof_file_id, {
          caption: message,
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
      }
      
    } catch (err) {
      console.error('Erro ao validar:', err);
      return ctx.reply('❌ Erro ao validar transação.');
    }
  });
  
  // Callbacks validação
  bot.action(/validate_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✅ Validando...');
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      if (!transaction) {
        return ctx.editMessageCaption('❌ Transação não encontrada.');
      }
      const user = await db.getOrCreateUser({ id: ctx.from.id });
      await db.validateTransaction(txid, user.id);
      const product = await db.getProduct(transaction.product_id);
      if (!product) {
        return ctx.editMessageCaption(`❌ Produto não encontrado: ${transaction.product_id}`);
      }
      await deliver.deliverContent(transaction.telegram_id, product);
      await db.markAsDelivered(txid);
      await notifications.schedulePostSaleNotification(transaction.user_id, transaction.id);
      await adminLogs.logAction(ctx.from.id, 'validated_transaction', txid);
      return ctx.editMessageCaption(`✅ *Transação validada e entregue!*\n\n🆔 TXID: ${txid}\n👤 Cliente: ${transaction.user?.first_name}\n💰 Valor: R$ ${transaction.amount}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action(/reject_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Transação recusada');
      await adminLogs.logAction(ctx.from.id, 'rejected_transaction', ctx.match[1]);
      return ctx.editMessageCaption(`❌ Transação ${ctx.match[1]} recusada.`);
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  bot.action(/wait_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery('⏸️ Aguardando');
      return ctx.editMessageCaption(`⏸️ Transação ${ctx.match[1]} em espera.`);
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  // ===== STATS =====
  bot.command('stats', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      const stats = await db.getStats();
      const message = `📊 *ESTATÍSTICAS DETALHADAS*\n\n👥 *Usuários:*\nTotal: ${stats.totalUsers}\n\n💳 *Transações:*\nTotal: ${stats.totalTransactions}\n⏳ Pendentes: ${stats.pendingTransactions}\n✅ Entregues: ${stats.totalTransactions - stats.pendingTransactions}\n\n💰 *Financeiro:*\nTotal em vendas: R$ ${stats.totalSales}\nTicket médio: R$ ${stats.totalTransactions > 0 ? (parseFloat(stats.totalSales) / stats.totalTransactions).toFixed(2) : '0.00'}`;
      await adminLogs.logAction(ctx.from.id, 'viewed_stats');
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  // ===== BROADCAST =====
  bot.command('broadcast', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      const message = ctx.message.text.replace('/broadcast', '').trim();
      if (!message) return ctx.reply('❌ Uso: /broadcast [mensagem]');
      const { data: users, error } = await db.supabase.from('users').select('telegram_id').eq('is_blocked', false);
      if (error) throw error;
      let sent = 0, failed = 0;
      await ctx.reply(`📤 Enviando para ${users.length} usuários...`);
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          sent++;
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          failed++;
        }
      }
      await adminLogs.logAction(ctx.from.id, 'sent_broadcast', null, { sent, failed });
      return ctx.reply(`✅ Broadcast concluído!\n\n✔️ Enviados: ${sent}\n❌ Falharam: ${failed}`);
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  // ===== USERS =====
  bot.command('users', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      const { data: users, error } = await db.supabase.from('users').select('telegram_id, username, first_name, created_at, is_admin').order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      let message = `👥 *ÚLTIMOS 20 USUÁRIOS:*\n\n`;
      for (const user of users) {
        message += `${user.is_admin ? '🔐 ' : ''}${user.first_name}`;
        if (user.username) message += ` @${user.username}`;
        message += `\nID: ${user.telegram_id}\nDesde: ${new Date(user.created_at).toLocaleDateString('pt-BR')}\n\n`;
      }
      await adminLogs.logAction(ctx.from.id, 'viewed_users');
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  // ===== SETPIX (ADICIONAR NOVA CHAVE) =====
  bot.command('setpix', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const args = ctx.message.text.split(' ').slice(1);
      
      // Se não passou argumentos, mostrar instruções
      if (args.length === 0) {
        return ctx.reply(`❌ *Uso incorreto!*

*Formato:* \`/setpix chave\`

*Exemplos:*
• \`/setpix seu@email.com\`
• \`/setpix 11999887766\`
• \`/setpix 12345678900\`

*Tipos aceitos:*
Email, Telefone (com DDD, sem +55), CPF/CNPJ ou Chave aleatória

📋 Use \`/chavespix\` para ver todas as chaves cadastradas`, { parse_mode: 'Markdown' });
      }
      
      const novaChave = args[0].trim();
      
      // Validar formato
      if (!pixKeys.validatePixKey(novaChave)) {
        return ctx.reply('❌ *Chave PIX inválida!*\n\nVerifique o formato e tente novamente.', { parse_mode: 'Markdown' });
      }
      
      // Iniciar sessão para coletar informações
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'add_pix_key',
        step: 'owner_name',
        data: { key: novaChave }
      };
      
      const keyType = pixKeys.detectKeyType(novaChave);
      const keyTypeText = {
        'email': '📧 Email',
        'phone': '📱 Telefone',
        'cpf': '🆔 CPF',
        'cnpj': '🏢 CNPJ',
        'random': '🔐 Chave Aleatória'
      }[keyType] || 'Chave PIX';
      
      return ctx.reply(`✅ Chave válida detectada!\n\n🔑 Chave: \`${novaChave}\`\n📝 Tipo: ${keyTypeText}\n\n👤 *Agora, digite o nome do proprietário/criador:*\n(Ex: João Silva, Loja X, etc.)\n\n_Digite /cancelar para cancelar_`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro ao processar comando.');
    }
  });
  
  // ===== LISTAR CHAVES PIX =====
  bot.command('chavespix', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const keys = await pixKeys.getAllPixKeys();
      
      if (keys.length === 0) {
        return ctx.reply('🔑 *CHAVES PIX*\n\nNenhuma chave cadastrada ainda.\n\nUse `/setpix [chave]` para adicionar uma.', { parse_mode: 'Markdown' });
      }
      
      let message = `🔑 *CHAVES PIX CADASTRADAS:*\n\n`;
      
      for (const key of keys) {
        const status = key.is_active ? '✅ ATIVA' : '⚪ Inativa';
        const keyTypeIcon = {
          'email': '📧',
          'phone': '📱',
          'cpf': '🆔',
          'cnpj': '🏢',
          'random': '🔐'
        }[key.key_type] || '🔑';
        
        message += `${status}\n`;
        message += `${keyTypeIcon} \`${key.key}\`\n`;
        message += `👤 ${key.owner_name}\n`;
        if (key.description) {
          message += `📝 ${key.description}\n`;
        }
        message += `\n`;
      }
      
      message += `\n💡 *Comandos:*\n`;
      message += `• \`/setpix [chave]\` - Adicionar nova\n`;
      message += `• \`/ativarpix [chave]\` - Ativar chave\n`;
      message += `• \`/deletarpix [chave]\` - Remover chave`;
      
      await adminLogs.logAction(ctx.from.id, 'viewed_pix_keys');
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro ao listar chaves.');
    }
  });
  
  // ===== ATIVAR CHAVE PIX =====
  bot.hears(/^\/ativarpix (.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const keyValue = ctx.match[1].trim();
      const allKeys = await pixKeys.getAllPixKeys();
      const keyToActivate = allKeys.find(k => k.key === keyValue);
      
      if (!keyToActivate) {
        return ctx.reply('❌ Chave não encontrada.\n\nUse `/chavespix` para ver as chaves cadastradas.', { parse_mode: 'Markdown' });
      }
      
      if (keyToActivate.is_active) {
        return ctx.reply('⚠️ Esta chave já está ativa!');
      }
      
      const success = await pixKeys.activatePixKey(keyToActivate.id);
      
      if (success) {
        await adminLogs.logAction(ctx.from.id, 'activated_pix_key', keyValue);
        return ctx.reply(`✅ *Chave PIX ativada com sucesso!*\n\n🔑 Chave: \`${keyValue}\`\n👤 Proprietário: ${keyToActivate.owner_name}\n\nTodos os novos pagamentos usarão esta chave.`, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply('❌ Erro ao ativar chave PIX.');
      }
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro ao ativar chave.');
    }
  });
  
  // ===== DELETAR CHAVE PIX =====
  bot.hears(/^\/deletarpix (.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const keyValue = ctx.match[1].trim();
      const allKeys = await pixKeys.getAllPixKeys();
      const keyToDelete = allKeys.find(k => k.key === keyValue);
      
      if (!keyToDelete) {
        return ctx.reply('❌ Chave não encontrada.\n\nUse `/chavespix` para ver as chaves cadastradas.', { parse_mode: 'Markdown' });
      }
      
      const result = await pixKeys.deletePixKey(keyToDelete.id);
      
      if (result.success) {
        await adminLogs.logAction(ctx.from.id, 'deleted_pix_key', keyValue);
        return ctx.reply(`✅ *Chave PIX removida com sucesso!*\n\n🔑 Chave: \`${keyValue}\``, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(`❌ ${result.error || 'Erro ao remover chave PIX.'}`);
      }
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro ao remover chave.');
    }
  });
  
  // ===== CUPONS =====
  bot.command('cupons', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      const allCoupons = await coupons.getAllCoupons();
      if (allCoupons.length === 0) return ctx.reply('🎟️ Nenhum cupom. Use /novocupom');
      let message = `🎟️ *CUPONS:*\n\n`;
      for (const coupon of allCoupons) {
        const status = coupon.is_active ? '✅' : '❌';
        message += `${status} *${coupon.code}*\n💰 ${coupon.type === 'percent' ? coupon.value + '%' : 'R$ ' + coupon.value}\n📊 Usos: ${coupon.current_uses}${coupon.max_uses ? '/' + coupon.max_uses : ''}\n\n`;
      }
      await adminLogs.logAction(ctx.from.id, 'viewed_coupons');
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  bot.command('novocupom', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = { type: 'create_coupon', step: 'code', data: {} };
      return ctx.reply(`🎟️ *CRIAR CUPOM*\n\n*Passo 1/4:* Código:\n\n/cancelar para cancelar`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  // ===== AVALIAÇÕES =====
  bot.command('avaliacoes', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      const allReviews = await reviews.getAllReviews(20);
      const stats = await reviews.getReviewStats();
      let message = `⭐ *AVALIAÇÕES*\n\n📊 Total: ${stats.total}\n⭐ Média: ${stats.averageRating}\n\n`;
      if (allReviews.length === 0) {
        message += `Nenhuma avaliação.`;
      } else {
        allReviews.slice(0, 10).forEach(review => {
          message += `${'⭐'.repeat(review.rating)} ${review.user?.first_name || 'Anônimo'}\n`;
          if (review.comment) message += `💬 "${review.comment}"\n`;
          message += `\n`;
        });
      }
      await adminLogs.logAction(ctx.from.id, 'viewed_reviews');
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  // ===== MANUTENÇÃO =====
  bot.command('manutencao', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      const status = await maintenance.getMaintenanceStatus();
      let message = `🔧 *MODO MANUTENÇÃO*\n\nStatus: ${status?.is_active ? '✅ ATIVO' : '❌ INATIVO'}\n\n`;
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback(status?.is_active ? '❌ Desativar' : '✅ Ativar', status?.is_active ? 'maint_off' : 'maint_on')]]);
      return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro.');
    }
  });
  
  bot.action('maint_on', async (ctx) => {
    try {
      await ctx.answerCbQuery('✅ Ativando...');
      const user = await db.getOrCreateUser(ctx.from);
      await maintenance.enableMaintenance(user.id, '🔧 Em manutenção', [ctx.from.id.toString()]);
      await adminLogs.logAction(ctx.from.id, 'enabled_maintenance');
      return ctx.editMessageText('✅ Modo manutenção *ATIVADO*!', { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  bot.action('maint_off', async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Desativando...');
      await maintenance.disableMaintenance();
      await adminLogs.logAction(ctx.from.id, 'disabled_maintenance');
      return ctx.editMessageText('✅ Modo manutenção *DESATIVADO*!', { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  // ===== HANDLER DE MENSAGENS (SESSÕES) =====
  bot.on('text', async (ctx) => {
    try {
      if (ctx.message.text.startsWith('/')) return;
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      if (!session) return;
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      // CRIAR PRODUTO
      if (session.type === 'create_product') {
        if (session.step === 'name') {
          session.data.name = ctx.message.text.trim();
          session.step = 'price';
          return ctx.reply(`✅ Nome: *${session.data.name}*\n\n*Passo 2/4:* Preço:\n\n/cancelar`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'price') {
          const price = parseFloat(ctx.message.text.replace(',', '.'));
          if (isNaN(price) || price <= 0) return ctx.reply('❌ Preço inválido.');
          session.data.price = price;
          session.step = 'description';
          return ctx.reply(`✅ Preço: R$ ${price.toFixed(2)}\n\n*Passo 3/4:* Descrição (ou "-"):\n\n/cancelar`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'description') {
          session.data.description = ctx.message.text.trim() === '-' ? null : ctx.message.text.trim();
          session.step = 'url';
          return ctx.reply(`✅ Descrição salva!\n\n*Passo 4/4:* URL ou envie arquivo:\n\n/cancelar`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'url') {
          session.data.deliveryUrl = ctx.message.text.trim() === '-' ? null : ctx.message.text.trim();
          session.data.deliveryType = 'link';
          const productId = session.data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').substring(0, 20);
          session.data.productId = productId;
          await db.createProduct({
            productId: session.data.productId,
            name: session.data.name,
            description: session.data.description,
            price: session.data.price,
            deliveryType: session.data.deliveryType,
            deliveryUrl: session.data.deliveryUrl
          });
          delete global._SESSIONS[ctx.from.id];
          await adminLogs.logAction(ctx.from.id, 'created_product', productId);
          return ctx.reply(`🎉 *PRODUTO CRIADO!*\n\n🛍️ ${session.data.name}\n🆔 ${productId}\n💰 R$ ${session.data.price.toFixed(2)}`, { parse_mode: 'Markdown' });
        }
      }
      
      // EDITAR PRODUTO
      if (session.type === 'edit_product' && session.step === 'edit_value') {
        const { productId, field } = session.data;
        const value = ctx.message.text.trim();
        let updates = {};
        if (field === 'name') updates.name = value;
        else if (field === 'price') {
          const price = parseFloat(value.replace(',', '.'));
          if (isNaN(price) || price <= 0) return ctx.reply('❌ Preço inválido.');
          updates.price = price;
        }
        else if (field === 'description') updates.description = value === '-' ? null : value;
        else if (field === 'url') updates.delivery_url = value === '-' ? null : value;
        await db.updateProduct(productId, updates);
        delete global._SESSIONS[ctx.from.id];
        await adminLogs.logAction(ctx.from.id, 'updated_product', productId);
        return ctx.reply(`✅ Produto atualizado!`, { parse_mode: 'Markdown' });
      }
      
      // ADICIONAR CHAVE PIX
      if (session.type === 'add_pix_key') {
        if (session.step === 'owner_name') {
          session.data.ownerName = ctx.message.text.trim();
          session.step = 'description';
          return ctx.reply(`✅ Proprietário: *${session.data.ownerName}*\n\n📝 *Descrição (opcional):*\nDigite uma descrição ou "-" para pular\n(Ex: "Loja principal", "Vendas de cursos", etc.)\n\n_Digite /cancelar para cancelar_`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'description') {
          const desc = ctx.message.text.trim();
          session.data.description = desc === '-' ? null : desc;
          session.step = 'set_as_active';
          return ctx.reply(`📝 Descrição salva!\n\n⚡ *Ativar esta chave agora?*\nDigite:\n• *SIM* - Ativar imediatamente\n• *NÃO* - Manter inativa\n\n_Digite /cancelar para cancelar_`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'set_as_active') {
          const response = ctx.message.text.trim().toUpperCase();
          const setAsActive = response === 'SIM' || response === 'S';
          
          const user = await db.getOrCreateUser(ctx.from);
          const result = await pixKeys.createPixKey({
            key: session.data.key,
            ownerName: session.data.ownerName,
            description: session.data.description,
            createdBy: user.id,
            setAsActive
          });
          
          delete global._SESSIONS[ctx.from.id];
          
          if (result.success) {
            await adminLogs.logAction(ctx.from.id, 'added_pix_key', session.data.key);
            return ctx.reply(`🎉 *CHAVE PIX ADICIONADA COM SUCESSO!*\n\n🔑 Chave: \`${session.data.key}\`\n👤 Proprietário: ${session.data.ownerName}\n${session.data.description ? `📝 ${session.data.description}\n` : ''}\n${setAsActive ? '✅ Status: ATIVA' : '⚪ Status: Inativa'}\n\n💡 Use \`/chavespix\` para gerenciar as chaves.`, { parse_mode: 'Markdown' });
          } else {
            return ctx.reply(`❌ Erro ao adicionar chave PIX:\n${result.error}`);
          }
        }
      }
      
      // CRIAR CUPOM
      if (session.type === 'create_coupon') {
        if (session.step === 'code') {
          session.data.code = ctx.message.text.trim().toUpperCase();
          session.step = 'type';
          return ctx.reply(`✅ Código: ${session.data.code}\n\n*Passo 2/4:* Tipo:\n1 - Percentual (%)\n2 - Fixo (R$)\n\n/cancelar`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'type') {
          const typeChoice = ctx.message.text.trim();
          session.data.type = typeChoice === '1' ? 'percent' : 'fixed';
          session.step = 'value';
          return ctx.reply(`✅ Tipo: ${session.data.type === 'percent' ? 'Percentual' : 'Fixo'}\n\n*Passo 3/4:* Valor:\n\n/cancelar`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'value') {
          const value = parseFloat(ctx.message.text.replace(',', '.'));
          if (isNaN(value) || value <= 0) return ctx.reply('❌ Valor inválido.');
          session.data.value = value;
          session.step = 'max_uses';
          return ctx.reply(`✅ Valor: ${session.data.type === 'percent' ? value + '%' : 'R$ ' + value}\n\n*Passo 4/4:* Usos máximos (ou "-" para ilimitado):\n\n/cancelar`, { parse_mode: 'Markdown' });
        }
        if (session.step === 'max_uses') {
          const maxUses = ctx.message.text.trim() === '-' ? null : parseInt(ctx.message.text.trim());
          session.data.maxUses = maxUses;
          const user = await db.getOrCreateUser(ctx.from);
          await coupons.createCoupon({
            code: session.data.code,
            type: session.data.type,
            value: session.data.value,
            maxUses: session.data.maxUses,
            createdBy: user.id
          });
          delete global._SESSIONS[ctx.from.id];
          await adminLogs.logAction(ctx.from.id, 'created_coupon', session.data.code);
          return ctx.reply(`🎉 *CUPOM CRIADO!*\n\n🎟️ ${session.data.code}\n💰 ${session.data.type === 'percent' ? session.data.value + '%' : 'R$ ' + session.data.value}`, { parse_mode: 'Markdown' });
        }
      }
      
    } catch (err) {
      console.error('Erro no handler de texto:', err);
    }
  });
  
  // Handler de arquivos
  bot.on('document', async (ctx) => {
    try {
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      if (!session || session.type !== 'create_product' || session.step !== 'url') return;
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      const fileId = ctx.message.document.file_id;
      const fileName = ctx.message.document.file_name;
      session.data.deliveryUrl = `telegram_file:${fileId}`;
      session.data.deliveryType = 'file';
      session.data.fileName = fileName;
      const productId = session.data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').substring(0, 20);
      session.data.productId = productId;
      await db.createProduct({
        productId: session.data.productId,
        name: session.data.name,
        description: session.data.description,
        price: session.data.price,
        deliveryType: session.data.deliveryType,
        deliveryUrl: session.data.deliveryUrl
      });
      delete global._SESSIONS[ctx.from.id];
      await adminLogs.logAction(ctx.from.id, 'created_product_with_file', productId);
      return ctx.reply(`🎉 *PRODUTO CRIADO!*\n\n🛍️ ${session.data.name}\n🆔 ${productId}\n💰 R$ ${session.data.price.toFixed(2)}\n📄 ${fileName}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
      return ctx.reply('❌ Erro ao processar arquivo.');
    }
  });
  
  // Handlers para edição
  bot.command('edit_name', async (ctx) => handleEditField(ctx, 'name', 'Digite o novo nome:'));
  bot.command('edit_price', async (ctx) => handleEditField(ctx, 'price', 'Digite o novo preço:'));
  bot.command('edit_description', async (ctx) => handleEditField(ctx, 'description', 'Digite a nova descrição:'));
  bot.command('edit_url', async (ctx) => handleEditField(ctx, 'url', 'Digite a nova URL:'));
  bot.command('edit_status', async (ctx) => {
    try {
      const session = global._SESSIONS?.[ctx.from.id];
      if (!session || session.type !== 'edit_product') return;
      const { productId, product } = session.data;
      const newStatus = !product.is_active;
      await db.updateProduct(productId, { is_active: newStatus });
      delete global._SESSIONS[ctx.from.id];
      await adminLogs.logAction(ctx.from.id, 'toggled_product_status', productId);
      return ctx.reply(`✅ Produto ${newStatus ? 'ativado' : 'desativado'}!`);
    } catch (err) {
      console.error('Erro:', err);
    }
  });
  
  async function handleEditField(ctx, field, prompt) {
    try {
      const session = global._SESSIONS?.[ctx.from.id];
      if (!session || session.type !== 'edit_product') return;
      session.step = 'edit_value';
      session.data.field = field;
      return ctx.reply(`${prompt}\n\n/cancelar`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
    }
  }
}

module.exports = { registerAdminCommands };

