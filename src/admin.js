// src/admin.js
const { Markup } = require('telegraf');
const db = require('./database');
const deliver = require('./deliver');

// Registrar comandos admin
function registerAdminCommands(bot) {
  
  // ===== PAINEL ADMIN (oculto) =====
  bot.command('admin', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      const stats = await db.getStats();
      
      const message = `
🔐 **PAINEL ADMINISTRATIVO**

📊 **Estatísticas:**
👥 Usuários: ${stats.totalUsers}
💳 Transações: ${stats.totalTransactions}
⏳ Pendentes: ${stats.pendingTransactions}
💰 Total em vendas: R$ ${stats.totalSales}

**Comandos Disponíveis:**
/pendentes - Ver transações pendentes
/validar [txid] - Validar e entregar
/stats - Estatísticas detalhadas
/users - Listar usuários
/broadcast [mensagem] - Enviar para todos
`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro no comando admin:', err);
      return ctx.reply('❌ Erro ao carregar painel.');
    }
  });
  
  // ===== VER PENDENTES =====
  bot.command('pendentes', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const pending = await db.getPendingTransactions(10);
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!');
      }
      
      let message = `⏳ **${pending.length} TRANSAÇÕES PENDENTES:**\n\n`;
      
      for (const tx of pending) {
        message += `🆔 TXID: \`${tx.txid}\`\n`;
        message += `👤 User: ${tx.user?.first_name || 'N/A'} (@${tx.user?.username || 'N/A'})\n`;
        message += `📦 Produto: ${tx.product?.name || tx.product_id}\n`;
        message += `💵 Valor: R$ ${tx.amount}\n`;
        message += `📅 Recebido: ${new Date(tx.proof_received_at).toLocaleString('pt-BR')}\n`;
        message += `\n/validar_${tx.txid}\n`;
        message += `—————————————————\n\n`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar pendentes:', err);
      return ctx.reply('❌ Erro ao buscar pendentes.');
    }
  });
  
  // ===== VALIDAR TRANSAÇÃO =====
  bot.hears(/^\/validar[_\s](.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const txid = ctx.match[1].trim();
      
      // Buscar transação
      const transaction = await db.getTransactionByTxid(txid);
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (transaction.status === 'delivered') {
        return ctx.reply('⚠️ Esta transação já foi entregue.');
      }
      
      // Validar transação
      const user = await db.getOrCreateUser({ id: ctx.from.id });
      await db.validateTransaction(txid, user.id);
      
      // Entregar automaticamente
      try {
        const product = await db.getProduct(transaction.product_id);
        const link = product?.delivery_url || `${process.env.DELIVERY_BASE_URL}/${transaction.product_id}`;
        
        await deliver.deliverByLink(
          transaction.telegram_id,
          link,
          `✅ **Pagamento Confirmado!**\n\nSeu acesso ao **${product?.name}** foi liberado!\n\nAcesse aqui:`
        );
        
        await db.markAsDelivered(txid);
        
        return ctx.reply(`✅ Transação validada e entregue!\n\n🆔 TXID: \`${txid}\`\n👤 Cliente: ${transaction.user?.first_name}\n💰 Valor: R$ ${transaction.amount}`, {
          parse_mode: 'Markdown'
        });
      } catch (deliverErr) {
        console.error('Erro ao entregar:', deliverErr);
        return ctx.reply(`⚠️ Transação validada, mas erro ao entregar.\nTXID: \`${txid}\`\nTente novamente ou entregue manualmente.`, {
          parse_mode: 'Markdown'
        });
      }
    } catch (err) {
      console.error('Erro ao validar:', err);
      return ctx.reply('❌ Erro ao validar transação.');
    }
  });
  
  // ===== ESTATÍSTICAS DETALHADAS =====
  bot.command('stats', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const stats = await db.getStats();
      
      const message = `
📊 **ESTATÍSTICAS DETALHADAS**

👥 **Usuários:**
Total: ${stats.totalUsers}

💳 **Transações:**
Total: ${stats.totalTransactions}
⏳ Pendentes: ${stats.pendingTransactions}
✅ Entregues: ${stats.totalTransactions - stats.pendingTransactions}

💰 **Financeiro:**
Total em vendas: R$ ${stats.totalSales}
Ticket médio: R$ ${stats.totalTransactions > 0 ? (parseFloat(stats.totalSales) / stats.totalTransactions).toFixed(2) : '0.00'}
`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
      return ctx.reply('❌ Erro ao carregar estatísticas.');
    }
  });
  
  // ===== BROADCAST (enviar para todos) =====
  bot.command('broadcast', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const message = ctx.message.text.replace('/broadcast', '').trim();
      if (!message) {
        return ctx.reply('❌ Uso: /broadcast [mensagem]');
      }
      
      // Buscar todos os usuários
      const { data: users, error } = await db.supabase
        .from('users')
        .select('telegram_id')
        .eq('is_blocked', false);
      
      if (error) throw error;
      
      let sent = 0;
      let failed = 0;
      
      await ctx.reply(`📤 Enviando para ${users.length} usuários...`);
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          sent++;
          await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit
        } catch (err) {
          failed++;
          console.error(`Erro ao enviar para ${user.telegram_id}:`, err.message);
        }
      }
      
      return ctx.reply(`✅ Broadcast concluído!\n\n✔️ Enviados: ${sent}\n❌ Falharam: ${failed}`);
    } catch (err) {
      console.error('Erro no broadcast:', err);
      return ctx.reply('❌ Erro ao enviar broadcast.');
    }
  });
  
  // ===== LISTAR USUÁRIOS =====
  bot.command('users', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const { data: users, error } = await db.supabase
        .from('users')
        .select('telegram_id, username, first_name, created_at, is_admin')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      let message = `👥 **ÚLTIMOS 20 USUÁRIOS:**\n\n`;
      
      for (const user of users) {
        message += `${user.is_admin ? '🔐 ' : ''}${user.first_name}`;
        if (user.username) message += ` @${user.username}`;
        message += `\nID: \`${user.telegram_id}\`\n`;
        message += `Desde: ${new Date(user.created_at).toLocaleDateString('pt-BR')}\n\n`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar users:', err);
      return ctx.reply('❌ Erro ao buscar usuários.');
    }
  });
}

module.exports = { registerAdminCommands };

