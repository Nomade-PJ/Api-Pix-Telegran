// src/admin/panel.js
// Painel admin, busca, ações, entrega manual, suporte
const { Markup } = require('telegraf');
const db = require('../database');
const deliver = require('../deliver');

function registerPanelHandlers(bot) {
  // ===== HANDLERS DOS BOTÕES DO PAINEL ADMIN =====
  
  bot.action('admin_refresh', async (ctx) => {
    await ctx.answerCbQuery('🔄 Atualizando...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
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
    
    try {
      return await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [ADMIN-REFRESH] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });

  // ===== BUSCAR USUÁRIO =====
  // ── Mais Opções — submenu com as 4 funções agrupadas ────────────────
  bot.action('admin_mais_opcoes', async (ctx) => {
    try {
      await ctx.answerCbQuery('📂 Mais Opções...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      return ctx.reply(
        '📂 *MAIS OPÇÕES*\n\nSelecione uma função:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 Buscar Usuário',    callback_data: 'admin_buscar_usuario'    }],
              [{ text: '🕵️ Rastrear Cliente',  callback_data: 'admin_rastrear_cliente'  }],
              [{ text: '🔄 Entregar por TXID', callback_data: 'admin_entregar_txid'     }],
              [{ text: '🗑️ Revogar Conteúdo',  callback_data: 'admin_revogar_conteudo'  }],
              [{ text: '🔙 Voltar ao Painel',  callback_data: 'admin_refresh'           }]
            ]
          }
        }
      );
    } catch (err) {
      console.error('❌ [MAIS-OPCOES]', err.message);
    }
  });

  bot.action('admin_buscar_usuario', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔍 Buscando usuário...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      // Criar sessão para pedir o ID
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'buscar_usuario',
        step: 'waiting_id'
      };
      
      return ctx.reply('🔍 *BUSCAR USUÁRIO*\n\nDigite o *ID do Telegram* do usuário que deseja buscar:\n\nExemplo: `6224210204`', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancelar', callback_data: 'cancel_buscar_usuario' }
          ]]
        }
      });
    } catch (err) {
      console.error('Erro ao iniciar busca de usuário:', err);
      return ctx.reply('❌ Erro ao iniciar busca. Verifique os logs.');
    }
  });

  // ===== CANCELAR BUSCA DE USUÁRIO =====
  bot.action('cancel_buscar_usuario', async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Cancelado');
      global._SESSIONS = global._SESSIONS || {};
      if (global._SESSIONS[ctx.from.id]) {
        delete global._SESSIONS[ctx.from.id];
      }
      return ctx.reply('❌ Busca cancelada.');
    } catch (err) {
      console.error('Erro ao cancelar busca:', err);
    }
  });


  // ═══════════════════════════════════════════════════════════
  // 🕵️ RASTREAR CLIENTE — busca por ID ou código Pix (TXT)
  // ═══════════════════════════════════════════════════════════

  // Escapa caracteres especiais do MarkdownV2
  function escV2(val) {
    if (val == null) return 'N/A';
    return String(val).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
  }

  // Renderiza o card do cliente rastreado
  async function renderClienteRastreado(ctx, user, tx, origem) {
    try {
      const ddd = db.extractAreaCode(user.phone_number);
      let dddStatus = '📵 Sem telefone';
      if (ddd) {
        const bloqueado = await db.isAreaCodeBlocked(ddd);
        dddStatus = bloqueado ? '🚫 DDD Bloqueado' : '✅ DDD Liberado';
      }

      // Escapa apenas os caracteres que Markdown v1 interpreta: _ * ` [
      function esc(val) {
        if (val == null) return 'N/A';
        return String(val)
          .replace(/\\/g, '\\\\')
          .replace(/\*/g, '\\*')
          .replace(/_/g, '\\_')
          .replace(/`/g, '\\`')
          .replace(/\[/g, '\\[');
      }

      const nome      = esc(user.first_name || 'Usuário');
      const telefone  = user.phone_number || 'Não informado';
      const usernameStr = user.username ? '@' + esc(user.username) : 'sem username';
      const bloqLabel = user.is_blocked ? '🚫 Bloqueado' : '✅ Ativo';
      const dddStr    = ddd || '—';

      const hasUsername = !!user.username;
      const chatLink = hasUsername ? 'https://t.me/' + user.username : null;

      const txList = await db.getUserTransactions(user.telegram_id, 100);
      const totalGasto = txList
        .filter(t => t.status === 'delivered')
        .reduce((a, t) => a + parseFloat(t.amount || 0), 0);
      const totalTx = txList.length;

      let msg = '🕵️ *RASTREAR CLIENTE*\n\n';
      msg += '👤 *' + nome + '* — ' + bloqLabel + '\n';
      msg += '🆔 ID: `' + user.telegram_id + '`\n';
      msg += '📱 Username: ' + usernameStr + '\n';
      msg += '📞 Telefone: ' + telefone + '\n';
      msg += '📍 DDD: *' + dddStr + '* — ' + dddStatus + '\n';
      msg += '💰 Total gasto: *R$ ' + totalGasto.toFixed(2) + '*\n';
      msg += '📊 Transações: ' + totalTx + '\n';

      if (!hasUsername) {
        msg += '\n💬 *Para abrir conversa:*\n';
        msg += 'Pesquise o ID `' + user.telegram_id + '` no Telegram\n';
      }

      if (tx) {
        const txLabel = origem === 'pix' ? 'Transação encontrada:' : 'Última transação:';
        msg += '\n📋 *' + txLabel + '*\n';
        msg += '🆔 TXID: `' + esc(tx.txid) + '`\n';
        msg += '💵 Valor: R$ ' + parseFloat(tx.amount || 0).toFixed(2) + '\n';
        msg += '📊 Status: ' + esc(tx.status) + '\n';
        msg += '📅 Data: ' + new Date(tx.created_at).toLocaleString('pt-BR') + '\n';
      }

      const keyboard = [];
      if (hasUsername) {
        keyboard.push([{ text: '💬 Abrir Conversa', url: chatLink }]);
      }
      keyboard.push([
        { text: '📋 Copiar ID', callback_data: 'copiar_id_' + user.telegram_id },
        { text: '📞 Copiar Telefone', callback_data: 'copiar_tel_' + user.telegram_id }
      ]);
      keyboard.push([{ text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }]);

      return ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('❌ [RASTREAR] Erro ao renderizar:', err.message);
      return ctx.reply('❌ Erro ao exibir dados do cliente. Tente novamente.');
    }
  }

  // Bot\u00e3o principal \u2014 abre submenu
  bot.action('admin_rastrear_cliente', async (ctx) => {
    try {
      await ctx.answerCbQuery('\u{1F575}\ufe0f Rastrear Cliente...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      return ctx.reply(
        '\u{1F575}\ufe0f *RASTREAR CLIENTE*\n\nEscolha como deseja buscar o cliente:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '\u{1F194} Buscar por ID do Telegram', callback_data: 'rastrear_por_id' }],
              [{ text: '\u{1F4B3} Buscar por C\u00f3digo Pix (TXT)', callback_data: 'rastrear_por_pix' }],
              [{ text: '\u274c Cancelar', callback_data: 'admin_refresh' }]
            ]
          }
        }
      );
    } catch (err) {
      console.error('\u274c [RASTREAR] Erro:', err.message);
      return ctx.reply('\u274c Erro ao abrir rastreio.');
    }
  });

  // Op\u00e7\u00e3o 1 \u2014 aguardar ID
  bot.action('rastrear_por_id', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = { type: 'rastrear_cliente', step: 'aguardando_id' };

      return ctx.reply(
        '\u{1F194} *RASTREAR POR ID*\n\nDigite o *ID do Telegram* do cliente:\n\nEx: `6880815060`',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '\u274c Cancelar', callback_data: 'cancelar_rastrear' }]] }
        }
      );
    } catch (err) {
      console.error('\u274c [RASTREAR] Erro:', err.message);
    }
  });

  // Op\u00e7\u00e3o 2 \u2014 aguardar c\u00f3digo Pix
  bot.action('rastrear_por_pix', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = { type: 'rastrear_cliente', step: 'aguardando_pix' };

      return ctx.reply(
        '\u{1F4B3} *RASTREAR POR C\u00d3DIGO PIX*\n\nCole o c\u00f3digo *copia e cola* do Pix recebido:',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '\u274c Cancelar', callback_data: 'cancelar_rastrear' }]] }
        }
      );
    } catch (err) {
      console.error('\u274c [RASTREAR] Erro:', err.message);
    }
  });

  // Cancelar rastreio
  bot.action('cancelar_rastrear', async (ctx) => {
    try {
      await ctx.answerCbQuery('\u274c Cancelado');
      global._SESSIONS = global._SESSIONS || {};
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('\u274c Rastreio cancelado.');
    } catch (err) {
      console.error('\u274c [RASTREAR] Erro ao cancelar:', err.message);
    }
  });

  // Copiar ID \u2014 exibe em alerta pop-up no Telegram
  bot.action(/^copiar_id_(\d+)$/, async (ctx) => {
    try {
      const tid = ctx.match[1];
      await ctx.answerCbQuery('ID: ' + tid, { show_alert: true });
    } catch (err) { /* silencioso */ }
  });

  // Copiar Telefone \u2014 exibe em alerta pop-up no Telegram
  bot.action(/^copiar_tel_(\d+)$/, async (ctx) => {
    try {
      const tid = ctx.match[1];
      const user = await db.getUserByTelegramId(parseInt(tid));
      const tel = (user && user.phone_number) ? user.phone_number : 'N\u00e3o informado';
      await ctx.answerCbQuery('Tel: ' + tel, { show_alert: true });
    } catch (err) { /* silencioso */ }
  });

    // ═══════════════════════════════════════════════════════════
  // 🏪 CONTROLE DA LOJA (admin_shop_control)
  // ═══════════════════════════════════════════════════════════

  async function renderShopControl(ctx, editMsg = false) {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const shopSetting = await db.getSetting('shop_enabled');
      const isOpen = shopSetting !== 'false'; // default true se não configurado

      const statusEmoji = isOpen ? '🟢' : '🔴';
      const statusLabel = isOpen ? 'ABERTA' : 'FECHADA';
      const toggleLabel = isOpen ? '🔒 Fechar Loja' : '🟢 Abrir Loja';
      const toggleAction = isOpen ? 'shop_set_closed' : 'shop_set_open';

      const msg =
        '🏪 *CONTROLE DA LOJA*\n\n' +
        'Status atual: ' + statusEmoji + ' *Loja ' + statusLabel + '*\n\n' +
        (isOpen
          ? '✅ Clientes podem ver e comprar produtos normalmente\.'
          : '⛔ Loja fechada\. Nenhum cliente consegue comprar\.');

      const keyboard = {
        inline_keyboard: [
          [{ text: toggleLabel, callback_data: toggleAction }],
          [{ text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }]
        ]
      };

      if (editMsg) {
        return ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } catch (err) {
      console.error('❌ [SHOP-CONTROL] Erro:', err.message);
      return ctx.reply('❌ Erro ao carregar controle da loja.');
    }
  }

  bot.action('admin_shop_control', async (ctx) => {
    try {
      await ctx.answerCbQuery('🏪 Controle da Loja...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      return renderShopControl(ctx, false);
    } catch (err) {
      console.error('❌ [SHOP-CONTROL] Erro:', err.message);
    }
  });

  bot.action('shop_set_open', async (ctx) => {
    try {
      await ctx.answerCbQuery('🟢 Abrindo loja...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      await db.setSetting('shop_enabled', 'true');
      console.log('[SHOP] Loja ABERTA por admin:', ctx.from.id);
      return renderShopControl(ctx, true);
    } catch (err) {
      console.error('❌ [SHOP-CONTROL] Erro ao abrir loja:', err.message);
      return ctx.reply('❌ Erro ao abrir loja.');
    }
  });

  bot.action('shop_set_closed', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔒 Fechando loja...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      await db.setSetting('shop_enabled', 'false');
      console.log('[SHOP] Loja FECHADA por admin:', ctx.from.id);
      return renderShopControl(ctx, true);
    } catch (err) {
      console.error('❌ [SHOP-CONTROL] Erro ao fechar loja:', err.message);
      return ctx.reply('❌ Erro ao fechar loja.');
    }
  });

  
  // ═══════════════════════════════════════════════════════════════
  // 🗑️ REVOGAR CONTEÚDO — replica o script deletar_midias.js
  // ═══════════════════════════════════════════════════════════════

  // Deletar mensagem no Telegram via API direta
  async function deletarMensagemTelegram(telegram, chatId, messageId) {
    try {
      await telegram.deleteMessage(chatId, messageId);
      return { ok: true, erro: null };
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('message to delete not found') || msg.includes('MESSAGE_ID_INVALID') || msg.includes('message can\'t be deleted')) {
        return { ok: true, jaApagada: true, erro: null }; // já apagada — marcar mesmo assim
      }
      return { ok: false, erro: msg };
    }
  }

  // Buscar mensagens do usuário na tabela messages_sent
  async function buscarMensagensRevogar(telegramId, packId = null) {
    let query = db.supabase
      .from('messages_sent')
      .select('id, message_id, pack_id, product_tag, media_type, created_at')
      .eq('telegram_id', telegramId)
      .eq('deleted', false)
      .order('created_at', { ascending: true });
    if (packId) query = query.eq('pack_id', packId);
    const { data, error } = await query;
    if (error) throw new Error('Erro ao buscar mensagens: ' + error.message);
    return data || [];
  }

  // Marcar como deletado no banco
  async function marcarDeletadoRevogar(ids) {
    const { error } = await db.supabase
      .from('messages_sent')
      .update({ deleted: true, deleted_at: new Date().toISOString() })
      .in('id', ids);
    if (error) console.error('⚠️ [REVOGAR] Erro ao atualizar banco:', error.message);
  }

  // Listar packs únicos do usuário
  async function listarPacksRevogar(telegramId) {
    const { data, error } = await db.supabase
      .from('messages_sent')
      .select('pack_id, product_tag')
      .eq('telegram_id', telegramId)
      .eq('deleted', false);
    if (error) throw new Error(error.message);
    const unicos = [...new Set((data || []).map(r => r.pack_id || r.product_tag).filter(Boolean))];
    return unicos;
  }

  // ── Botão principal: abre painel de revogar ──────────────────
  bot.action('admin_revogar_conteudo', async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Revogar Conteúdo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      return ctx.reply(
        '🗑️ *REVOGAR CONTEÚDO*\n\n' +
        'Esta função apaga mídias enviadas pelo bot no chat do usuário.\n\n' +
        '⚠️ A ação é *irreversível* no Telegram.\n\n' +
        'Digite o *Telegram ID* do usuário:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'cancelar_revogar' }]]
          }
        }
      );

      // Setar sessão para aguardar o ID
    } catch (err) {
      console.error('❌ [REVOGAR]', err.message);
    } finally {
      // Setar sessão SEMPRE após o reply (fora do try/catch principal)
      try {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (isAdmin) {
          global._SESSIONS = global._SESSIONS || {};
          global._SESSIONS[ctx.from.id] = { type: 'revogar_conteudo', step: 'aguardando_id' };
        }
      } catch (_) {}
    }
  });

  // ── Cancelar revogar ──────────────────────────────────────────
  bot.action('cancelar_revogar', async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Cancelado');
      global._SESSIONS = global._SESSIONS || {};
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Operação cancelada.');
    } catch (err) { /* silencioso */ }
  });

  // ── Revogar TUDO do usuário ───────────────────────────────────
  bot.action(/^revogar_tudo_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Iniciando revogação...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const telegramId = parseInt(ctx.match[1]);
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'revogar_executando',
        telegramId,
        modo: 'tudo'
      };

      const mensagens = await buscarMensagensRevogar(telegramId);
      if (mensagens.length === 0) {
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('📭 Nenhuma mensagem rastreada encontrada para este usuário.');
      }

      await ctx.reply(
        `⚠️ *CONFIRMAÇÃO FINAL*

` +
        `🆔 Usuário: \`${telegramId}\`
` +
        `📋 Escopo: *TODAS as mídias* (${mensagens.length} mensagens)

` +
        `Esta ação é *irreversível* no Telegram.

` +
        `Confirmar?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ SIM, Revogar Tudo', callback_data: `revogar_confirmar_${telegramId}_tudo` },
                { text: '❌ Cancelar', callback_data: 'cancelar_revogar' }
              ]
            ]
          }
        }
      );
    } catch (err) {
      console.error('❌ [REVOGAR]', err.message);
      return ctx.reply('❌ Erro ao preparar revogação.');
    }
  });

  // ── Revogar pack específico ───────────────────────────────────
  bot.action(/^revogar_pack_(.+)__(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('📦 Pack selecionado...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const telegramId = parseInt(ctx.match[1]);
      const packId = ctx.match[2];

      const mensagens = await buscarMensagensRevogar(telegramId, packId);

      await ctx.reply(
        `⚠️ *CONFIRMAÇÃO FINAL*

` +
        `🆔 Usuário: \`${telegramId}\`
` +
        `📦 Pack: *${packId}* (${mensagens.length} mensagens)

` +
        `Esta ação é *irreversível* no Telegram.

` +
        `Confirmar?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ SIM, Revogar Pack', callback_data: `revogar_confirmar_${telegramId}_${packId}` },
                { text: '❌ Cancelar', callback_data: 'cancelar_revogar' }
              ]
            ]
          }
        }
      );
    } catch (err) {
      console.error('❌ [REVOGAR]', err.message);
      return ctx.reply('❌ Erro ao preparar revogação do pack.');
    }
  });

  // ── Executar revogação após confirmação ───────────────────────
  bot.action(/^revogar_confirmar_(\d+)_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('⚙️ Executando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const telegramId = parseInt(ctx.match[1]);
      const escopo = ctx.match[2]; // 'tudo' ou nome do pack

      const mensagens = escopo === 'tudo'
        ? await buscarMensagensRevogar(telegramId)
        : await buscarMensagensRevogar(telegramId, escopo);

      if (mensagens.length === 0) {
        return ctx.reply('📭 Nenhuma mensagem encontrada para revogar.');
      }

      await ctx.reply(`⚙️ *Iniciando revogação de ${mensagens.length} mensagem(ns)...*`, { parse_mode: 'Markdown' });

      let deletadas = 0;
      let jaApagadas = 0;
      let erros = 0;
      const idsParaMarcar = [];

      for (let i = 0; i < mensagens.length; i++) {
        const msg = mensagens[i];
        const result = await deletarMensagemTelegram(ctx.telegram, telegramId, msg.message_id);

        if (result.ok) {
          if (result.jaApagada) jaApagadas++;
          else deletadas++;
          idsParaMarcar.push(msg.id);
        } else {
          erros++;
          console.error(`❌ [REVOGAR] msg_id:${msg.message_id} — ${result.erro}`);
        }

        // Delay anti rate-limit
        if (i < mensagens.length - 1) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      // Marcar no banco em lote
      if (idsParaMarcar.length > 0) {
        await marcarDeletadoRevogar(idsParaMarcar);
      }

      // Limpar sessão
      global._SESSIONS = global._SESSIONS || {};
      delete global._SESSIONS[ctx.from.id];

      // Relatório final
      // Escapar _ e * em valores dinâmicos para não quebrar Markdown v1
      function escMd(v) { return String(v).replace(/[_*`[]/g, '\\$&'); }
      const escopoLabel = escopo === 'tudo' ? 'TODAS as mídias' : 'Pack: ' + escMd(escopo);
      await ctx.reply(
        '✅ *REVOGAÇÃO CONCLUÍDA*\n\n' +
        '🆔 Usuário: `' + telegramId + '`\n' +
        '📋 Escopo: ' + escopoLabel + '\n\n' +
        '✅ Deletadas: *' + deletadas + '*\n' +
        '⏭️ Já apagadas: *' + jaApagadas + '*\n' +
        '❌ Erros: *' + erros + '*\n' +
        '📊 Total: *' + mensagens.length + '*\n\n' +
        '🗄️ Banco atualizado — marcado como deleted = true',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🚫 Bloquear Usuário', callback_data: `bloquear_usuario_${telegramId}` },
                { text: '🔙 Painel', callback_data: 'admin_refresh' }
              ]
            ]
          }
        }
      );
    } catch (err) {
      console.error('❌ [REVOGAR] Erro na execução:', err.message);
      return ctx.reply('❌ Erro ao executar revogação: ' + err.message);
    }
  });

  // ── Bloquear usuário após revogar ─────────────────────────────
  bot.action(/^bloquear_usuario_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🚫 Bloqueando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const telegramId = parseInt(ctx.match[1]);
      const { error } = await db.supabase
        .from('users')
        .update({ is_blocked: true, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);

      if (error) {
        return ctx.reply('❌ Erro ao bloquear: ' + error.message);
      }

      return ctx.reply(
        `🔴 *Usuário \`${telegramId}\` bloqueado com sucesso!*

Ele não conseguirá mais acessar o bot.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Painel', callback_data: 'admin_refresh' }]] } }
      );
    } catch (err) {
      console.error('❌ [REVOGAR]', err.message);
    }
  });

  
  // ===== ACTIONS DO PAINEL ADMIN =====
  
  bot.action('admin_pendentes', async (ctx) => {
    await ctx.answerCbQuery('⏳ Carregando pendentes...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const pendingResult = await db.getPendingTransactions(10, 0);
      const pending = pendingResult.data || [];
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!', {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
            ]]
          }
        });
      }
      
      let message = `⏳ *${pendingResult.total} TRANSAÇÕES PENDENTES* (mostrando ${pending.length}):\n\n`;
      
      const keyboard = [];
      
      for (const tx of pending) {
        message += `🆔 TXID: \`${tx.txid}\`\n`;
        message += `👤 User: ${tx.user?.first_name || 'N/A'} (@${tx.user?.username || 'N/A'})\n`;
        message += `📦 Produto: ${tx.product?.name || tx.product_id}\n`;
        message += `💵 Valor: R$ ${tx.amount}\n`;
        message += `📅 Recebido: ${new Date(tx.proof_received_at).toLocaleString('pt-BR')}\n\n`;
        
        // Adicionar botões para cada transação
        keyboard.push([
          { text: `📋 Ver Detalhes - ${tx.txid.substring(0, 10)}...`, callback_data: `details_${tx.txid}` }
        ]);
        
        message += `——————————\n\n`;
      }
      
      keyboard.push([
        { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
      ]);
      
      return ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('Erro ao listar pendentes:', err);
      return ctx.reply('❌ Erro ao buscar pendentes.');
    }
  });
  
  // ===== ENTREGAR POR ID DO USUÁRIO =====
  bot.action('admin_entregar_txid', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Preparando entrega...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      // Criar sessão para pedir o ID do usuário
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'entregar_txid',
        step: 'waiting_user_id'
      };
      
      return ctx.reply('🔄 *ENTREGA MANUAL*\n\nDigite o *ID do usuário* (Telegram ID) para quem deseja entregar:\n\nExemplo: `6224210204`\n\n⚠️ *Atenção:* Após informar o ID, você selecionará o produto/grupo a ser entregue.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancelar', callback_data: 'cancel_entregar_txid' }
          ]]
        }
      });
    } catch (err) {
      console.error('Erro ao iniciar entrega manual:', err);
      return ctx.reply('❌ Erro ao iniciar entrega. Verifique os logs.');
    }
  });
  
  // Cancelar entrega por TXID
  bot.action('cancel_entregar_txid', async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Cancelado');
      global._SESSIONS = global._SESSIONS || {};
      if (global._SESSIONS[ctx.from.id]) {
        delete global._SESSIONS[ctx.from.id];
      }
      return ctx.reply('❌ Operação cancelada.', {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
    } catch (err) {
      console.error('Erro ao cancelar entrega:', err);
    }
  });

  // ===== VER TRANSAÇÕES ENTREGUES/VALIDADAS =====
  bot.action('admin_entregues', async (ctx) => {
    await ctx.answerCbQuery('📦 Carregando entregues...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      // Buscar transações entregues ou validadas recentes
      const { data: transactions, error } = await db.supabase
        .from('transactions')
        .select('*')
        .in('status', ['validated', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      if (!transactions || transactions.length === 0) {
        return ctx.reply('✅ Nenhuma transação entregue ou validada encontrada!', {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
            ]]
          }
        });
      }
      
      // Buscar informações adicionais para cada transação
      for (const tx of transactions) {
        // Buscar usuário
        if (tx.user_id) {
          const { data: userData } = await db.supabase
            .from('users')
            .select('telegram_id, username, first_name')
            .eq('id', tx.user_id)
            .single();
          
          if (userData) {
            tx.user = userData;
          }
        }
        
        // Buscar produto OU media pack
        if (tx.product_id) {
          const { data: productData } = await db.supabase
            .from('products')
            .select('name')
            .eq('product_id', tx.product_id)
            .single();
          
          if (productData) {
            tx.product = productData;
          }
        } else if (tx.media_pack_id) {
          const { data: packData } = await db.supabase
            .from('media_packs')
            .select('name')
            .eq('pack_id', tx.media_pack_id)
            .single();
          
          if (packData) {
            tx.media_pack = packData;
          }
        }
      }
      
      let message = `📦 *TRANSAÇÕES ENTREGUES/VALIDADAS* (últimas ${transactions.length}):\n\n`;
      
      const keyboard = [];
      
      for (const tx of transactions) {
        const productName = tx.product?.name || tx.media_pack?.name || tx.product_id || tx.media_pack_id || 'N/A';
        const userName = tx.user?.first_name || 'N/A';
        const userUsername = tx.user?.username || 'N/A';
        const statusEmoji = tx.status === 'delivered' ? '✅' : '⏳';
        
        message += `${statusEmoji} TXID: \`${tx.txid}\`\n`;
        message += `👤 ${userName} (@${userUsername})\n`;
        message += `📦 ${productName}\n`;
        message += `💵 R$ ${tx.amount}\n`;
        message += `📅 ${new Date(tx.created_at).toLocaleString('pt-BR')}\n`;
        
        if (tx.delivered_at) {
          message += `✅ Entregue: ${new Date(tx.delivered_at).toLocaleString('pt-BR')}\n`;
        } else if (tx.validated_at) {
          message += `⏳ Validada: ${new Date(tx.validated_at).toLocaleString('pt-BR')}\n`;
        }
        
        message += `\n`;
        
        // Adicionar botão para ver detalhes (onde o botão de reverter aparecerá)
        keyboard.push([
          { text: `📋 Ver Detalhes - ${tx.txid.substring(0, 10)}...`, callback_data: `details_${tx.txid}` }
        ]);
        
        message += `——————————\n\n`;
      }
      
      keyboard.push([
        { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
      ]);
      
      return ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('Erro ao listar entregues:', err);
      return ctx.reply('❌ Erro ao buscar transações entregues.');
    }
  });

  bot.action('admin_stats', async (ctx) => {
    try {
      await ctx.answerCbQuery('📊 Carregando estatísticas...');
    } catch (err) {
      // Ignorar erro de callback query expirado
    }
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const stats = await db.getStats();
      
      const message = `📊 *ESTATÍSTICAS COMPLETAS*
━━━━━━━━━━━━━━━━━━━━━

👥 *Usuários:* ${stats.totalUsers}
💳 *Transações:* ${stats.totalTransactions}
⏳ *Pendentes:* ${stats.pendingTransactions}
✅ *Validadas:* ${stats.validatedTransactions || 0}
📦 *Entregues:* ${stats.deliveredTransactions || 0}

💰 *Total em vendas:* R$ ${stats.totalSales}
💵 *Ticket médio:* R$ ${stats.avgTicket || '0.00'}

📅 *Hoje:*
💰 Vendas: R$ ${stats.todaySales || '0.00'}
📦 Transações: ${stats.todayTransactions || 0}

🔄 *Atualização:* Automática em tempo real
📅 *Última atualização:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🔄 Recalcular Valores', 'admin_recalcular_valores')
        ],
        [
          Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
        ]
      ]);
      
      try {
        return ctx.editMessageText(message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      } catch (editErr) {
        return ctx.reply(message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      }
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas.');
    }
  });
  
  // Recalcular valores de vendas
  bot.action('admin_recalcular_valores', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Recalculando...');
    } catch (err) {
      // Ignorar erro de callback query expirado
    }
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      await ctx.editMessageText('🔄 *RECALCULANDO VALORES...*\n\n⏳ Aguarde, isso pode levar alguns segundos...', {
        parse_mode: 'Markdown'
      });
      
      const result = await db.recalculateTotalSales();
      const stats = await db.getStats();
      
      let fixedMessage = '';
      if (result.fixed && result.fixed > 0) {
        fixedMessage = `\n🔧 *Correções:* ${result.fixed} transação(ões) corrigida(s) automaticamente`;
      }
      
      const message = `✅ *VALORES RECALCULADOS COM SUCESSO!*
━━━━━━━━━━━━━━━━━━━━━

📊 *Resultado do recálculo:*
💰 Total de vendas: R$ ${result.totalSales}
📦 Total de transações: ${result.totalTransactions}
📅 Vendas de hoje: R$ ${result.todaySales} (${result.todayTransactions} transações)${fixedMessage}

📊 *Estatísticas Atualizadas:*
👥 Usuários: ${stats.totalUsers}
💳 Transações: ${stats.totalTransactions}
⏳ Pendentes: ${stats.pendingTransactions}
💰 Total em vendas: R$ ${stats.totalSales}
💵 Ticket médio: R$ ${stats.avgTicket || '0.00'}

🔄 *Sistema:* Atualização automática em tempo real
📅 *Recalculado em:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Ver Estatísticas', 'admin_stats')
        ],
        [
          Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
        ]
      ]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (err) {
      console.error('Erro ao recalcular valores:', err);
      return ctx.editMessageText('❌ Erro ao recalcular valores. Verifique os logs.', {
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback('🔙 Voltar', 'admin_refresh')
          ]]
        }
      });
    }
  });

  bot.action('admin_produtos', async (ctx) => {
    await ctx.answerCbQuery('🛍️ Carregando produtos...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.editMessageText('📦 Nenhum produto cadastrado.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('➕ Criar Produto', 'admin_novoproduto')],
            [Markup.button.callback('🔙 Voltar', 'admin_refresh')]
          ])
        });
      }
      
      let message = `🛍️ *PRODUTOS CADASTRADOS:* ${products.length}\n\n`;
      
      const buttons = [];
      
      for (const product of products) {
        const status = product.is_active ? '✅' : '❌';
        
        // Determinar tipo de entrega de forma limpa
        let deliveryDisplay = '';
        if (product.delivery_type === 'file') {
          deliveryDisplay = '📦 Arquivo ZIP';
        } else if (product.delivery_url && product.delivery_url.startsWith('http')) {
          deliveryDisplay = '🔗 Link/URL';
        } else {
          deliveryDisplay = '⚠️ Não configurada';
        }
        
        message += `${status} *${product.name}*\n`;
        message += `🆔 ID: \`${product.product_id}\`\n`;
        message += `💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}\n`;
        message += `📝 Descrição: ${product.description || 'Não tem'}\n`;
        message += `📦 Entrega: ${deliveryDisplay}\n`;
        message += `——————————\n\n`;
        
        // Adicionar botões para cada produto
        buttons.push([
          Markup.button.callback(`✏️ Editar ${product.name}`, `edit_product:${product.product_id}`),
          Markup.button.callback(`🗑️ Deletar`, `delete_product:${product.product_id}`)
        ]);
      }
      
      // Botões de ação geral
      buttons.push([Markup.button.callback('➕ Novo Produto', 'admin_novoproduto')]);
      buttons.push([Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao buscar produtos.');
    }
  });

  bot.action('admin_novoproduto', async (ctx) => {
    await ctx.answerCbQuery('➕ Iniciando criação...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Iniciar sessão de criação
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'create_product',
      step: 'name',
      data: {}
    };
    
    return ctx.reply(`➕ *CRIAR NOVO PRODUTO*

Vamos criar um novo produto passo a passo.

*Passo 1:* Digite o *NOME* do produto:

Exemplo: Pack Premium VIP

Cancelar: /cancelar`, { parse_mode: 'Markdown' });
  });
  
  // Handler para editar produto via botão
  bot.action(/^edit_product:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✏️ Carregando produto...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      // Iniciar sessão de edição
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'field',
        data: { productId, product }
      };
      
      const statusText = product.is_active ? '🟢 Ativo' : '🔴 Inativo';
      
      // Determinar tipo de entrega de forma limpa
      let deliveryDisplay = '';
      if (product.delivery_type === 'file') {
        deliveryDisplay = '📦 Arquivo ZIP';
      } else if (product.delivery_url && product.delivery_url.startsWith('http')) {
        deliveryDisplay = '🔗 Link/URL';
      } else {
        deliveryDisplay = '⚠️ Não configurada';
      }
      
      const message = `✏️ *EDITAR PRODUTO*

*Produto:* ${product.name}
*Status:* ${statusText}

📋 *Detalhes atuais:*
💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}
📝 Descrição: ${product.description || 'Não tem'}
📦 Entrega: ${deliveryDisplay}

*O que deseja editar?*`;

      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('📝 Nome', `edit_field:name:${productId}`),
            Markup.button.callback('💰 Preço', `edit_field:price:${productId}`)
          ],
          [
            Markup.button.callback('📄 Descrição', `edit_field:description:${productId}`),
            Markup.button.callback('🔗 URL/Arquivo', `edit_field:url:${productId}`)
          ],
          [
            Markup.button.callback(product.is_active ? '🔴 Desativar' : '🟢 Ativar', `toggle_product:${productId}`)
          ],
          [
            Markup.button.callback('🔙 Voltar', 'admin_produtos')
          ]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao editar produto:', err);
      return ctx.reply('❌ Erro ao carregar produto.');
    }
  });
  
  // Handler para deletar produto via botão (AUTOMÁTICO)
  bot.action(/^delete_product:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Deletando produto...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      console.log(`🗑️ [DELETE] Deletando produto ${productId} automaticamente...`);
      
      // Deletar produto (cascata deleta transações também)
      const deleted = await db.deleteProduct(productId);
      
      if (deleted) {
        // Se o produto tinha arquivo no Telegram, deletar também
        if (product.delivery_url && product.delivery_url.startsWith('telegram_file:')) {
          try {
            const fileId = product.delivery_url.replace('telegram_file:', '');
            console.log(`🗑️ [DELETE] Arquivo do Telegram marcado para remoção: ${fileId.substring(0, 30)}...`);
            // Nota: Telegram não permite deletar arquivos enviados, mas removemos a referência
          } catch (fileErr) {
            console.error('Aviso: Não foi possível remover arquivo do Telegram:', fileErr);
          }
        }
        
        await ctx.reply(`✅ *Produto deletado com sucesso!*

🛍️ ${product.name}
🆔 ID: \`${productId}\`

🗑️ Produto removido permanentemente do banco de dados.

${product.delivery_type === 'file' ? '📎 Arquivo também foi removido das referências.' : ''}`, {
          parse_mode: 'Markdown'
        });
        
        // Atualizar lista de produtos
        return bot.handleUpdate({
          callback_query: {
            ...ctx.callbackQuery,
            data: 'admin_produtos'
          }
        });
        
      } else {
        return ctx.reply('❌ Erro ao deletar produto.');
      }
      
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
      return ctx.reply('❌ Erro ao deletar produto.');
    }
  });
  
  // Handler para alternar status do produto (ativar/desativar)
  bot.action(/^toggle_product:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Alterando status...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      const newStatus = !product.is_active;
      await db.updateProduct(productId, { is_active: newStatus });
      
      return ctx.reply(`✅ Produto ${newStatus ? '*ativado*' : '*desativado*'} com sucesso!\n\n🛍️ ${product.name}`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao alternar status:', err);
      return ctx.reply('❌ Erro ao alterar status.');
    }
  });
  
  // Handler para editar campos via botão
  bot.action(/^edit_field:(.+):(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const field = ctx.match[1];
      const productId = ctx.match[2];
      
      const product = await db.getProduct(productId, true);
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      // Iniciar sessão de edição
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'edit_value',
        data: { productId, product, field }
      };
      
      const prompts = {
        'name': '📝 Digite o novo *nome* do produto:',
        'price': '💰 Digite o novo *preço* (apenas números):',
        'description': '📄 Digite a nova *descrição* (ou "-" para remover):',
        'url': '🔗 Digite a nova *URL* ou envie um *arquivo*:'
      };
      
      return ctx.reply(`${prompts[field]}\n\n_Cancelar: /cancelar_`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao editar campo:', err);
      return ctx.reply('❌ Erro ao editar campo.');
    }
  });

  bot.action('admin_setpix', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const currentKey = await db.getPixKey();
    
    const message = `🔑 *ALTERAR CHAVE PIX*

🔑 *Chave atual:* ${currentKey || 'Não configurada'}

*Como alterar:*
Digite /setpix seguido da nova chave

*Exemplos:*
• /setpix seu@email.com
• /setpix +55 11 99988-7766
• /setpix 11999887766
• /setpix 12345678900
• /setpix 6f2a2e5d-5308-4588-ad31-ee81a67807d6

*Tipos aceitos:*
✅ Email
✅ Telefone (com ou sem formatação)
✅ CPF/CNPJ
✅ Chave aleatória (UUID)`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.action('admin_users', async (ctx) => {
    await ctx.answerCbQuery('👥 Carregando usuários e transações...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;

    // Função local para escapar caracteres especiais do Markdown v1
    const esc = (str) => String(str || '').replace(/([_*`\[\]])/g, '\\$1');

    try {
      const [usersResult, pendingResult] = await Promise.all([
        db.getRecentUsers(10, 0),
        db.getPendingTransactions(10, 0)
      ]);

      const users = usersResult.data || [];
      const pending = pendingResult.data || [];

      let message = `👥 *GERENCIAR USUÁRIOS E TRANSAÇÕES*\n\n`;

      // Seção de transações pendentes
      if (pending && pending.length > 0) {
        message += `⏳ *TRANSAÇÕES PENDENTES: ${pendingResult.total}* (mostrando ${pending.length})\n\n`;

        for (const tx of pending) {
          const user = tx.user || {};
          const productName = esc(tx.product?.name || tx.media_pack?.name || tx.product_id || tx.media_pack_id || 'N/A');
          message += `🆔 TXID: \`${esc(tx.txid)}\`\n`;
          message += `👤 ${esc(user.first_name || 'N/A')} (${user.username ? '@' + esc(user.username) : 'sem @'})\n`;
          message += `📦 ${productName}\n`;
          message += `💵 R$ ${tx.amount}\n`;
          message += `📅 ${tx.proof_received_at ? new Date(tx.proof_received_at).toLocaleString('pt-BR') : 'Aguardando'}\n`;
          message += `\n`;
        }

        message += `\n*Use os botões abaixo para aprovar/rejeitar:*\n\n`;
      } else {
        message += `✅ Nenhuma transação pendente no momento.\n\n`;
      }

      // Seção de usuários
      message += `👥 *ÚLTIMOS USUÁRIOS: ${usersResult.total}* (mostrando ${users.length})\n\n`;

      if (users && users.length > 0) {
        for (const user of users) {
          const blockedTag = user.is_blocked ? ' 🚫' : '';
          const adminTag = user.is_admin ? ' 👑' : '';
          message += `👤 ${esc(user.first_name || 'Sem nome')}${adminTag}${blockedTag}\n`;
          message += `🆔 ${user.username ? '@' + esc(user.username) : 'Sem username'}\n`;
          message += `🔢 ID: \`${user.telegram_id}\`\n`;
          message += `📅 ${new Date(user.created_at).toLocaleDateString('pt-BR')}\n`;
          message += `——————————\n\n`;
        }
      } else {
        message += `📦 Nenhum usuário cadastrado ainda.\n\n`;
      }

      // Criar botões para transações pendentes
      const buttons = [];
      if (pending && pending.length > 0) {
        for (const tx of pending.slice(0, 5)) {
          buttons.push([
            Markup.button.callback(
              `✅ Aprovar ${tx.txid.substring(0, 8)}`,
              `approve_${tx.txid}`
            ),
            Markup.button.callback(
              `❌ Rejeitar ${tx.txid.substring(0, 8)}`,
              `reject_${tx.txid}`
            )
          ]);
        }
      }

      buttons.push([Markup.button.callback('🔄 Atualizar', 'admin_users')]);
      buttons.push([Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]);

      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      return ctx.reply('❌ Erro ao buscar usuários. Tente novamente.');
    }
  });

  // ===== CONFIGURAR SUPORTE =====
  // ===== GERENCIAR TICKETS DE SUPORTE =====
  bot.action('admin_tickets', async (ctx) => {
    try {
      await ctx.answerCbQuery('🎫 Carregando tickets...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const openTickets = await db.getAllOpenTickets(20);
      
      let message = `🎫 *TICKETS DE SUPORTE*

📊 *Tickets Abertos:* ${openTickets.length}

`;
      
      if (openTickets.length === 0) {
        message += `✅ Nenhum ticket aberto no momento.`;
      } else {
        for (const ticket of openTickets.slice(0, 10)) {
          const user = ticket.users || {};
          const statusEmoji = ticket.status === 'open' ? '🟢' : '🟡';
          message += `${statusEmoji} *${ticket.ticket_number}*\n`;
          message += `👤 ${user.first_name || 'N/A'} (@${user.username || 'N/A'})\n`;
          message += `📝 ${ticket.subject || 'Sem assunto'}\n`;
          message += `📅 ${new Date(ticket.created_at).toLocaleDateString('pt-BR')}\n\n`;
        }
      }
      
      const buttons = [];
      for (const ticket of openTickets.slice(0, 5)) {
        buttons.push([Markup.button.callback(
          `📋 ${ticket.ticket_number} - ${ticket.subject?.substring(0, 30) || 'Sem assunto'}...`,
          `admin_view_ticket_${ticket.id}`
        )]);
      }
      buttons.push([
        Markup.button.callback('🔄 Atualizar', 'admin_tickets'),
        Markup.button.callback('🔙 Voltar', 'admin_refresh')
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      console.error('❌ [ADMIN-TICKETS] Erro:', err);
      return ctx.reply('❌ Erro ao carregar tickets.');
    }
  });
  
  // Ver ticket específico (admin)
  bot.action(/^admin_view_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const ticket = await db.getSupportTicket(ticketId);
      
      if (!ticket) {
        return ctx.reply('❌ Ticket não encontrado.');
      }
      
      const messages = await db.getTicketMessages(ticketId);
      const user = await db.getUserByTelegramId(ticket.telegram_id);
      
      // Escapar caracteres especiais do Markdown
      const escapeMarkdown = (text) => {
        if (!text) return '';
        return String(text)
          .replace(/\*/g, '\\*')
          .replace(/_/g, '\\_')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)')
          .replace(/~/g, '\\~')
          .replace(/`/g, '\\`');
      };
      
      const ticketNumber = escapeMarkdown(ticket.ticket_number);
      const userName = escapeMarkdown(user?.first_name || 'N/A');
      const userUsername = escapeMarkdown(user?.username || 'N/A');
      const subject = escapeMarkdown(ticket.subject || 'Sem assunto');
      
      let message = `📋 *TICKET ${ticketNumber}*\n\n`;
      message += `👤 *Usuário:* ${userName} (@${userUsername})\n`;
      message += `🆔 *ID:* ${ticket.telegram_id}\n`;
      message += `📝 *Assunto:* ${subject}\n`;
      message += `📊 *Status:* ${ticket.status === 'open' ? '🟢 Aberto' : ticket.status === 'in_progress' ? '🟡 Em andamento' : ticket.status === 'resolved' ? '✅ Resolvido' : '🔴 Fechado'}\n`;
      message += `📅 *Criado:* ${new Date(ticket.created_at).toLocaleString('pt-BR')}\n\n`;
      message += `💬 *Conversa:*\n\n`;
      
      for (const msg of messages) {
        const sender = msg.is_admin ? '👨\\u200d💼 Admin' : '👤 Cliente';
        const dateStr = new Date(msg.created_at).toLocaleString('pt-BR');
        message += `${sender} \\(${dateStr}\\):\n`;
        // Escapar caracteres especiais do Markdown na mensagem
        const escapedMessage = escapeMarkdown(msg.message);
        message += `${escapedMessage}\n\n`;
      }
      
      const buttons = [];
      if (ticket.status !== 'closed') {
        buttons.push([Markup.button.callback('💬 Responder', `admin_reply_ticket_${ticketId}`)]);
        if (ticket.status === 'open') {
          buttons.push([Markup.button.callback('✅ Atribuir a Mim', `admin_assign_ticket_${ticketId}`)]);
        }
        buttons.push([
          Markup.button.callback('✅ Resolver', `admin_resolve_ticket_${ticketId}`),
          Markup.button.callback('🔴 Fechar', `admin_close_ticket_${ticketId}`)
        ]);
      }
      buttons.push([
        Markup.button.callback('🎫 Todos os Tickets', 'admin_tickets'),
        Markup.button.callback('🔙 Voltar', 'admin_refresh')
      ]);
      
      // Tentar editar a mensagem, se falhar, enviar nova mensagem
      try {
        return await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup
        });
      } catch (editErr) {
        // Se falhar ao editar (mensagem muito antiga ou erro de parsing), enviar nova mensagem
        if (editErr.message && (editErr.message.includes('can\'t parse entities') || editErr.message.includes('message is not modified') || editErr.message.includes('message to edit not found'))) {
          return ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup
          });
        }
        throw editErr;
      }
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao visualizar ticket.');
    }
  });
  
  // Atribuir ticket
  bot.action(/^admin_assign_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✅ Atribuindo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const user = await db.getUserByTelegramId(ctx.from.id);
      
      await db.assignTicket(ticketId, user.id);
      
      const ticket = await db.getSupportTicket(ticketId);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(ticket.telegram_id, 
          `✅ *Seu ticket foi atribuído a um admin*\n\n📋 Ticket: ${ticket.ticket_number}\n\n⏳ Um admin está analisando seu caso e responderá em breve.`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      return ctx.reply(`✅ Ticket ${ticket.ticket_number} atribuído a você!`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 Ver Ticket', callback_data: `admin_view_ticket_${ticketId}` }
          ]]
        }
      });
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao atribuir ticket.');
    }
  });
  
  // Responder ticket (admin)
  bot.action(/^admin_reply_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'admin_reply_ticket',
        ticketId: ticketId
      };
      
      // Tentar editar a mensagem, se falhar, enviar nova mensagem
      try {
        return await ctx.editMessageText(`💬 *RESPONDER TICKET*

Digite sua resposta:

_Cancelar: /cancelar_`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Cancelar', callback_data: 'admin_refresh' }
            ]]
          }
        });
      } catch (editErr) {
        // Se falhar ao editar (mensagem muito antiga ou erro de parsing), enviar nova mensagem
        if (editErr.message && (editErr.message.includes('can\'t parse entities') || editErr.message.includes('message is not modified') || editErr.message.includes('message to edit not found'))) {
          return ctx.reply(`💬 *RESPONDER TICKET*

Digite sua resposta:

_Cancelar: /cancelar_`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Cancelar', callback_data: 'admin_refresh' }
              ]]
            }
          });
        }
        throw editErr;
      }
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao responder ticket.');
    }
  });
  
  // Resolver ticket
  bot.action(/^admin_resolve_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✅ Resolvendo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const user = await db.getUserByTelegramId(ctx.from.id);
      
      await db.updateTicketStatus(ticketId, 'resolved', user.id);
      
      const ticket = await db.getSupportTicket(ticketId);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(ticket.telegram_id, 
          `✅ *Seu ticket foi resolvido*\n\n📋 Ticket: ${ticket.ticket_number}\n\n✅ O problema foi resolvido. Se precisar de mais ajuda, abra um novo ticket.`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      return ctx.reply(`✅ Ticket ${ticket.ticket_number} marcado como resolvido!`);
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao resolver ticket.');
    }
  });
  
  // Fechar ticket
  bot.action(/^admin_close_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔴 Fechando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const user = await db.getUserByTelegramId(ctx.from.id);
      
      await db.updateTicketStatus(ticketId, 'closed', user.id);
      
      const ticket = await db.getSupportTicket(ticketId);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(ticket.telegram_id, 
          `🔴 *Seu ticket foi fechado*\n\n📋 Ticket: ${ticket.ticket_number}\n\nSe precisar de mais ajuda, abra um novo ticket.`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      return ctx.reply(`🔴 Ticket ${ticket.ticket_number} fechado!`);
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao fechar ticket.');
    }
  });
  
  // ===== GERENCIAR USUÁRIOS CONFIÁVEIS =====
  bot.action('admin_trusted_users', async (ctx) => {
    try {
      await ctx.answerCbQuery('⭐ Carregando usuários confiáveis...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const { data: trustedUsers, error } = await db.supabase
        .from('trusted_users')
        .select(`
          *,
          users:user_id (first_name, username, telegram_id)
        `)
        .order('trust_score', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      let message = `⭐ *USUÁRIOS CONFIÁVEIS*\n\n`;
      message += `📊 Total: ${trustedUsers?.length || 0} usuários\n\n`;
      
      if (!trustedUsers || trustedUsers.length === 0) {
        message += `Nenhum usuário confiável cadastrado ainda.\n\n`;
        message += `*Como funciona:*\n`;
        message += `• Usuários ganham confiança ao ter comprovantes aprovados\n`;
        message += `• Quanto maior a confiança, menor o threshold para aprovação automática\n`;
        message += `• Você pode adicionar usuários manualmente à whitelist`;
      } else {
        for (const trusted of trustedUsers.slice(0, 10)) {
          const user = trusted.users || {};
          const score = parseFloat(trusted.trust_score) || 0;
          const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
          message += `${emoji} *${user.first_name || 'N/A'}* (@${user.username || 'N/A'})\n`;
          message += `⭐ Score: ${score.toFixed(1)}/100\n`;
          message += `✅ Aprovadas: ${trusted.approved_transactions || 0} | ❌ Rejeitadas: ${trusted.rejected_transactions || 0}\n`;
          message += `🎯 Threshold: ${parseFloat(trusted.auto_approve_threshold || 60).toFixed(0)}%\n\n`;
        }
      }
      
      const buttons = [];
      if (trustedUsers && trustedUsers.length > 0) {
        buttons.push([Markup.button.callback('➕ Adicionar à Whitelist', 'admin_add_trusted')]);
      }
      buttons.push([
        Markup.button.callback('🔄 Atualizar', 'admin_trusted_users'),
        Markup.button.callback('🔙 Voltar', 'admin_refresh')
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      console.error('❌ [ADMIN-TRUSTED] Erro:', err);
      return ctx.reply('❌ Erro ao carregar usuários confiáveis.');
    }
  });
  
  // ===== GERENCIAR RESPOSTAS AUTOMÁTICAS =====
  bot.action('admin_auto_responses', async (ctx) => {
    try {
      await ctx.answerCbQuery('🤖 Carregando respostas automáticas...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const responses = await db.getAllAutoResponses();
      
      let message = `🤖 *RESPOSTAS AUTOMÁTICAS (FAQ)*\n\n`;
      message += `📊 Total: ${responses.length} respostas\n\n`;
      
      if (responses.length === 0) {
        message += `Nenhuma resposta automática cadastrada.\n\n`;
        message += `*Como funciona:*\n`;
        message += `• O bot responde automaticamente a palavras-chave\n`;
        message += `• Útil para perguntas frequentes\n`;
        message += `• Reduz carga de suporte`;
      } else {
        for (const resp of responses.slice(0, 10)) {
          const status = resp.is_active ? '🟢' : '🔴';
          message += `${status} *${resp.keyword}*\n`;
          message += `📝 ${resp.response.substring(0, 50)}${resp.response.length > 50 ? '...' : ''}\n`;
          message += `📊 Uso: ${resp.usage_count || 0} vezes | Prioridade: ${resp.priority || 0}\n\n`;
        }
      }
      
      const buttons = [
        [Markup.button.callback('➕ Nova Resposta', 'admin_add_auto_response')],
        [
          Markup.button.callback('🔄 Atualizar', 'admin_auto_responses'),
          Markup.button.callback('🔙 Voltar', 'admin_refresh')
        ]
      ];
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      console.error('❌ [ADMIN-AUTO-RESPONSES] Erro:', err);
      return ctx.reply('❌ Erro ao carregar respostas automáticas.');
    }
  });
  
  // Adicionar resposta automática
  bot.action('admin_add_auto_response', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'add_auto_response',
        step: 'keyword'
      };
      
      return ctx.reply(`🤖 *NOVA RESPOSTA AUTOMÁTICA*

📝 *Passo 1/3: Palavra-chave*

Digite a palavra-chave que deve ativar esta resposta (ex: "entrega", "pix", "produto"):

_Cancelar: /cancelar`, {
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error('❌ [ADMIN-AUTO-RESPONSES] Erro:', err);
      return ctx.reply('❌ Erro ao criar resposta automática.');
    }
  });
  
  bot.action('admin_support', async (ctx) => {
    await ctx.answerCbQuery('💬 Configurando suporte...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const currentSupport = await db.getSetting('support_link');
    
    return ctx.reply(`💬 *CONFIGURAR SUPORTE*

🔗 *Link atual:* ${currentSupport || 'Não configurado'}

*Para configurar o suporte, use:*
/setsuporte [link do Telegram]

*Exemplos:*
• /setsuporte https://t.me/seususuario
• /setsuporte https://t.me/seugruposuporte

*Nota:* O link será exibido como botão no menu principal do bot, abaixo dos produtos.`, { parse_mode: 'Markdown' });
  });

  bot.command('setsuporte', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        const currentSupport = await db.getSetting('support_link');
        return ctx.reply(`❌ *Uso incorreto!*

🔗 *Link atual:* ${currentSupport || 'Não configurado'}

*Formato:* /setsuporte [link]

*Exemplos:*
• /setsuporte https://t.me/seususuario
• /setsuporte https://t.me/seugruposuporte

*Para remover o suporte:*
/setsuporte remover`, { parse_mode: 'Markdown' });
      }
      
      const link = args.join(' ').trim();
      
      // Remover suporte
      if (link.toLowerCase() === 'remover') {
        await db.setSetting('support_link', null, ctx.from.id);
        return ctx.reply(`✅ *Link de suporte removido com sucesso!*

O botão de suporte não será mais exibido no menu principal.`, { parse_mode: 'Markdown' });
      }
      
      // Validação básica de link do Telegram
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return ctx.reply('❌ Link inválido! Deve começar com http:// ou https://');
      }
      
      if (!link.includes('t.me/') && !link.includes('telegram.me/')) {
        return ctx.reply('❌ O link deve ser do Telegram (contendo t.me/ ou telegram.me/)');
      }
      
      // Salvar no banco
      await db.setSetting('support_link', link, ctx.from.id);
      
      return ctx.reply(`✅ *Link de suporte configurado com sucesso!*

🔗 *Link:* ${link}

O botão de suporte agora aparecerá no menu principal do bot, abaixo dos produtos!

*Para testar:* Use /start e veja o botão "💬 Suporte"`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao configurar suporte:', err.message);
      return ctx.reply('❌ Erro ao configurar suporte. Tente novamente.');
    }
  });

  // ===== GERENCIAR GRUPOS =====
  bot.action('admin_groups', async (ctx) => {
    await ctx.answerCbQuery('👥 Carregando grupos...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const groups = await db.getAllGroups();
      
      let message = `👥 *GERENCIAR GRUPOS*

*Grupos cadastrados:* ${groups.length}

`;

      const buttons = [];
      
      if (groups.length === 0) {
        message += `📦 Nenhum grupo cadastrado ainda.

Clique no botão abaixo para cadastrar o primeiro grupo.`;
        
        buttons.push([Markup.button.callback('➕ Novo Grupo', 'admin_novogrupo')]);
      } else {
        for (const group of groups) {
          const status = group.is_active ? '✅' : '❌';
          message += `${status} *${group.group_name || 'Sem nome'}*
🆔 ID: \`${group.group_id}\`
💰 Preço: R$ ${parseFloat(group.subscription_price).toFixed(2)}/mês
📅 Dias: ${group.subscription_days}
🔗 ${group.group_link}
──────────────

`;
          
          // Botões para cada grupo
          buttons.push([
            Markup.button.callback(`✏️ Editar ${group.group_name || 'Grupo'}`, `edit_group:${group.id}`),
            Markup.button.callback(`🗑️ Deletar`, `delete_group:${group.id}`)
          ]);
        }
        
        // Botões de ação geral
        buttons.push([Markup.button.callback('➕ Novo Grupo', 'admin_novogrupo')]);
      }
      
      buttons.push([Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar grupos:', err);
      return ctx.reply('❌ Erro ao buscar grupos.');
    }
  });
  
  // Handler para iniciar criação de grupo via botão
  bot.action('admin_novogrupo', async (ctx) => {
    await ctx.answerCbQuery('➕ Iniciando criação...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Iniciar sessão de criação
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'create_group',
      step: 'group_id',
      data: {}
    };
    
    return ctx.reply(`➕ *CADASTRAR NOVO GRUPO*

*Passo 1/5:* Envie o *ID do grupo/canal*

📝 *Como obter o ID:*
1. Adicione o bot @userinfobot ao grupo/canal
2. Copie o ID que aparece (ex: -1001234567890)
3. Cole aqui

💡 *Dica:* O ID deve ser um número negativo`, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_create_group')]
      ])
    });
  });

  bot.command('novogrupo', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'create_group',
      step: 'group_id',
      data: {}
    };
    
    return ctx.reply(`➕ *CADASTRAR NOVO GRUPO*

*Passo 1/5:* Envie o *ID do grupo*

📝 *Como obter o ID:*
1. Adicione o bot @userinfobot ao grupo
2. Copie o ID que aparece (ex: -1001234567890)
3. Cole aqui`, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_create_group')]
      ])
    });
  });
  
  // Handler para cancelar criação de grupo
  bot.action('cancel_create_group', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    delete global._SESSIONS[ctx.from.id];
    
    return ctx.reply('❌ Criação de grupo cancelada.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👥 Gerenciar Grupos', 'admin_groups')],
        [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
      ])
    });
  });
  
  // Handler para deletar grupo via botão
  bot.action(/^delete_group:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Deletando grupo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupUuid = ctx.match[1];
      
      // Buscar grupo pelo UUID interno
      const { data: group, error } = await db.supabase
        .from('groups')
        .select('*')
        .eq('id', groupUuid)
        .single();
      
      if (error || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      // Deletar grupo
      const deleted = await db.deleteGroup(group.group_id);
      
      if (deleted) {
        await ctx.reply(`✅ *Grupo deletado com sucesso!*

👥 ${group.group_name || 'Grupo'}
🆔 ID: \`${group.group_id}\`

🗑️ Grupo removido permanentemente do banco de dados.`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 Ver Grupos', 'admin_groups')],
            [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
          ])
        });
      } else {
        return ctx.reply('❌ Erro ao deletar grupo.');
      }
      
    } catch (err) {
      console.error('Erro ao deletar grupo:', err);
      return ctx.reply('❌ Erro ao deletar grupo.');
    }
  });
  
  // Handler para editar grupo via botão
  bot.action(/^edit_group:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✏️ Carregando grupo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupUuid = ctx.match[1];
      
      // Buscar grupo pelo UUID interno
      const { data: group, error } = await db.supabase
        .from('groups')
        .select('*')
        .eq('id', groupUuid)
        .single();
      
      if (error || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      const statusText = group.is_active ? '🟢 Ativo' : '🔴 Inativo';
      
      const message = `✏️ *EDITAR GRUPO*

*Grupo:* ${group.group_name || 'Sem nome'}
*Status:* ${statusText}

📋 *Detalhes atuais:*
🆔 ID: \`${group.group_id}\`
💰 Preço: R$ ${parseFloat(group.subscription_price).toFixed(2)}/mês
📅 Duração: ${group.subscription_days} dias
🔗 Link: ${group.group_link}

*O que deseja editar?*`;

      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('📝 Nome', `edit_group_field:name:${groupUuid}`),
            Markup.button.callback('💰 Preço', `edit_group_field:price:${groupUuid}`)
          ],
          [
            Markup.button.callback('📅 Duração', `edit_group_field:days:${groupUuid}`),
            Markup.button.callback('🔗 Link', `edit_group_field:link:${groupUuid}`)
          ],
          [
            Markup.button.callback(group.is_active ? '🔴 Desativar' : '🟢 Ativar', `toggle_group:${groupUuid}`)
          ],
          [
            Markup.button.callback('🔙 Voltar', 'admin_groups')
          ]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao editar grupo:', err);
      return ctx.reply('❌ Erro ao carregar grupo.');
    }
  });


  // ===== TOGGLE GRUPO (ATIVAR / DESATIVAR) =====
  bot.action(/^toggle_group:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Alterando status...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const groupUuid = ctx.match[1];

      const { data: group, error } = await db.supabase
        .from('groups')
        .select('*')
        .eq('id', groupUuid)
        .single();

      if (error || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }

      const newStatus = !group.is_active;

      const { error: updateError } = await db.supabase
        .from('groups')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', groupUuid);

      if (updateError) throw updateError;

      const statusLabel = newStatus ? '✅ Ativado' : '🔴 Desativado';

      await ctx.reply(`${statusLabel} com sucesso!\n\n👥 *${group.group_name || 'Grupo'}*\nNovo status: ${newStatus ? '🟢 Ativo' : '🔴 Inativo'}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Continuar editando', `edit_group:${groupUuid}`)],
          [Markup.button.callback('👥 Ver Grupos', 'admin_groups')],
          [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
        ])
      });

    } catch (err) {
      console.error('Erro ao alternar status do grupo:', err);
      return ctx.reply('❌ Erro ao alterar status do grupo.');
    }
  });

  // ===== EDITAR CAMPO DO GRUPO (Nome / Preço / Duração / Link) =====
  bot.action(/^edit_group_field:(\w+):(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✏️ Editando campo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;

      const field = ctx.match[1];   // name | price | days | link
      const groupUuid = ctx.match[2];

      const { data: group, error } = await db.supabase
        .from('groups')
        .select('*')
        .eq('id', groupUuid)
        .single();

      if (error || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }

      const fieldLabels = {
        name:  { label: 'Nome',           example: 'Ex: Privadinho VIP',       current: group.group_name || 'Sem nome' },
        price: { label: 'Preço (R$)',     example: 'Ex: 59.90',                current: `R$ ${parseFloat(group.subscription_price).toFixed(2)}` },
        days:  { label: 'Duração (dias)', example: 'Ex: 30',                   current: `${group.subscription_days} dias` },
        link:  { label: 'Link do grupo',  example: 'Ex: https://t.me/+XXXXX',  current: group.group_link }
      };

      const info = fieldLabels[field];
      if (!info) return ctx.reply('❌ Campo inválido.');

      // Guardar estado na sessão global para capturar texto na sequência
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_group_field',
        data: { field, groupUuid }
      };

      await ctx.reply(
        `✏️ *Editar ${info.label}*\n\n*Valor atual:* ${info.current}\n\n📝 Digite o novo valor:\n_${info.example}_`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', `edit_group:${groupUuid}`)]
          ])
        }
      );

    } catch (err) {
      console.error('Erro ao iniciar edição de campo do grupo:', err);
      return ctx.reply('❌ Erro ao carregar campo de edição.');
    }
  });

  bot.command('editargrupo', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    const groups = await db.getAllGroups();
    
    if (groups.length === 0) {
      return ctx.reply('📦 Nenhum grupo cadastrado.\n\nUse /novogrupo para criar o primeiro.');
    }
    
    let message = `✏️ *EDITAR GRUPO*

Digite o ID do grupo que deseja editar:

`;
    
    for (const group of groups) {
      message += `• ${group.group_id} - ${group.group_name || 'Sem nome'}\n`;
    }
    
    message += `\nExemplo: /edit_${groups[0].group_id}\nCancelar: /cancelar`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.command('deletargrupo', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    const groups = await db.getAllGroups();
    
    if (groups.length === 0) {
      return ctx.reply('📦 Nenhum grupo para remover.');
    }
    
    let message = `🗑️ *DELETAR GRUPO*

⚠️ *ATENÇÃO:* Ação irreversível\\!
• Grupo será deletado permanentemente
• Todas as assinaturas serão removidas

Digite o ID do grupo:

`;
    
    for (const group of groups) {
      message += `• ${group.group_id} - ${group.group_name || 'Sem nome'}\n`;
    }
    
    message += `\nExemplo: /delete_group_${groups[0].group_id}\nCancelar: /cancelar`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // Handler para /edit_[groupId]
  bot.hears(/^\/edit_(-?\d+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupId = parseInt(ctx.match[1]);
      const group = await db.getGroupById(groupId);
      
      if (!group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_group',
        step: 'field',
        data: { groupId }
      };
      
      return ctx.reply(`✏️ *EDITAR GRUPO*

*Grupo:* ${group.group_name || 'Sem nome'}
🆔 ID: ${group.group_id}

*O que deseja editar?*

1️⃣ /edit_group_name - Nome
2️⃣ /edit_group_link - Link
3️⃣ /edit_group_price - Preço
4️⃣ /edit_group_days - Dias de assinatura
5️⃣ /edit_group_status - Ativar/Desativar

_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao editar grupo:', err);
      return ctx.reply('❌ Erro ao editar grupo.');
    }
  });

  // Handler para /delete_group_[groupId]
  bot.hears(/^\/delete_group_(-?\d+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupId = parseInt(ctx.match[1]);
      const group = await db.getGroupById(groupId);
      
      if (!group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      const deleted = await db.deleteGroup(groupId);
      
      if (deleted) {
        return ctx.reply(`✅ *Grupo deletado permanentemente!*

👥 ${group.group_name || 'Sem nome'}
🆔 ID: ${groupId}

O grupo foi removido completamente do banco de dados.`, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply('❌ Erro ao remover grupo.');
      }
    } catch (err) {
      console.error('Erro ao deletar grupo:', err);
      return ctx.reply('❌ Erro ao remover grupo.');
    }
  });

  // ===== HANDLERS PARA ENTREGA MANUAL (POR ID DO USUÁRIO) =====
  
  // Handler para entregar PRODUTO
  bot.action(/^manual_deliver_product:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('📦 Entregando produto...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      // Verificar sessão
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      if (!session || session.type !== 'entregar_txid' || !session.targetUserId) {
        return ctx.reply('❌ Sessão expirada. Tente novamente.');
      }
      
      const productId = ctx.match[1];
      const targetUserId = session.targetUserId;
      const targetUser = session.targetUser;
      
      // Limpar sessão
      delete global._SESSIONS[ctx.from.id];
      
      await ctx.reply('⏳ Buscando transação e preparando entrega...');
      
      // Buscar produto
      const product = await db.getProduct(productId, true);
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      // Entregar produto via Storage (mesmo fluxo do automático)
      await deliver.deliverProductFromStorage(targetUserId, productId, product.name);
      
      // Mensagem de sucesso
      return ctx.reply(`✅ *ENTREGA REALIZADA COM SUCESSO!*

👤 Usuário: ${targetUser.first_name}${targetUser.username ? ` (@${targetUser.username})` : ''}
🆔 ID: ${targetUserId}
📦 Produto: ${product.name}
💰 Valor: R$ ${product.price}

✅ Status: Entregue
📅 Data: ${new Date().toLocaleString('pt-BR')}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
      
    } catch (err) {
      console.error('Erro ao entregar produto manualmente:', err);
      return ctx.reply(`❌ Erro ao entregar produto: ${err.message}`);
    }
  });
  
  // Handler para entregar MEDIA PACK
  bot.action(/^manual_deliver_mediapack:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('📸 Entregando media pack...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      // Verificar sessão
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      if (!session || session.type !== 'entregar_txid' || !session.targetUserId) {
        return ctx.reply('❌ Sessão expirada. Tente novamente.');
      }
      
      const packId = ctx.match[1];
      const targetUserId = session.targetUserId;
      const targetUser = session.targetUser;
      
      // Limpar sessão
      delete global._SESSIONS[ctx.from.id];
      
      await ctx.reply('⏳ Buscando transação e preparando entrega...');
      
      // Buscar pack
      const pack = await db.getMediaPackById(packId);
      if (!pack) {
        return ctx.reply('❌ Media pack não encontrado.');
      }
      
      // Buscar a transação REAL do usuário para pegar o valor correto
      const { data: userTransactions } = await db.supabase
        .from('transactions')
        .select('*')
        .eq('telegram_id', targetUserId)
        .eq('media_pack_id', packId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      let actualAmount = pack.price; // Valor padrão
      let existingTransaction = null;
      
      if (userTransactions && userTransactions.length > 0) {
        existingTransaction = userTransactions[0];
        actualAmount = existingTransaction.amount;
        
        // Se a transação existe e está pendente/proof_sent, validar e entregar a original
        if (['pending', 'proof_sent', 'validated'].includes(existingTransaction.status)) {
          console.log(`✅ [MANUAL-DELIVERY] Usando transação existente ${existingTransaction.txid} com valor R$ ${actualAmount}`);
          
          // Validar se ainda não foi validada
          if (existingTransaction.status !== 'validated') {
            await db.validateTransaction(existingTransaction.txid, targetUser.id);
          }
          
          // Entregar usando a transação original
          await deliver.deliverMediaPack(
            targetUserId,
            packId,
            targetUser.id,
            existingTransaction.id,
            db
          );
          
          // Marcar como entregue
          await db.markAsDelivered(existingTransaction.txid);
          
          // Mensagem de sucesso
          return ctx.reply(`✅ *ENTREGA REALIZADA COM SUCESSO!*

👤 Usuário: ${targetUser.first_name}${targetUser.username ? ` (@${targetUser.username})` : ''}
🆔 ID: ${targetUserId}
📸 Media Pack: ${pack.name}
💰 Valor: R$ ${actualAmount}
🆔 TXID: ${existingTransaction.txid}

✅ Status: Entregue
📅 Data: ${new Date().toLocaleString('pt-BR')}`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
              ]]
            }
          });
        }
      } else {
        // Se não encontrou transação, usar o menor valor do variable_prices
        if (pack.variable_prices && pack.variable_prices.length > 0) {
          const prices = pack.variable_prices.map(p => parseFloat(p.price));
          actualAmount = Math.min(...prices);
          console.log(`ℹ️ [MANUAL-DELIVERY] Nenhuma transação encontrada, usando menor valor: R$ ${actualAmount}`);
        }
      }
      
      // Criar transação temporária apenas se não houver transação válida
      const tempTxid = `MANUAL_${Date.now()}_${targetUserId}`;
      const { data: tempTransaction, error: transError } = await db.supabase
        .from('transactions')
        .insert({
          txid: tempTxid,
          user_id: targetUser.id,
          telegram_id: targetUserId,
          media_pack_id: packId,
          amount: actualAmount,
          pix_key: 'MANUAL_DELIVERY',
          pix_payload: 'MANUAL_DELIVERY',
          status: 'delivered',
          validated_at: new Date().toISOString(),
          delivered_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (transError || !tempTransaction) {
        console.error('❌ [MANUAL-DELIVERY] Erro ao criar transação:', transError);
        throw new Error(`Erro ao criar transação temporária: ${transError?.message || 'Desconhecido'}`);
      }
      
      // Entregar media pack
      await deliver.deliverMediaPack(
        targetUserId,
        packId,
        targetUser.id,
        tempTransaction.id,
        db
      );
      
      // Mensagem de sucesso
      return ctx.reply(`✅ *ENTREGA REALIZADA COM SUCESSO!*

👤 Usuário: ${targetUser.first_name}${targetUser.username ? ` (@${targetUser.username})` : ''}
🆔 ID: ${targetUserId}
📸 Media Pack: ${pack.name}
💰 Valor: R$ ${actualAmount}
🆔 TXID: ${tempTxid}

✅ Status: Entregue
📅 Data: ${new Date().toLocaleString('pt-BR')}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
      
    } catch (err) {
      console.error('Erro ao entregar media pack manualmente:', err);
      return ctx.reply(`❌ Erro ao entregar media pack: ${err.message}`);
    }
  });
  
  // Handler para entregar GRUPO
  bot.action(/^manual_deliver_group:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('👥 Adicionando ao grupo...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      // Verificar sessão
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      if (!session || session.type !== 'entregar_txid' || !session.targetUserId) {
        return ctx.reply('❌ Sessão expirada. Tente novamente.');
      }
      
      const groupIdFromCallback = ctx.match[1];
      const targetUserId = session.targetUserId;
      const targetUser = session.targetUser;
      
      // Limpar sessão
      delete global._SESSIONS[ctx.from.id];
      
      await ctx.reply('⏳ Buscando transação e preparando entrega...');
      
      // Buscar grupo
      const { data: group, error: groupError } = await db.supabase
        .from('groups')
        .select('*')
        .eq('group_id', groupIdFromCallback)
        .single();
      
      if (groupError || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      // Adicionar ou renovar assinatura no banco
      await db.addGroupMember({
        telegramId: targetUserId,
        userId: targetUser.id,
        groupId: group.id,
        days: group.subscription_days
      });
      
      // Tentar adicionar usuário diretamente ao grupo
      await deliver.addUserToGroup(ctx.telegram, targetUserId, group);
      
      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
      
      // Notificar usuário
      await ctx.telegram.sendMessage(targetUserId, `✅ *ASSINATURA APROVADA!*

👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias
🕐 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}

${group.group_link ? `🔗 Link: ${group.group_link}` : ''}

Obrigado pela preferência! 💚`, {
        parse_mode: 'Markdown'
      });
      
      // Mensagem de sucesso para admin
      return ctx.reply(`✅ *ENTREGA REALIZADA COM SUCESSO!*

👤 Usuário: ${targetUser.first_name}${targetUser.username ? ` (@${targetUser.username})` : ''}
🆔 ID: ${targetUserId}
👥 Grupo: ${group.group_name}
💰 Valor: R$ ${group.subscription_price}
📅 Dias de acesso: ${group.subscription_days}

✅ Status: Entregue
📅 Data: ${new Date().toLocaleString('pt-BR')}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
      
    } catch (err) {
      console.error('Erro ao adicionar ao grupo manualmente:', err);
      return ctx.reply(`❌ Erro ao adicionar ao grupo: ${err.message}`);
    }
  });


}

module.exports = { registerPanelHandlers };
