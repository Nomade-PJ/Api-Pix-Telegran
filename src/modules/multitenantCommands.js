// src/modules/multitenantCommands.js
const { Markup } = require('telegraf');
const botManager = require('./botManager');
const db = require('../database');
const adminLogs = require('./adminLogs');

/**
 * Registrar comandos multi-tenant no bot principal
 */
function registerMultitenantCommands(bot) {
  
  // ============================================
  // COMANDO: /criarbot - Iniciar registro de novo bot
  // ============================================
  bot.command('criarbot', async (ctx) => {
    try {
      // Verificar se usuário já tem bot pendente ou ativo
      const userBots = await botManager.getUserBots(ctx.from.id);
      const pendingBot = userBots.find(b => b.status === 'pending');
      
      if (pendingBot) {
        return ctx.reply(`⏳ Você já tem um bot aguardando aprovação!\n\n🤖 Bot: @${pendingBot.bot_username}\n📅 Solicitado em: ${new Date(pendingBot.created_at).toLocaleString('pt-BR')}\n\n⌛ Aguarde a aprovação do administrador.`);
      }
      
      // Iniciar sessão de registro
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'register_bot',
        step: 'token',
        data: {}
      };
      
      const message = `🤖 *CRIAR SEU BOT DE VENDAS*

Para criar seu bot, você precisa:

1️⃣ Ir ao @BotFather no Telegram
2️⃣ Enviar o comando \`/newbot\`
3️⃣ Seguir as instruções e criar seu bot
4️⃣ Copiar o TOKEN que ele vai te dar

📝 O TOKEN se parece com isto:
\`123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789\`

✅ *Depois de criar seu bot, cole o TOKEN aqui*

_Digite /cancelar para cancelar_`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro em /criarbot:', err);
      return ctx.reply('❌ Erro ao iniciar processo de criação de bot.');
    }
  });
  
  // ============================================
  // COMANDO: /meusbots - Listar bots do usuário
  // ============================================
  bot.command('meusbots', async (ctx) => {
    try {
      const userBots = await botManager.getUserBots(ctx.from.id);
      
      if (userBots.length === 0) {
        return ctx.reply(`🤖 *MEUS BOTS*\n\nVocê ainda não tem nenhum bot.\n\nUse \`/criarbot\` para criar seu primeiro bot!`, { parse_mode: 'Markdown' });
      }
      
      let message = `🤖 *MEUS BOTS*\n\n`;
      
      for (const bot of userBots) {
        const statusIcon = {
          'pending': '⏳',
          'active': '✅',
          'suspended': '⚠️',
          'rejected': '❌'
        }[bot.status] || '❓';
        
        const statusText = {
          'pending': 'Aguardando aprovação',
          'active': 'Ativo',
          'suspended': 'Suspenso',
          'rejected': 'Rejeitado'
        }[bot.status] || 'Desconhecido';
        
        message += `${statusIcon} *@${bot.bot_username}*\n`;
        message += `📊 Status: ${statusText}\n`;
        
        if (bot.status === 'active') {
          message += `💰 R$ ${bot.total_revenue || '0.00'} em vendas\n`;
          message += `🛍️ ${bot.total_sales || 0} vendas realizadas\n`;
        }
        
        if (bot.status === 'rejected' && bot.rejection_reason) {
          message += `❗ Motivo: ${bot.rejection_reason}\n`;
        }
        
        message += `\n`;
      }
      
      if (userBots.some(b => b.status === 'active')) {
        message += `💡 *Dica:* Acesse seus bots pelo @username deles para gerenciar produtos e vendas!`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro em /meusbots:', err);
      return ctx.reply('❌ Erro ao listar seus bots.');
    }
  });
  
  // ============================================
  // SUPER ADMIN: /gerenciarbots - Painel de gerenciamento
  // ============================================
  bot.command('gerenciarbots', async (ctx) => {
    try {
      const isSuperAdmin = await db.isUserSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) {
        return ctx.reply('❌ Acesso negado. Apenas super admins podem usar este comando.');
      }
      
      const stats = await botManager.getGlobalStats();
      const pendingBots = await botManager.getPendingBots();
      
      let message = `🏢 *GERENCIAR BOTS*\n\n`;
      message += `📊 *ESTATÍSTICAS GLOBAIS:*\n`;
      message += `🤖 ${stats.totalBots} bots cadastrados\n`;
      message += `✅ ${stats.activeBots} ativos\n`;
      message += `⏳ ${stats.pendingBots} aguardando aprovação\n`;
      message += `⚠️ ${stats.suspendedBots} suspensos\n\n`;
      message += `💰 R$ ${stats.totalRevenue} em vendas totais\n`;
      message += `🛍️ ${stats.totalSales} vendas realizadas\n`;
      message += `👥 ${stats.totalCustomers} clientes atendidos\n\n`;
      
      const buttons = [];
      
      if (pendingBots.length > 0) {
        buttons.push([Markup.button.callback(`⏳ Aprovar Bots (${pendingBots.length})`, 'superadmin_pending_bots')]);
      }
      
      buttons.push(
        [Markup.button.callback('📊 Ver Todos os Bots', 'superadmin_all_bots')],
        [Markup.button.callback('📈 Estatísticas Detalhadas', 'superadmin_stats')],
        [Markup.button.callback('🔄 Atualizar', 'superadmin_refresh')]
      );
      
      await adminLogs.logAction(ctx.from.id, 'super_admin_panel_accessed');
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro em /gerenciarbots:', err);
      return ctx.reply('❌ Erro ao carregar painel de gerenciamento.');
    }
  });
  
  // ============================================
  // CALLBACKS: Gerenciamento de bots
  // ============================================
  
  // Ver bots pendentes
  bot.action('superadmin_pending_bots', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const isSuperAdmin = await db.isUserSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return ctx.answerCbQuery('❌ Acesso negado');
      
      const pendingBots = await botManager.getPendingBots();
      
      if (pendingBots.length === 0) {
        return ctx.editMessageText('⏳ *BOTS PENDENTES*\n\nNenhum bot aguardando aprovação.', {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'superadmin_back')]])
        });
      }
      
      let message = `⏳ *BOTS PENDENTES DE APROVAÇÃO*\n\n`;
      
      for (const bot of pendingBots.slice(0, 5)) { // Mostrar apenas os 5 primeiros
        message += `🤖 *@${bot.bot_username}*\n`;
        message += `👤 Criador: ${bot.owner?.first_name || 'N/A'}`;
        if (bot.owner?.username) message += ` (@${bot.owner.username})`;
        message += `\n`;
        message += `🔑 PIX: \`${bot.pix_key}\`\n`;
        message += `📅 ${new Date(bot.created_at).toLocaleString('pt-BR')}\n\n`;
      }
      
      if (pendingBots.length > 5) {
        message += `_... e mais ${pendingBots.length - 5} bot(s)_\n\n`;
      }
      
      const buttons = pendingBots.slice(0, 10).map(bot => [
        Markup.button.callback(`✅ Aprovar @${bot.bot_username}`, `approve_bot_${bot.id}`),
        Markup.button.callback('❌ Rejeitar', `reject_bot_${bot.id}`)
      ]);
      
      buttons.push([Markup.button.callback('⬅️ Voltar', 'superadmin_back')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro em superadmin_pending_bots:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  // Aprovar bot
  bot.action(/approve_bot_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Aprovando bot...');
      
      const isSuperAdmin = await db.isUserSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return ctx.answerCbQuery('❌ Acesso negado');
      
      const botInstanceId = ctx.match[1];
      const result = await botManager.approveBot(botInstanceId, ctx.from.id);
      
      if (!result.success) {
        await ctx.answerCbQuery(`❌ ${result.error}`);
        return;
      }
      
      await adminLogs.logAction(ctx.from.id, 'approved_bot', result.data.bot_username);
      
      // Notificar o criador
      try {
        await ctx.telegram.sendMessage(
          result.data.owner_telegram_id,
          `🎉 *BOT APROVADO!*\n\n✅ Seu bot @${result.data.bot_username} foi aprovado e está ativo!\n\nAgora você pode:\n1️⃣ Acessar @${result.data.bot_username}\n2️⃣ Adicionar seus produtos\n3️⃣ Começar a vender!\n\n💡 *Dica:* Use o comando \`/admin\` no seu bot para gerenciá-lo.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyErr) {
        console.error('Erro ao notificar criador:', notifyErr);
      }
      
      await ctx.answerCbQuery('✅ Bot aprovado!');
      
      // Atualizar lista
      return ctx.scene.reenter();
      
    } catch (err) {
      console.error('Erro ao aprovar bot:', err);
      return ctx.answerCbQuery('❌ Erro ao aprovar bot');
    }
  });
  
  // Rejeitar bot
  bot.action(/reject_bot_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const isSuperAdmin = await db.isUserSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return ctx.answerCbQuery('❌ Acesso negado');
      
      const botInstanceId = ctx.match[1];
      
      // Iniciar sessão para pedir motivo
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'reject_bot',
        botInstanceId,
        step: 'reason'
      };
      
      return ctx.reply('❌ Digite o motivo da rejeição:\n\n_Digite /cancelar para cancelar_');
      
    } catch (err) {
      console.error('Erro ao rejeitar bot:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  // Ver todos os bots
  bot.action('superadmin_all_bots', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const isSuperAdmin = await db.isUserSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return ctx.answerCbQuery('❌ Acesso negado');
      
      const allBots = await botManager.getAllActiveBots();
      
      if (allBots.length === 0) {
        return ctx.editMessageText('🤖 *TODOS OS BOTS*\n\nNenhum bot ativo ainda.', {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'superadmin_back')]])
        });
      }
      
      let message = `🤖 *TODOS OS BOTS ATIVOS* (${allBots.length})\n\n`;
      
      for (const bot of allBots.slice(0, 10)) {
        message += `✅ *@${bot.bot_username}*\n`;
        message += `👤 ${bot.owner?.first_name || 'N/A'}\n`;
        message += `💰 R$ ${bot.total_revenue || '0.00'} | 🛍️ ${bot.total_sales || 0} vendas\n\n`;
      }
      
      if (allBots.length > 10) {
        message += `_... e mais ${allBots.length - 10} bot(s)_`;
      }
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'superadmin_back')]])
      });
      
    } catch (err) {
      console.error('Erro em superadmin_all_bots:', err);
      return ctx.answerCbQuery('❌ Erro');
    }
  });
  
  // Voltar ao painel
  bot.action('superadmin_back', async (ctx) => {
    try {
      return ctx.scene.reenter();
    } catch (err) {
      // Se não tiver scene, recarregar comando
      return bot.handleUpdate({
        message: {
          text: '/gerenciarbots',
          from: ctx.from,
          chat: ctx.chat
        }
      });
    }
  });
  
  // Refresh
  bot.action('superadmin_refresh', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Atualizando...');
      return bot.handleUpdate({
        message: {
          text: '/gerenciarbots',
          from: ctx.from,
          chat: ctx.chat
        }
      });
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao atualizar');
    }
  });
  
}

module.exports = {
  registerMultitenantCommands
};

