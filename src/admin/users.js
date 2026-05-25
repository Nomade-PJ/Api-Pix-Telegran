// src/admin/users.js
// Relatórios, busca de usuários, estatísticas
const { Markup } = require('telegraf');
const db = require('../database');
const deliver = require('../deliver');

function registerUserHandlers(bot) {
  // ===== RELATÓRIO DETALHADO DE USUÁRIOS (REGISTRAR PRIMEIRO) =====
  bot.command('relatorio_usuarios', async (ctx) => {
    console.log('🔍 [RELATORIO] Comando /relatorio_usuarios capturado');
    console.log('🔍 [RELATORIO] Usuário:', ctx.from.id, '@' + (ctx.from.username || 'sem username'));
    
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log('🔍 [RELATORIO] É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('❌ [RELATORIO] Acesso negado');
        return ctx.reply('❌ Acesso negado.');
      }
      
      console.log('⏳ [RELATORIO] Enviando mensagem de "Gerando relatório..."');
      await ctx.reply('⏳ Gerando relatório de usuários...');
      
      console.log('📊 [RELATORIO] Buscando dados do relatório...');
      const report = await db.getUserReport();
      console.log('✅ [RELATORIO] Dados obtidos:', JSON.stringify(report));
      
      let message = `📊 *RELATÓRIO DETALHADO DE USUÁRIOS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 *TOTAL DE USUÁRIOS:* ${report.totalUsers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *COMPRAS*
✅ Usuários que compraram: ${report.usersWhoBought}
📈 Taxa de conversão: ${report.buyRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔓 *USUÁRIOS DESBLOQUEADOS/LIBERADOS*
📊 Total desbloqueados: ${report.unblockedUsers}
✅ Desbloqueados que compraram: ${report.unblockedWhoBought}
❌ Desbloqueados SEM compra: ${report.unblockedWithoutPurchase}
📈 Taxa de conversão: ${report.unblockedBuyRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 *BLOQUEIOS POR DDD*
📍 Total de usuários bloqueados por DDD (tentaram acessar): ${report.usersBlockedByDDD}
   ├─ ⛔ Desbloqueados manualmente: ${report.usersWithBlockedDDDButUnlocked || 0}
   └─ 🚫 Ainda bloqueados: ${report.usersBlockedByDDD - (report.usersWithBlockedDDDButUnlocked || 0)}`;

      // Adicionar lista detalhada de usuários ainda bloqueados por DDD (limitar a 20 para não exceder limite do Telegram)
      const stillBlockedCount = report.usersBlockedByDDD - (report.usersWithBlockedDDDButUnlocked || 0);
      if (stillBlockedCount > 0 && report.usersBlockedByDDDDetails && report.usersBlockedByDDDDetails.length > 0) {
        message += `\n\n📋 *LISTA DE USUÁRIOS AINDA BLOQUEADOS POR DDD:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        const limitedList = report.usersBlockedByDDDDetails.slice(0, 20);
        
        limitedList.forEach((user, index) => {
          const name = user.name.length > 20 ? user.name.substring(0, 17) + '...' : user.name;
          message += `\n${index + 1}. ${name} | DDD: ${user.ddd} | ID: ${user.telegram_id}`;
        });
        
        if (stillBlockedCount > 20) {
          message += `\n\n... e mais ${stillBlockedCount - 20} usuário(s) ainda bloqueado(s) por DDD.`;
        }
      }

      message += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *Atualizado:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

      console.log('📤 [RELATORIO] Enviando relatório completo...');
      const result = await ctx.reply(message, { parse_mode: 'Markdown' });
      console.log('✅ [RELATORIO] Relatório enviado com sucesso');
      return result;
      
    } catch (err) {
      console.error('❌ [RELATORIO] Erro ao gerar relatório:', err);
      console.error('❌ [RELATORIO] Stack:', err.stack);
      return ctx.reply('❌ Erro ao gerar relatório. Verifique os logs.');
    }
  });
  
  // ===== FUNÇÃO PARA BUSCAR E EXIBIR INFORMAÇÕES DO USUÁRIO =====
  // Escapa caracteres especiais do Markdown v1 em valores dinâmicos
  function escMd(val) {
    if (val == null) return 'N/A';
    return String(val).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
  }

  async function buscarUsuarioInfo(ctx, telegramId) {
    try {
      // Buscar usuário
      const user = await db.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(`❌ Usuário com ID ${telegramId} não encontrado.`);
      }
      
      // Buscar transações
      const transactions = await db.getUserTransactions(telegramId, 50);
      
      // Montar mensagem — valores dinâmicos SEM parse_mode para evitar quebra
      // Usamos MarkdownV2 com escape correto em todos os campos variáveis
      const nome     = escMd(user.first_name);
      const username = user.username ? `@${escMd(user.username)}` : 'sem username';
      const bloq     = user.is_blocked ? '🚫 Sim' : '✅ Não';
      const cadData  = escMd(new Date(user.created_at).toLocaleString('pt-BR'));

      let message = `👤 *USUÁRIO ENCONTRADO:*\n\n`;
      message += `Nome: ${nome}\n`;
      message += `ID: ${telegramId}\n`;
      message += `Username: ${username}\n`;
      message += `Bloqueado: ${bloq}\n`;
      message += `Cadastrado em: ${cadData}\n`;
      
      const keyboard = [];

      if (transactions.length === 0) {
        message += `\n❌ Nenhuma transação encontrada\\.`;
      } else {
        message += `\n📊 *TRANSAÇÕES \\(${transactions.length}\\):*\n\n`;

        for (const tx of transactions.slice(0, 5)) {
          const txid   = escMd(tx.txid);
          const valor  = escMd(parseFloat(tx.amount || 0).toFixed(2));
          const status = escMd(tx.status);
          const data   = escMd(new Date(tx.created_at).toLocaleString('pt-BR'));

          message += `🆔 TXID: \`${txid}\`\n`;
          message += `💰 Valor: R$ ${valor}\n`;
          message += `📊 Status: ${status}\n`;
          message += `📅 Data: ${data}\n`;
          if (tx.proof_file_id) {
            message += `📸 Comprovante: ✅ Disponível\n`;
          }
          message += `\n`;

          keyboard.push([
            { text: `📋 Ver TXID: ${tx.txid.substring(0, 10)}...`, callback_data: `details_${tx.txid}` }
          ]);
        }

        if (transactions.length > 5) {
          message += `\n\\.\\.\\. e mais ${transactions.length - 5} transação\\(ões\\)\\.`;
        }
      }

      keyboard.push([
        { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
      ]);
      
      return ctx.reply(message, { 
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
      return ctx.reply('❌ Erro ao buscar usuário. Verifique os logs.');
    }
  }

  // ===== COMANDO PARA BUSCAR TRANSAÇÕES POR ID DE USUÁRIO =====
  bot.command('buscar_usuario', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        return ctx.reply('📋 *Como usar:*\n\n/buscar_usuario <ID_TELEGRAM>\n\nExemplo:\n/buscar_usuario 6224210204', { parse_mode: 'Markdown' });
      }
      
      const telegramId = args[1];
      return await buscarUsuarioInfo(ctx, telegramId);
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
      return ctx.reply('❌ Erro ao buscar usuário. Verifique os logs.');
    }
  });

  // ===== COMANDO DE TESTE PARA ATUALIZAR DESCRIÇÃO =====
  bot.command('teste_descricao', async (ctx) => {
    console.log('🔍 [TESTE-DESC] ========== COMANDO CAPTURADO ==========');
    console.log('🔍 [TESTE-DESC] Comando /teste_descricao recebido de:', ctx.from.id);
    console.log('🔍 [TESTE-DESC] Usuário:', ctx.from.username || 'sem username');
    try {
      console.log('🔍 [TESTE-DESC] Verificando se é admin...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log('🔍 [TESTE-DESC] É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('❌ [TESTE-DESC] Acesso negado - não é admin');
        return ctx.reply('❌ Acesso negado.');
      }

      console.log('⏳ [TESTE-DESC] Enviando mensagem de "Testando..."');
      await ctx.reply('⏳ Testando atualização da descrição...');

      console.log('📦 [TESTE-DESC] Carregando função updateBotDescription...');
      const { updateBotDescription } = require('./jobs/updateBotDescription');
      console.log('🔄 [TESTE-DESC] Executando updateBotDescription...');
      const result = await updateBotDescription();
      console.log('📊 [TESTE-DESC] Resultado:', JSON.stringify(result));

      if (result.success) {
        return ctx.reply(`✅ *Teste realizado com sucesso!*

📊 *Usuários mensais:* ${result.monthlyUsers}
📝 *Descrição atualizada:* "${result.description}"

A descrição deve aparecer no perfil do bot em alguns instantes.`, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(`❌ *Erro ao atualizar descrição*

Erro: ${result.error}

Verifique os logs do servidor para mais detalhes.`, { parse_mode: 'Markdown' });
      }
      
    } catch (err) {
      console.error('❌ [TESTE-DESC] Erro no teste de descrição:', err.message);
      console.error('❌ [TESTE-DESC] Stack:', err.stack);
      return ctx.reply(`❌ Erro: ${err.message}`);
    }
  });
  
  // ===== GERENCIAR BROADCAST COM CUPOM =====
  bot.command('broadcast_config', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      // Buscar configuração atual
      const config = await db.getSetting('broadcast_coupon_enabled');
      const isEnabled = config === 'true' || config === true;
      
      const message = `⚙️ *CONFIGURAÇÃO: BROADCAST + CUPOM*

📊 *Status atual:* ${isEnabled ? '✅ Ativado' : '❌ Desativado'}

*Como funciona:*
• Criadores podem enviar broadcasts com descontos automáticos
• Usuários que recebem o broadcast veem preço com desconto
• Novos usuários podem usar cupom manualmente
• Sistema rastreia quem recebeu broadcast

*Ações disponíveis:*`;
      
      const buttons = [
        [Markup.button.callback(
          isEnabled ? '❌ Desativar' : '✅ Ativar', 
          isEnabled ? 'toggle_broadcast_coupon:disable' : 'toggle_broadcast_coupon:enable'
        )],
        [Markup.button.callback('📋 Ver Cupons Ativos', 'view_active_coupons')],
        [Markup.button.callback('🗑️ Limpar Destinatários Antigos', 'clean_old_recipients')],
        [Markup.button.callback('🔙 Voltar', 'admin_menu')]
      ];
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro ao exibir configuração de broadcast:', err);
      return ctx.reply('❌ Erro ao carregar configurações.');
    }
  });
  
  // Toggle broadcast com cupom
  bot.action(/toggle_broadcast_coupon:(enable|disable)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const action = ctx.match[1];
      const newValue = action === 'enable' ? 'true' : 'false';
      
      // Atualizar configuração
      await db.setSetting('broadcast_coupon_enabled', newValue);
      
      const message = action === 'enable' 
        ? '✅ *Broadcast + Cupom ATIVADO!*\n\nCriadores agora podem usar essa funcionalidade.'
        : '❌ *Broadcast + Cupom DESATIVADO!*\n\nA opção não aparecerá mais no menu de broadcast.';
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_menu')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao alternar broadcast com cupom:', err);
      return ctx.reply('❌ Erro ao atualizar configuração.');
    }
  });
  
  // Ver cupons ativos
  bot.action('view_active_coupons', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const { data: coupons, error } = await db.supabase
        .from('coupons')
        .select('*, products:product_id(name), media_packs:media_pack_id(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      let message = `🎟️ *CUPONS ATIVOS*\n\n`;
      
      if (!coupons || coupons.length === 0) {
        message += `Nenhum cupom ativo no momento.\n\n`;
      } else {
        for (const coupon of coupons) {
          const productName = coupon.products?.name || coupon.media_packs?.name || 'Produto removido';
          const type = coupon.is_broadcast_coupon ? '🎁 Broadcast' : '🎟️ Manual';
          const uses = coupon.max_uses ? `${coupon.current_uses}/${coupon.max_uses}` : `${coupon.current_uses}/∞`;
          
          message += `${type} \`${coupon.code}\`\n`;
          message += `   💰 ${coupon.discount_percentage}% OFF\n`;
          message += `   📦 ${productName}\n`;
          message += `   📊 Usos: ${uses}\n\n`;
        }
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_menu')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao listar cupons:', err);
      return ctx.reply('❌ Erro ao carregar cupons.');
    }
  });
  
  // Limpar destinatários antigos (mais de 30 dias)
  bot.action('clean_old_recipients', async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Limpando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: deleted, error } = await db.supabase
        .from('broadcast_recipients')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select();
      
      if (error) throw error;
      
      const count = deleted?.length || 0;
      
      return ctx.editMessageText(`✅ *Limpeza concluída!*

🗑️ ${count} registro(s) antigo(s) removido(s).

Registros de broadcasts com mais de 30 dias foram excluídos.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_menu')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao limpar destinatários:', err);
      return ctx.reply('❌ Erro ao limpar registros.');
    }
  });
  
  // ===== PAINEL ADMIN (oculto) =====
  bot.command('admin', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('🔐 *Acesso Restrito*\n\nEste painel é exclusivo para administradores da plataforma.\n\n💬 Precisa de ajuda? Use /suporte', { parse_mode: 'Markdown' });
      }
      
      const stats = await db.getStats();
      
      const message = `🔐 *PAINEL ADMINISTRATIVO*
━━━━━━━━━━━━━━━━━━━━━

📊 *Estatísticas em Tempo Real:*
👥 Usuários: *${stats.totalUsers}*
💳 Transações: *${stats.totalTransactions}*
⏳ Pendentes: *${stats.pendingTransactions}*
💰 Vendas: *R$ ${stats.totalSales}*

Selecione uma opção abaixo:`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('⏳ Pendentes (' + stats.pendingTransactions + ')', 'admin_pendentes'),
        Markup.button.callback('📦 Entregues', 'admin_entregues')
      ],
      [
        Markup.button.callback('📊 Estatísticas', 'admin_stats')
      ],
        [
          Markup.button.callback('🛍️ Ver Produtos', 'admin_produtos')
        ],
      [
        Markup.button.callback('👥 Gerenciar Grupos', 'admin_groups'),
        Markup.button.callback('⚠️ Falhas de Entrega', 'admin_delivery_failures'),
        Markup.button.callback('🔑 Alterar PIX', 'admin_setpix')
      ],
      [
        Markup.button.callback('💳 Rotação PIX', 'admin_pix_config')
      ],
      [
        Markup.button.callback('💬 Configurar Suporte', 'admin_support')
      ],
        [
          Markup.button.callback('🎫 Tickets de Suporte', 'admin_tickets')
        ],
        [
          Markup.button.callback('⭐ Usuários Confiáveis', 'admin_trusted_users'),
          Markup.button.callback('🤖 Respostas Automáticas', 'admin_auto_responses')
        ],
        [
          Markup.button.callback('👤 Usuários', 'admin_users'),
          Markup.button.callback('🔓 Gerenciar Bloqueios', 'admin_manage_blocks')
        ],
        [
          Markup.button.callback('🏪 Controle da Loja', 'admin_shop_control')
        ],
        [
          Markup.button.callback('📂 Mais Opções', 'admin_mais_opcoes')
        ],
        [
          Markup.button.callback('🔄 Atualizar', 'admin_refresh')
        ]
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (err) {
      console.error('Erro no comando admin:', err.message);
      return ctx.reply('❌ Erro ao carregar painel.');
    }
  });
  
  // ===== VER PENDENTES =====
  bot.command('pendentes', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const pendingResult = await db.getPendingTransactions(10, 0);
      const pending = pendingResult.data || [];
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!');
      }
      
      let message = `⏳ *${pendingResult.total} TRANSAÇÕES PENDENTES* (mostrando ${pending.length}):\n\n`;
      
      for (const tx of pending) {
        message += `🆔 TXID: ${tx.txid}\n`;
        message += `👤 User: ${tx.user?.first_name || 'N/A'} (@${tx.user?.username || 'N/A'})\n`;
        message += `📦 Produto: ${tx.product?.name || tx.product_id}\n`;
        message += `💵 Valor: R$ ${tx.amount}\n`;
        message += `📅 Recebido: ${new Date(tx.proof_received_at).toLocaleString('pt-BR')}\n`;
        message += `\n/validar_${tx.txid}\n`;
        message += `——————————\n\n`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar pendentes:', err);
      return ctx.reply('❌ Erro ao buscar pendentes.');
    }
  });
  

}

module.exports = { registerUserHandlers };
