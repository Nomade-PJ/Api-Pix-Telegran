// src/creator.js
// Painel do Criador - Acesso limitado (não é admin completo)

const { Markup } = require('telegraf');
const db = require('./database');

function registerCreatorCommands(bot) {
  
  // ===== COMANDO /criador =====
  bot.command('criador', async (ctx) => {
    try {
      const isCreator = await db.isUserCreator(ctx.from.id);
      
      if (!isCreator) {
        return ctx.reply('❌ Acesso negado. Você não tem permissão para acessar o painel do criador.');
      }
      
      // Buscar estatísticas em tempo real
      const stats = await db.getStats();
      const pendingCount = await db.getPendingTransactions().then(txs => txs.length);
      
      const message = `👑 *PAINEL DO CRIADOR*

📊 *ESTATÍSTICAS EM TEMPO REAL*

💳 *Transações:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pendingCount}
💰 *Vendas:* R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}
✅ *Aprovadas:* ${stats.approvedTransactions || 0}
❌ *Rejeitadas:* ${stats.rejectedTransactions || 0}

📅 *Hoje:*
💰 Vendas: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}
📦 Transações: ${stats.todayTransactions || 0}

━━━━━━━━━━━━━━━━━━━━━━━━

Selecione uma opção abaixo:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Estatísticas', 'creator_stats')],
        [Markup.button.callback('👤 Usuários', 'creator_users')],
        [Markup.button.callback('📢 Broadcast', 'creator_broadcast')],
        [Markup.button.callback('⏳ Pendentes', 'creator_pending')],
        [Markup.button.callback('🔄 Atualizar', 'creator_refresh')]
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (err) {
      console.error('Erro no comando criador:', err);
      return ctx.reply('❌ Erro ao carregar painel.');
    }
  });
  
  // ===== ESTATÍSTICAS DETALHADAS =====
  bot.action('creator_stats', async (ctx) => {
    await ctx.answerCbQuery('📊 Carregando estatísticas...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const stats = await db.getStats();
      const pending = await db.getPendingTransactions();
      
      const message = `📊 *ESTATÍSTICAS DETALHADAS*

💳 *Total de Transações:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pending.length}
✅ *Aprovadas:* ${stats.approvedTransactions || 0}
❌ *Rejeitadas:* ${stats.rejectedTransactions || 0}
📦 *Entregues:* ${stats.deliveredTransactions || 0}

💰 *FINANCEIRO*
• Total Vendido: R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}
• Hoje: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}

📅 *PERÍODO*
• Transações Hoje: ${stats.todayTransactions || 0}
• Transações Últimos 7 dias: ${stats.last7DaysTransactions || 0}

⏰ *Atualizado:* ${new Date().toLocaleString('pt-BR')}`;

      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Atualizar', 'creator_stats')],
          [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas.');
    }
  });
  
  // ===== LISTAR USUÁRIOS =====
  bot.action('creator_users', async (ctx) => {
    await ctx.answerCbQuery('👤 Carregando usuários...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const users = await db.getRecentUsers(50); // Últimos 50 usuários
      
      if (users.length === 0) {
        return ctx.editMessageText('📦 Nenhum usuário encontrado.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
          ])
        });
      }
      
      let message = `👤 *USUÁRIOS* (${users.length})\n\n`;
      
      // Agrupar por página (10 por página)
      const pageSize = 10;
      const page = 0; // Sempre mostra primeira página por enquanto
      const start = page * pageSize;
      const end = start + pageSize;
      const pageUsers = users.slice(start, end);
      
      for (const user of pageUsers) {
        const name = user.first_name || user.username || 'Sem nome';
        const username = user.username ? `@${user.username}` : 'N/A';
        const date = new Date(user.created_at).toLocaleDateString('pt-BR');
        
        message += `👤 ${name}\n`;
        message += `   📱 ${username}\n`;
        message += `   🆔 ID: \`${user.telegram_id}\`\n`;
        message += `   📅 ${date}\n`;
        message += `──────────────\n\n`;
      }
      
      if (users.length > pageSize) {
        message += `\n📄 Mostrando ${start + 1}-${Math.min(end, users.length)} de ${users.length} usuários`;
      }
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Atualizar', 'creator_users')],
          [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      return ctx.reply('❌ Erro ao buscar usuários.');
    }
  });
  
  // ===== BROADCAST =====
  bot.action('creator_broadcast', async (ctx) => {
    await ctx.answerCbQuery('📢 Preparando broadcast...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    // Iniciar sessão de broadcast
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'creator_broadcast',
      step: 'message'
    };
    
    return ctx.editMessageText(`📢 *BROADCAST*

Envie a mensagem que deseja enviar para todos os usuários:

💡 *Dicas:*
• Use Markdown para formatação
• *Negrito* = \`*texto*\`
• _Itálico_ = \`_texto_\`

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
      ])
    });
  });
  
  // Handler de texto removido - integrado no admin.js para evitar conflitos
  
  // Confirmar e enviar broadcast
  bot.action('confirm_creator_broadcast', async (ctx) => {
    await ctx.answerCbQuery('📢 Enviando broadcast...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast' || session.step !== 'confirm') {
      return ctx.reply('❌ Sessão de broadcast não encontrada.');
    }
    
    try {
      const message = session.data.message;
      
      // Buscar todos os usuários
      const users = await db.getRecentUsers(10000); // Buscar muitos usuários
      
      await ctx.editMessageText(`📢 *ENVIANDO BROADCAST...*

📨 Mensagem sendo enviada para ${users.length} usuários...

⏳ Aguarde...`, {
        parse_mode: 'Markdown'
      });
      
      let success = 0;
      let failed = 0;
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, {
            parse_mode: 'Markdown'
          });
          success++;
          
          // Delay para evitar flood
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (err) {
          failed++;
          console.error(`Erro ao enviar para ${user.telegram_id}:`, err.message);
        }
      }
      
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.editMessageText(`✅ *BROADCAST CONCLUÍDO!*

✅ Enviados: ${success}
❌ Falhas: ${failed}
📊 Total: ${users.length}

━━━━━━━━━━━━━━━━━━━━━━━━

_Mensagem enviada com sucesso!_`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar ao Painel', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro no broadcast:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Erro ao enviar broadcast.');
    }
  });
  
  // Cancelar broadcast
  bot.action('cancel_creator_broadcast', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    delete global._SESSIONS[ctx.from.id];
    
    return ctx.editMessageText('❌ Broadcast cancelado.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Voltar ao Painel', 'creator_refresh')]
      ])
    });
  });
  
  // ===== PENDENTES =====
  bot.action('creator_pending', async (ctx) => {
    await ctx.answerCbQuery('⏳ Carregando pendentes...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const pending = await db.getPendingTransactions();
      
      if (pending.length === 0) {
        return ctx.editMessageText(`⏳ *TRANSAÇÕES PENDENTES*

✅ Nenhuma transação pendente no momento!

Tudo em dia! 🎉`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Atualizar', 'creator_pending')],
            [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
          ])
        });
      }
      
      let message = `⏳ *TRANSAÇÕES PENDENTES* (${pending.length})\n\n`;
      
      // Mostrar apenas primeiras 10
      const toShow = pending.slice(0, 10);
      
      for (const trans of toShow) {
        const createdAt = new Date(trans.created_at);
        const now = new Date();
        const minutesAgo = Math.floor((now - createdAt) / (1000 * 60));
        const minutesLeft = Math.max(0, 30 - minutesAgo);
        
        let productName = 'Produto não encontrado';
        if (trans.media_pack_id) {
          productName = `Media Pack: ${trans.media_pack_id}`;
        } else if (trans.product_id) {
          productName = `Produto: ${trans.product_id}`;
        } else if (trans.group_id) {
          productName = 'Renovação de Grupo';
        }
        
        const statusEmoji = trans.status === 'proof_sent' ? '📸' : '⏳';
        const statusText = trans.status === 'proof_sent' ? 'Comprovante Enviado' : 'Aguardando Pagamento';
        
        message += `${statusEmoji} *${statusText}*\n`;
        message += `💰 R$ ${parseFloat(trans.amount).toFixed(2)}\n`;
        message += `👤 ID: \`${trans.telegram_id}\`\n`;
        message += `📦 ${productName}\n`;
        message += `🆔 TXID: \`${trans.txid}\`\n`;
        message += `⏰ Expira em: ${minutesLeft} min\n`;
        message += `──────────────\n\n`;
      }
      
      if (pending.length > 10) {
        message += `\n📄 Mostrando 10 de ${pending.length} transações pendentes`;
      }
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Atualizar', 'creator_pending')],
          [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao buscar pendentes:', err);
      return ctx.reply('❌ Erro ao buscar transações pendentes.');
    }
  });
  
  // ===== ATUALIZAR PAINEL =====
  bot.action('creator_refresh', async (ctx) => {
    await ctx.answerCbQuery('🔄 Atualizando...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    // Redirecionar para o comando /criador
    return bot.handleUpdate({
      message: {
        ...ctx.message,
        text: '/criador'
      },
      from: ctx.from,
      chat: ctx.chat
    });
  });
}

module.exports = { registerCreatorCommands };

