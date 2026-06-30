// src/creator.js
// Painel do Criador - Acesso limitado (não é admin completo)

const { Markup } = require('telegraf');
const db = require('./database');

function registerCreatorCommands(bot) {
  console.log('🔧 [CREATOR-REGISTER] Registrando comando /criador...');
  
  // ===== COMANDO /criador =====
  bot.command('criador', async (ctx) => {
    console.log('🎯 [CREATOR] Handler /criador executado para:', ctx.from.id);
    try {
      console.log(`🔍 [CREATOR] Comando /criador recebido de: ${ctx.from.id} (@${ctx.from.username || 'sem username'})`);
      
      // Garantir que o usuário existe no banco
      await db.getOrCreateUser(ctx.from);
      
      // Verificar se é criador
      const isCreator = await db.isUserCreator(ctx.from.id);
      console.log(`🔍 [CREATOR] Usuário ${ctx.from.id} - isCreator: ${isCreator}`);
      
      if (!isCreator) {
        console.log(`❌ [CREATOR] Acesso negado para ${ctx.from.id}`);
        return ctx.reply('🔐 *Acesso Restrito*\n\nEste painel é exclusivo para criadores da plataforma.\n\n💬 Precisa de ajuda? Use /suporte', { parse_mode: 'Markdown' });
      }
      
      console.log(`✅ [CREATOR] Acesso permitido para ${ctx.from.id}`);
      
      // Buscar estatísticas em tempo real (apenas transações aprovadas para criadores)
      const stats = await db.getCreatorStats();
      const pendingCount = await db.getPendingTransactions(10, 0).then(result => result.total || 0);
      
      const message = `👑 *PAINEL DO CRIADOR*

📊 *ESTATÍSTICAS EM TEMPO REAL*

💳 *Transações Aprovadas:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pendingCount}
📅 *Este Mês:* R$ ${parseFloat(stats.monthSales || 0).toFixed(2)}
💰 *Vendas:* R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}

📅 *Hoje:*
💰 Vendas: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}
📦 Transações: ${stats.todayTransactions || 0}

━━━━━━━━━━━━━━━━━━━━━━━━

Selecione uma opção abaixo:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Estatísticas', 'creator_stats')],
        [Markup.button.callback('📢 CastCupom', 'creator_broadcast')],
        [Markup.button.callback('📈 Remarketing', 'creator_remarketing')],
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
      const stats = await db.getCreatorStats();
      const pendingResult = await db.getPendingTransactions(10, 0);
      const pending = pendingResult.data || [];
      
      const message = `📊 *ESTATÍSTICAS DETALHADAS*

💳 *Transações Aprovadas:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pendingResult.total || 0}

💰 *FINANCEIRO*
• Total Vendido: R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}
• Este Mês: R$ ${parseFloat(stats.monthSales || 0).toFixed(2)}
• Hoje: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}

📅 *PERÍODO*
• Transações Hoje: ${stats.todayTransactions || 0}
• Transações Este Mês: ${stats.monthTransactions || 0}

🔄 *Atualização:* Automática em tempo real
📅 *Última atualização:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

⏰ *Atualizado:* ${new Date().toLocaleString('pt-BR')}`;

      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📅 Ver Mês Anterior', 'creator_stats_prev_month')],
          [Markup.button.callback('🔄 Atualizar', 'creator_stats')],
          [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas.');
    }
  });
  
  // ===== ESTATÍSTICAS DO MÊS ANTERIOR =====
  bot.action('creator_stats_prev_month', async (ctx) => {
    await ctx.answerCbQuery('📅 Carregando mês anterior...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const stats = await db.getCreatorStats();
      
      const message = `📊 *ESTATÍSTICAS - MÊS ANTERIOR*

💰 *VENDAS*
• Total do Mês Anterior: R$ ${parseFloat(stats.prevMonthSales || 0).toFixed(2)}

📦 *TRANSAÇÕES*
• Total de Transações: ${stats.prevMonthTransactions || 0}

📅 *PERÍODO*
• Mês anterior (completo)

🔄 *Atualização:* Automática em tempo real
📅 *Última atualização:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

⏰ *Atualizado:* ${new Date().toLocaleString('pt-BR')}`;

      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📊 Ver Estatísticas Gerais', 'creator_stats')],
          [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao buscar estatísticas do mês anterior:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas do mês anterior.');
    }
  });
  
  // ===== LISTAR USUÁRIOS (REMOVIDO DO PAINEL - APENAS ADMIN) =====
  // Esta função foi removida do painel do criador por segurança
  
  // ===== CASTCUPOM (Broadcast + Cupom Unificado) =====
  bot.action('creator_broadcast', async (ctx) => {
    await ctx.answerCbQuery('📢 Preparando CastCupom...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      // Buscar produtos ativos
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();
      
      let message = `📢 *CASTCUPOM*

*Criar nova promoção:*

1️⃣ *Com Produto* - Associar produto
2️⃣ *Produto + Cupom* - Desconto automático

━━━━━━━━━━━━━━━━━━━━━━━━

*Gerenciar promoções ativas:*`;

      const buttons = [
        [Markup.button.callback('🛍️ Com Produto', 'creator_broadcast_product')],
        [Markup.button.callback('🎁 Produto + Cupom', 'creator_broadcast_product_coupon')],
        [Markup.button.callback('🗑️ Deletar Promoções', 'creator_delete_promotions')],
        [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
      ];
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro no broadcast:', err);
      return ctx.reply('❌ Erro ao carregar opções de broadcast.');
    }
  });
  
  // Broadcast Simples
  bot.action('creator_broadcast_simple', async (ctx) => {
    await ctx.answerCbQuery('📣 Iniciando broadcast simples...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'creator_broadcast',
      step: 'message',
      broadcastType: 'simple'
    };
    
    return ctx.editMessageText(`📢 *BROADCAST SIMPLES*

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
  
  // ===== BROADCAST COM PRODUTO — SELEÇÃO MÚLTIPLA =====
  bot.action('creator_broadcast_product', async (ctx) => {
    await ctx.answerCbQuery('🛍️ Carregando produtos...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;

    try {
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();

      if (products.length === 0 && mediaPacks.length === 0) {
        return ctx.editMessageText('📦 Nenhum produto disponível para broadcast.\n\nCrie produtos primeiro no painel admin.', {
          ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar', 'creator_broadcast')]])
        });
      }

      // Inicializar sessão de seleção múltipla
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'creator_broadcast_product_multi',
        step: 'select_products',
        selectedProducts: []
      };

      let message = `🛍️ *BROADCAST COM PRODUTO*\n\nSelecione os produtos que deseja divulgar:\n_(toque para marcar/desmarcar)_\n\n`;
      const buttons = [];

      for (const product of products) {
        message += `• ${product.name} — R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(`📦 ${product.name}`, `bpm_select_product:${product.product_id}`)]);
      }
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          message += `• ${pack.name} — R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(`📸 ${pack.name}`, `bpm_select_pack:${pack.pack_id}`)]);
        }
      }

      buttons.push(
        [Markup.button.callback('✅ Continuar', 'bpm_continue')],
        [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
      );

      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('[BPM] Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao listar produtos.');
    }
  });
  
  // Helper: re-renderiza lista de seleção BPM
  async function _renderBpmList(ctx, session) {
    try {
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();

      let message = `🛍️ *BROADCAST COM PRODUTO*\n\n`;
      if (session.selectedProducts.length > 0) {
        message += `*Selecionados (${session.selectedProducts.length}):*\n`;
        session.selectedProducts.forEach(p => { message += `✅ ${p.name} — R$ ${parseFloat(p.price).toFixed(2)}\n`; });
        message += `\n`;
      }
      message += `*Disponíveis:*\n`;

      const buttons = [];
      for (const product of products) {
        const isSel = session.selectedProducts.some(p => p.id === product.product_id && p.type === 'product');
        const icon = isSel ? '✅' : '📦';
        message += `${icon} ${product.name} — R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(`${icon} ${product.name}`, `bpm_select_product:${product.product_id}`)]);
      }
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          const isSel = session.selectedProducts.some(p => p.id === pack.pack_id && p.type === 'pack');
          const icon = isSel ? '✅' : '📸';
          message += `${icon} ${pack.name} — R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(`${icon} ${pack.name}`, `bpm_select_pack:${pack.pack_id}`)]);
        }
      }
      buttons.push(
        [Markup.button.callback('✅ Continuar', 'bpm_continue')],
        [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
      );
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    } catch (e) { console.error('[BPM] _renderBpmList erro:', e.message); }
  }

  // Toggle produto (BPM)
  bot.action(/^bpm_select_product:(.+)$/, async (ctx) => {
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_multi') {
      return ctx.answerCbQuery('❌ Sessão expirada', { show_alert: true });
    }
    const productId = ctx.match[1];
    const product = await db.getProduct(productId);
    if (!product) return ctx.answerCbQuery('❌ Produto não encontrado', { show_alert: true });
    const idx = session.selectedProducts.findIndex(p => p.id === productId && p.type === 'product');
    if (idx > -1) {
      session.selectedProducts.splice(idx, 1);
      await ctx.answerCbQuery(`❌ ${product.name} removido`);
    } else {
      session.selectedProducts.push({ id: productId, type: 'product', name: product.name, price: product.price });
      await ctx.answerCbQuery(`✅ ${product.name} selecionado`);
    }
    await _renderBpmList(ctx, session);
  });

  // Toggle media pack (BPM)
  bot.action(/^bpm_select_pack:(.+)$/, async (ctx) => {
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_multi') {
      return ctx.answerCbQuery('❌ Sessão expirada', { show_alert: true });
    }
    const packId = ctx.match[1];
    const pack = await db.getMediaPackById(packId);
    if (!pack) return ctx.answerCbQuery('❌ Pack não encontrado', { show_alert: true });
    const idx = session.selectedProducts.findIndex(p => p.id === packId && p.type === 'pack');
    if (idx > -1) {
      session.selectedProducts.splice(idx, 1);
      await ctx.answerCbQuery(`❌ ${pack.name} removido`);
    } else {
      session.selectedProducts.push({ id: packId, type: 'pack', name: pack.name, price: pack.price });
      await ctx.answerCbQuery(`✅ ${pack.name} selecionado`);
    }
    await _renderBpmList(ctx, session);
  });

  // Continuar para mensagem (BPM)
  bot.action('bpm_continue', async (ctx) => {
    await ctx.answerCbQuery();
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_multi') {
      return ctx.reply('❌ Sessão expirada. Tente novamente.');
    }
    if (session.selectedProducts.length === 0) {
      return ctx.answerCbQuery('❌ Selecione pelo menos um produto!', { show_alert: true });
    }
    session.step = 'message';
    const listaSel = session.selectedProducts.map(p =>
      `✅ ${p.name} — R$ ${parseFloat(p.price).toFixed(2)}`
    ).join('\n');
    return ctx.editMessageText(
      `🛍️ *BROADCAST COM PRODUTO*\n\n📦 *Selecionados:*\n${listaSel}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n📝 Escreva a *mensagem principal* do broadcast:\n\n💡 *Dica:* Seja impactante! Exemplos: 🔥 Promoção imperdível!, 🎁 Oferta especial só hoje!\n\n_Cancelar: /cancelar_`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]]) }
    );
  });

  // Confirmar e agendar (BPM)
  bot.action('confirm_bpm_broadcast', async (ctx) => {
    try { await ctx.answerCbQuery('🚀 Agendando broadcast...'); } catch (e) {}
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_multi' || session.step !== 'confirm') {
      return ctx.reply('❌ Sessão não encontrada. Tente novamente.');
    }
    try {
      const user = await db.getOrCreateUser(ctx.from);
      const productButtons = session.selectedProducts.map(p => {
        if (p.type === 'product') return [{ text: `🔥 ${p.name} 🛒`, callback_data: `buy:${p.id}` }];
        return [{ text: `🔥 ${p.name} 🛒`, callback_data: `buy_media:${p.id}` }];
      });
      const finalMessage =
        `${session.broadcastMessage}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _Oferta por tempo limitado!_`;
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .insert([{
          name: `CastCupom ${new Date().toLocaleDateString('pt-BR')}`,
          message: finalMessage,
          image_file_id: session.imageFileId || null,
          buttons_json: productButtons.length > 0 ? productButtons : null,
          creator_telegram_id: ctx.from.id,
          target_audience: 'all',
          status: 'pending',
          created_by: user.id
        }])
        .select().single();
      if (campaignError) throw campaignError;
      delete global._SESSIONS[ctx.from.id];
      const { count: totalUsers } = await db.supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_blocked', false);
      const prodNomes = session.selectedProducts.map(p => `• ${p.name}`).join('\n');
      return ctx.editMessageText(
        `✅ *CASTCUPOM AGENDADO!*\n\n` +
        `📨 Será enviado para *${totalUsers}* usuários.\n\n` +
        `📦 *Produtos no broadcast:*\n${prodNomes}\n\n` +
        `⏱️ O envio acontece em lotes a cada 2 minutos.\n` +
        `🔔 Você receberá uma notificação quando concluir.\n\n` +
        `🆔 Campanha: \`${campaign.id.substring(0, 8)}...\``,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Painel', 'creator_refresh')]]) }
      );
    } catch (err) {
      console.error('[BPM] Erro ao agendar:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Erro ao agendar CastCupom. Tente novamente.');
    }
  });

  // ===== BROADCAST + PRODUTO + CUPOM (NOVO) =====
  bot.action('creator_broadcast_product_coupon', async (ctx) => {
    await ctx.answerCbQuery('🎁 Carregando produtos...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();
      
      if (products.length === 0 && mediaPacks.length === 0) {
        return ctx.editMessageText('📦 Nenhum produto disponível para broadcast.\n\nCrie produtos primeiro no painel admin.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
          ])
        });
      }
      
      let message = `🎁 *BROADCAST + PRODUTO + CUPOM*

📝 *Como funciona:*
1. Escreva a mensagem do broadcast
2. Selecione os produtos que terão desconto
3. Defina o desconto para cada produto
4. Crie um cupom para compartilhar

*Usuários que recebem o broadcast:*
✅ Verão o preço com desconto automaticamente

*Novos usuários ou quem usar /start:*
🎟️ Poderão inserir o cupom manualmente

Selecione os produtos:

`;
      
      // Inicializar sessão
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'creator_broadcast_product_coupon',
        step: 'select_products',
        selectedProducts: [],
        productDiscounts: {}
      };
      
      const buttons = [];
      
      // Adicionar produtos
      for (const product of products) {
        message += `• ${product.name} - R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(
          `📦 ${product.name}`, 
          `bpc_select_product:${product.product_id}`
        )]);
      }
      
      // Adicionar media packs
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          message += `• ${pack.name} - R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(
            `📸 ${pack.name}`, 
            `bpc_select_pack:${pack.pack_id}`
          )]);
        }
      }
      
      buttons.push(
        [Markup.button.callback('✅ Continuar', 'bpc_continue_to_discounts')],
        [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
      );
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao iniciar broadcast com produto e cupom:', err);
      return ctx.reply('❌ Erro ao carregar produtos.');
    }
  });
  
  // Selecionar produto para broadcast + cupom
  bot.action(/^bpc_select_product:(.+)$/, async (ctx) => {
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_coupon') {
      await ctx.answerCbQuery('❌ Sessão expirada', { show_alert: true });
      return;
    }
    
    const productId = ctx.match[1];
    const product = await db.getProduct(productId);
    
    if (!product) {
      await ctx.answerCbQuery('❌ Produto não encontrado', { show_alert: true });
      return;
    }
    
    // Toggle seleção
    const index = session.selectedProducts.findIndex(p => p.id === productId && p.type === 'product');
    if (index > -1) {
      session.selectedProducts.splice(index, 1);
      delete session.productDiscounts[`product_${productId}`];
      await ctx.answerCbQuery(`❌ ${product.name} removido`);
    } else {
      session.selectedProducts.push({
        id: productId,
        type: 'product',
        name: product.name,
        price: product.price
      });
      await ctx.answerCbQuery(`✅ ${product.name} selecionado`);
    }
    
    // Atualizar mensagem
    try {
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();
      
      let message = `🎁 *BROADCAST + PRODUTO + CUPOM*

📝 *Produtos selecionados:* ${session.selectedProducts.length}

`;
      
      if (session.selectedProducts.length > 0) {
        message += `*Selecionados:*\n`;
        for (const item of session.selectedProducts) {
          message += `✅ ${item.name} - R$ ${parseFloat(item.price).toFixed(2)}\n`;
        }
        message += `\n`;
      }
      
      message += `*Disponíveis:*\n\n`;
      
      const buttons = [];
      
      for (const product of products) {
        const isSelected = session.selectedProducts.some(p => p.id === product.product_id && p.type === 'product');
        const icon = isSelected ? '✅' : '📦';
        message += `${icon} ${product.name} - R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(
          `${icon} ${product.name}`, 
          `bpc_select_product:${product.product_id}`
        )]);
      }
      
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          const isSelected = session.selectedProducts.some(p => p.id === pack.pack_id && p.type === 'pack');
          const icon = isSelected ? '✅' : '📸';
          message += `${icon} ${pack.name} - R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(
            `${icon} ${pack.name}`, 
            `bpc_select_pack:${pack.pack_id}`
          )]);
        }
      }
      
      buttons.push(
        [Markup.button.callback('✅ Continuar', 'bpc_continue_to_discounts')],
        [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
      );
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao atualizar seleção:', err);
    }
  });
  
  // Selecionar pack para broadcast + cupom
  bot.action(/^bpc_select_pack:(.+)$/, async (ctx) => {
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_coupon') {
      await ctx.answerCbQuery('❌ Sessão expirada', { show_alert: true });
      return;
    }
    
    const packId = ctx.match[1];
    const pack = await db.getMediaPackById(packId);
    
    if (!pack) {
      await ctx.answerCbQuery('❌ Pack não encontrado', { show_alert: true });
      return;
    }
    
    // Toggle seleção
    const index = session.selectedProducts.findIndex(p => p.id === packId && p.type === 'pack');
    if (index > -1) {
      session.selectedProducts.splice(index, 1);
      delete session.productDiscounts[`pack_${packId}`];
      await ctx.answerCbQuery(`❌ ${pack.name} removido`);
    } else {
      session.selectedProducts.push({
        id: packId,
        type: 'pack',
        name: pack.name,
        price: pack.price
      });
      await ctx.answerCbQuery(`✅ ${pack.name} selecionado`);
    }
    
    // Atualizar mensagem (mesmo código do handler de produtos)
    try {
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();
      
      let message = `🎁 *BROADCAST + PRODUTO + CUPOM*

📝 *Produtos selecionados:* ${session.selectedProducts.length}

`;
      
      if (session.selectedProducts.length > 0) {
        message += `*Selecionados:*\n`;
        for (const item of session.selectedProducts) {
          message += `✅ ${item.name} - R$ ${parseFloat(item.price).toFixed(2)}\n`;
        }
        message += `\n`;
      }
      
      message += `*Disponíveis:*\n\n`;
      
      const buttons = [];
      
      for (const product of products) {
        const isSelected = session.selectedProducts.some(p => p.id === product.product_id && p.type === 'product');
        const icon = isSelected ? '✅' : '📦';
        message += `${icon} ${product.name} - R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(
          `${icon} ${product.name}`, 
          `bpc_select_product:${product.product_id}`
        )]);
      }
      
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          const isSelected = session.selectedProducts.some(p => p.id === pack.pack_id && p.type === 'pack');
          const icon = isSelected ? '✅' : '📸';
          message += `${icon} ${pack.name} - R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(
            `${icon} ${pack.name}`, 
            `bpc_select_pack:${pack.pack_id}`
          )]);
        }
      }
      
      buttons.push(
        [Markup.button.callback('✅ Continuar', 'bpc_continue_to_discounts')],
        [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
      );
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao atualizar seleção:', err);
    }
  });
  
  // Continuar para definir descontos
  bot.action('bpc_continue_to_discounts', async (ctx) => {
    await ctx.answerCbQuery();
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_coupon') {
      return ctx.reply('❌ Sessão expirada. Tente novamente.');
    }
    
    if (session.selectedProducts.length === 0) {
      await ctx.answerCbQuery('❌ Selecione pelo menos um produto!', { show_alert: true });
      return;
    }
    
    // Avançar para definir descontos
    session.step = 'set_discounts';
    session.currentDiscountIndex = 0;
    
    const currentProduct = session.selectedProducts[0];
    
    return ctx.editMessageText(`🎁 *DEFINIR DESCONTOS*

📦 *Produto:* ${currentProduct.name}
💰 *Preço original:* R$ ${parseFloat(currentProduct.price).toFixed(2)}

*Passo ${session.currentDiscountIndex + 1}/${session.selectedProducts.length}*

Digite o *valor do desconto* em reais para este produto (ex: 5.00, 10.00, 15.50):

💡 *Dica:* O desconto será aplicado diretamente no valor (ex: R$ 21,90 - R$ 5,00 = R$ 16,90)

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
      ])
    });
  });
  
  // ===== PENDENTES (REMOVIDO DO PAINEL - APENAS ADMIN) =====
  // Esta função foi removida do painel do criador por segurança
  
  // Handler de texto removido - integrado no admin.js para evitar conflitos
  
  // Confirmar e enviar broadcast
  bot.action('confirm_creator_broadcast', async (ctx) => {
    // Responder ao callback query imediatamente (pode falhar se já expirou, mas não é crítico)
    try {
      await ctx.answerCbQuery('📢 Enviando broadcast...');
    } catch (err) {
      // Query pode ter expirado, mas não é crítico - apenas remove o loading do botão
      if (!err.message || !err.message.includes('query is too old')) {
        console.error('Erro ao responder callback query:', err.message);
      }
    }
    
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast' || session.step !== 'confirm') {
      return ctx.reply('❌ Sessão de broadcast não encontrada.');
    }
    
    try {
      const message = session.data.message;
      const user = await db.getOrCreateUser(ctx.from);

      // Montar botões se houver produto/pack
      let buttonsJson = null;
      if (session.broadcastType === 'product' && session.productId) {
        buttonsJson = [[{ text: `🛍️ Comprar ${session.productName}`, callback_data: `buy:${session.productId}` }]];
      } else if (session.broadcastType === 'media_pack' && session.mediaPackId) {
        buttonsJson = [[{ text: `📸 Comprar ${session.packName}`, callback_data: `buy_media:${session.mediaPackId}` }]];
      }

      // Salvar campanha como PENDING — o cron-job processa em lotes
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .insert([{
          name: `CastCupom ${new Date().toLocaleDateString('pt-BR')}`,
          message: message,
          product_id: session.productId || null,
          media_pack_id: session.mediaPackId || null,
          image_file_id: session.imageFileId || null,
          buttons_json: buttonsJson,
          creator_telegram_id: ctx.from.id,
          target_audience: 'all',
          status: 'pending',
          created_by: user.id
        }])
        .select()
        .single();

      if (campaignError) {
        console.error('Erro ao salvar campanha:', campaignError);
        throw campaignError;
      }

      delete global._SESSIONS[ctx.from.id];

      // Buscar total para informar o criador
      const { count: totalUsers } = await db.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_blocked', false);

      return ctx.editMessageText(
        `✅ *CASTCUPOM AGENDADO!*

` +
        `📨 Sua mensagem será enviada para *${totalUsers}* usuários.

` +
        `⏱️ O envio acontece em lotes a cada 2 minutos.
` +
        `🔔 Você receberá uma notificação quando concluir.

` +
        `🆔 Campanha: \`${campaign.id.substring(0, 8)}...\``,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Voltar ao Painel', 'creator_refresh')]
          ])
        }
      );

    } catch (err) {
      console.error('Erro ao agendar broadcast:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Erro ao agendar CastCupom. Tente novamente.');
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
  
  // ===== DELETAR PROMOÇÕES =====
  bot.action('creator_delete_promotions', async (ctx) => {
    await ctx.answerCbQuery('🗑️ Carregando promoções...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const user = await db.getOrCreateUser(ctx.from);
      
      // Buscar TODAS as campanhas do criador (incluindo "Com Produto" e "Produto + Cupom")
      const { data: campaigns, error } = await db.supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      if (!campaigns || campaigns.length === 0) {
        return ctx.editMessageText(`🗑️ *DELETAR PROMOÇÕES*

Nenhuma promoção encontrada.

Você ainda não criou nenhuma promoção com cupom.`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Voltar', 'creator_broadcast')]
          ])
        });
      }
      
      // Buscar cupons relacionados para cada campanha
      let message = `🗑️ *DELETAR PROMOÇÕES*

*Total:* ${campaigns.length} promoção(ões) ativa(s)

━━━━━━━━━━━━━━━━━━━━━━━━

`;
      
      const buttons = [];
      
      for (let i = 0; i < campaigns.length; i++) {
        const campaign = campaigns[i];
        const date = new Date(campaign.created_at);
        const dateStr = date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        // Buscar cupons ativos desta promoção
        // 1. Cupons com código manual (se houver coupon_code na campanha)
        // 2. Cupons automáticos (formato BROADCAST_{campaign_id}_{product_id})
        let activeCoupons = [];
        if (campaign.coupon_code) {
          const { data: manualCoupons } = await db.supabase
            .from('coupons')
            .select('code, discount_percentage, is_active, product_id, media_pack_id')
            .eq('code', campaign.coupon_code)
            .eq('is_active', true);
          if (manualCoupons) activeCoupons = activeCoupons.concat(manualCoupons);
        }
        
        // Buscar cupons automáticos (formato BROADCAST_{campaign_id}_*)
        const { data: autoCoupons } = await db.supabase
          .from('coupons')
          .select('code, discount_percentage, is_active, product_id, media_pack_id')
          .like('code', `BROADCAST_${campaign.id}_%`)
          .eq('is_active', true);
        if (autoCoupons) activeCoupons = activeCoupons.concat(autoCoupons);
        
        const couponsCount = activeCoupons?.length || 0;
        const couponStatus = couponsCount > 0 ? '✅ Ativa' : '❌ Inativa';
        
        message += `${i + 1}. *${campaign.name || 'Sem nome'}*\n`;
        message += `   📅 ${dateStr}\n`;
        message += `   🎟️ Cupom: \`${campaign.coupon_code || 'N/A'}\`\n`;
        message += `   📊 Status: ${couponStatus} (${couponsCount} cupom${couponsCount !== 1 ? 's' : ''} ativo${couponsCount !== 1 ? 's' : ''})\n`;
        message += `\n`;
        
        const displayName = campaign.name?.substring(0, 25) || campaign.coupon_code?.substring(0, 25) || 'Promoção';
        buttons.push([
          Markup.button.callback(
            `${couponsCount > 0 ? '✅' : '❌'} ${displayName}...`, 
            `select_promotion:${campaign.id}`
          )
        ]);
      }
      
      buttons.push([Markup.button.callback('🔙 Voltar', 'creator_broadcast')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro ao listar promoções:', err);
      return ctx.reply('❌ Erro ao carregar promoções.');
    }
  });
  
  // Selecionar promoção para gerenciar
  bot.action(/^select_promotion:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const campaignId = ctx.match[1];
    
    try {
      // Buscar campanha
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (campaignError || !campaign) {
        return ctx.reply('❌ Promoção não encontrada.');
      }
      
      // Verificar se é do criador
      const user = await db.getOrCreateUser(ctx.from);
      if (campaign.created_by !== user.id) {
        return ctx.reply('❌ Você não tem permissão.');
      }
      
      // Buscar TODOS os cupons relacionados (ativos e inativos)
      // 1. Cupons com código manual (se houver coupon_code na campanha)
      // 2. Cupons automáticos (formato BROADCAST_{campaign_id}_{product_id})
      let allCoupons = [];
      
      if (campaign.coupon_code) {
        const { data: manualCoupons } = await db.supabase
          .from('coupons')
          .select('code, discount_percentage, is_active, product_id, media_pack_id, created_at')
          .eq('code', campaign.coupon_code);
        if (manualCoupons) allCoupons = allCoupons.concat(manualCoupons);
      }
      
      // Buscar cupons automáticos (formato BROADCAST_{campaign_id}_*)
      const { data: autoCoupons } = await db.supabase
        .from('coupons')
        .select('code, discount_percentage, is_active, product_id, media_pack_id, created_at')
        .like('code', `BROADCAST_${campaign.id}_%`)
        .order('created_at', { ascending: false });
      if (autoCoupons) allCoupons = allCoupons.concat(autoCoupons);
      
      const activeCoupons = allCoupons?.filter(c => c.is_active) || [];
      const inactiveCoupons = allCoupons?.filter(c => !c.is_active) || [];
      
      const date = new Date(campaign.created_at);
      const dateStr = date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      let message = `🎟️ *PROMOÇÃO: ${campaign.name || campaign.coupon_code || 'Sem nome'}*

📅 *Criada em:* ${dateStr}
🎟️ *Cupom:* \`${campaign.coupon_code || 'N/A'}\`

━━━━━━━━━━━━━━━━━━━━━━━━

📊 *Cupons Criados:*

`;
      
      if (activeCoupons.length > 0) {
        message += `✅ *Ativos (${activeCoupons.length}):*\n`;
        activeCoupons.forEach((coupon, index) => {
          message += `   ${index + 1}. \`${coupon.code}\` - ${coupon.discount_percentage}% OFF\n`;
        });
        message += `\n`;
      }
      
      if (inactiveCoupons.length > 0) {
        message += `❌ *Inativos (${inactiveCoupons.length}):*\n`;
        inactiveCoupons.slice(0, 3).forEach((coupon, index) => {
          message += `   ${index + 1}. \`${coupon.code}\` - ${coupon.discount_percentage}% OFF\n`;
        });
        if (inactiveCoupons.length > 3) {
          message += `   ... e mais ${inactiveCoupons.length - 3} cupom(ns)\n`;
        }
        message += `\n`;
      }
      
      if (allCoupons?.length === 0) {
        message += `⚠️ Nenhum cupom encontrado para esta promoção.\n\n`;
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━

*O que deseja fazer?*`;
      
      const buttons = [];
      
      // Sempre mostrar opções de desativar e excluir
      if (activeCoupons.length > 0) {
        buttons.push([
          Markup.button.callback('❌ Desativar Promoção', `ask_deactivate:${campaignId}`)
        ]);
      }
      
      buttons.push([
        Markup.button.callback('🗑️ Excluir Promoção', `ask_delete:${campaignId}`)
      ]);
      
      buttons.push([Markup.button.callback('🔙 Voltar', 'creator_delete_promotions')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro ao carregar promoção:', err);
      return ctx.reply('❌ Erro ao carregar promoção.');
    }
  });
  
  // Perguntar confirmação para desativar
  bot.action(/^ask_deactivate:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const campaignId = ctx.match[1];
    
    try {
      const { data: campaign } = await db.supabase
        .from('broadcast_campaigns')
        .select('name, coupon_code')
        .eq('id', campaignId)
        .single();
      
      if (!campaign) {
        return ctx.reply('❌ Promoção não encontrada.');
      }
      
      return ctx.editMessageText(`⚠️ *CONFIRMAR DESATIVAÇÃO*

Você está prestes a *desativar* a promoção:

*Nome:* ${campaign.name || campaign.coupon_code || 'Sem nome'}
*Cupom:* \`${campaign.coupon_code || 'N/A'}\`

*O que será feito:*
❌ Todos os cupons serão desativados
📋 A promoção permanecerá no histórico
👥 Destinatários serão mantidos

*Os cupons não poderão mais ser usados.*

Deseja continuar?`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Sim, Desativar', `confirm_deactivate:${campaignId}`)],
          [Markup.button.callback('❌ Cancelar', `select_promotion:${campaignId}`)]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao preparar desativação:', err);
      return ctx.reply('❌ Erro ao preparar desativação.');
    }
  });
  
  // Confirmar e desativar cupons
  bot.action(/^confirm_deactivate:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('❌ Desativando...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const campaignId = ctx.match[1];
    
    try {
      // Buscar campanha
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (campaignError || !campaign) {
        return ctx.reply('❌ Promoção não encontrada.');
      }
      
      // Verificar permissão
      const user = await db.getOrCreateUser(ctx.from);
      if (campaign.created_by !== user.id) {
        return ctx.reply('❌ Você não tem permissão.');
      }
      
      // Buscar e desativar todos os cupons relacionados
      // 1. Cupons com código manual (se houver coupon_code)
      // 2. Cupons automáticos (formato BROADCAST_{campaign_id}_*)
      let relatedCouponIds = [];
      
      if (campaign.coupon_code) {
        const { data: manualCoupons } = await db.supabase
          .from('coupons')
          .select('id')
          .eq('code', campaign.coupon_code)
          .eq('is_active', true);
        if (manualCoupons) {
          relatedCouponIds = relatedCouponIds.concat(manualCoupons.map(c => c.id));
        }
      }
      
      // Buscar cupons automáticos (formato BROADCAST_{campaign_id}_*)
      const { data: autoCoupons } = await db.supabase
        .from('coupons')
        .select('id')
        .like('code', `BROADCAST_${campaign.id}_%`)
        .eq('is_active', true);
      if (autoCoupons) {
        relatedCouponIds = relatedCouponIds.concat(autoCoupons.map(c => c.id));
      }
      
      // Remover duplicatas
      relatedCouponIds = [...new Set(relatedCouponIds)];
      
      let deactivatedCount = 0;
      
      if (relatedCouponIds.length > 0) {
        const { error: updateError } = await db.supabase
          .from('coupons')
          .update({ is_active: false })
          .in('id', relatedCouponIds);
        
        if (updateError) {
          console.error('Erro ao desativar cupons:', updateError);
        } else {
          deactivatedCount = relatedCouponIds.length;
        }
      }
      
      return ctx.editMessageText(`✅ *PROMOÇÃO DESATIVADA!*

❌ ${deactivatedCount} cupom(ns) desativado(s)

A promoção foi desativada com sucesso. Os cupons não poderão mais ser usados.

*Nota:* A promoção permanece no histórico. Use "Excluir" para remover completamente.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar para Lista', 'creator_delete_promotions')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao desativar promoção:', err);
      return ctx.reply('❌ Erro ao desativar promoção.');
    }
  });
  
  // Perguntar confirmação para excluir
  bot.action(/^ask_delete:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const campaignId = ctx.match[1];
    
    try {
      const { data: campaign } = await db.supabase
        .from('broadcast_campaigns')
        .select('name, coupon_code, sent_count')
        .eq('id', campaignId)
        .single();
      
      if (!campaign) {
        return ctx.reply('❌ Promoção não encontrada.');
      }
      
      return ctx.editMessageText(`⚠️ *CONFIRMAR EXCLUSÃO*

Você está prestes a *excluir permanentemente* a promoção:

*Nome:* ${campaign.name || campaign.coupon_code || 'Sem nome'}
*Cupom:* \`${campaign.coupon_code || 'N/A'}\`
*Enviados:* ${campaign.sent_count || 0}

*O que será deletado:*
🗑️ Campanha de broadcast
🗑️ Registros de destinatários
❌ Cupons serão desativados

*Esta ação NÃO pode ser desfeita!*

Deseja continuar?`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Sim, Excluir', `confirm_delete:${campaignId}`)],
          [Markup.button.callback('❌ Cancelar', `select_promotion:${campaignId}`)]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao preparar exclusão:', err);
      return ctx.reply('❌ Erro ao preparar exclusão.');
    }
  });
  
  // Desativar cupons de um broadcast (mantido para compatibilidade)
  bot.action(/^deactivate_broadcast_coupons:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('❌ Desativando cupons...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const campaignId = ctx.match[1];
    
    try {
      // Buscar campanha
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (campaignError || !campaign) {
        return ctx.reply('❌ Broadcast não encontrado.');
      }
      
      // Verificar permissão
      const user = await db.getOrCreateUser(ctx.from);
      if (campaign.created_by !== user.id) {
        return ctx.reply('❌ Você não tem permissão.');
      }
      
      // Buscar todos os cupons relacionados ao broadcast
      // Cupons automáticos (is_broadcast_coupon = true) criados na mesma data
      const campaignDate = new Date(campaign.created_at);
      const startDate = new Date(campaignDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(campaignDate);
      endDate.setHours(23, 59, 59, 999);
      
      // Buscar cupons do código do broadcast ou cupons automáticos criados no mesmo dia
      const { data: allCoupons, error: couponsError } = await db.supabase
        .from('coupons')
        .select('*')
        .or(`code.eq.${campaign.coupon_code},is_broadcast_coupon.eq.true`)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (couponsError) {
        console.error('Erro ao buscar cupons:', couponsError);
      }
      
      let deactivatedCount = 0;
      
      if (allCoupons && allCoupons.length > 0) {
        // Desativar todos os cupons relacionados
        const couponIds = allCoupons.map(c => c.id);
        
        const { error: updateError } = await db.supabase
          .from('coupons')
          .update({ is_active: false })
          .in('id', couponIds);
        
        if (updateError) {
          console.error('Erro ao desativar cupons:', updateError);
        } else {
          deactivatedCount = allCoupons.length;
        }
      }
      
      return ctx.editMessageText(`✅ *CUPONS DESATIVADOS!*

❌ ${deactivatedCount} cupom(ns) desativado(s) com sucesso.

Os cupons relacionados a este broadcast foram desativados e não poderão mais ser usados.

*Nota:* O broadcast e os destinatários permanecem no banco de dados. Use "Excluir" para remover completamente.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', `select_promotion:${campaignId}`)]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao desativar cupons:', err);
      return ctx.reply('❌ Erro ao desativar cupons.');
    }
  });
  
  // Confirmar e executar exclusão
  bot.action(/^confirm_delete:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('🗑️ Deletando...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const campaignId = ctx.match[1];
    
    try {
      // Buscar campanha
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (campaignError || !campaign) {
        return ctx.reply('❌ Broadcast não encontrado.');
      }
      
      // Verificar permissão
      const user = await db.getOrCreateUser(ctx.from);
      if (campaign.created_by !== user.id) {
        return ctx.reply('❌ Você não tem permissão.');
      }
      
      // 1. Desativar TODOS os cupons relacionados ao broadcast
      // 1.1. Cupons com código manual (se houver coupon_code)
      // 1.2. Cupons automáticos (formato BROADCAST_{campaign_id}_*)
      
      let relatedCouponIds = [];
      
      // Primeiro: Buscar cupons com código manual (se houver coupon_code)
      if (campaign.coupon_code) {
        const { data: sameCodeCoupons, error: codeError } = await db.supabase
          .from('coupons')
          .select('id')
          .eq('code', campaign.coupon_code)
          .eq('is_active', true);

        if (!codeError && sameCodeCoupons && Array.isArray(sameCodeCoupons) && sameCodeCoupons.length > 0) {
          const codeCouponIds = sameCodeCoupons.map(c => c.id).filter(id => id != null);
          if (codeCouponIds.length > 0) {
            relatedCouponIds = relatedCouponIds.concat(codeCouponIds);
            console.log(`✅ ${codeCouponIds.length} cupom(ns) com código ${campaign.coupon_code} encontrado(s)`);
          }
        }
      }
      
      // Segundo: Buscar cupons automáticos (formato BROADCAST_{campaign_id}_*)
      const { data: autoCoupons, error: autoError } = await db.supabase
        .from('coupons')
        .select('id')
        .like('code', `BROADCAST_${campaign.id}_%`)
        .eq('is_active', true);
      
      if (!autoError && autoCoupons && Array.isArray(autoCoupons) && autoCoupons.length > 0) {
        const autoCouponIds = autoCoupons.map(c => c.id).filter(id => id != null);
        if (autoCouponIds.length > 0) {
          relatedCouponIds = relatedCouponIds.concat(autoCouponIds);
          console.log(`✅ ${autoCouponIds.length} cupom(ns) automático(s) encontrado(s)`);
        }
      }
      
      // Remover duplicatas e desativar todos de uma vez
      relatedCouponIds = Array.isArray(relatedCouponIds) ? [...new Set(relatedCouponIds)] : [];
      let deactivatedCount = 0;
      
      if (relatedCouponIds.length > 0) {
        const { error: updateAllError } = await db.supabase
          .from('coupons')
          .update({ is_active: false })
          .in('id', relatedCouponIds);
        
        if (!updateAllError) {
          deactivatedCount = relatedCouponIds.length;
          console.log(`✅ ${relatedCouponIds.length} cupom(ns) desativado(s) no total`);
        } else {
          console.error('Erro ao desativar cupons:', updateAllError);
        }
      }
      
      // 2. Deletar destinatários (cascade já faz isso, mas vamos garantir)
      await db.supabase
        .from('broadcast_recipients')
        .delete()
        .eq('broadcast_campaign_id', campaignId);
      
      // 3. Deletar campanha
      const { error: deleteError } = await db.supabase
        .from('broadcast_campaigns')
        .delete()
        .eq('id', campaignId);
      
      if (deleteError) {
        throw deleteError;
      }
      
      // Limpar sessão
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.editMessageText(`✅ *PROMOÇÃO EXCLUÍDA!*

🗑️ Campanha deletada
🗑️ Destinatários removidos
❌ ${deactivatedCount} cupom(ns) desativado(s)

A promoção foi completamente removida do sistema.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar para Lista', 'creator_delete_promotions')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao deletar broadcast:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Erro ao deletar broadcast.');
    }
  });
  
  // Confirmar e enviar broadcast + produto + cupom
  bot.action('confirm_bpc_broadcast', async (ctx) => {
    try {
      await ctx.answerCbQuery('🎁 Criando cupons e enviando...');
    } catch (err) {
      if (!err.message || !err.message.includes('query is too old')) {
        console.error('Erro ao responder callback query:', err.message);
      }
    }
    
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast_product_coupon' || session.step !== 'confirm') {
      return ctx.reply('❌ Sessão não encontrada.');
    }
    
    try {
      const user = await db.getOrCreateUser(ctx.from);
      const message = session.broadcastMessage;
      
      // Buscar todos os usuários desbloqueados
      const users = await db.getAllUnblockedUsers();
      
      if (users.length === 0) {
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Nenhum usuário desbloqueado encontrado.');
      }
      
      await ctx.editMessageText(`🎁 *ENVIANDO PROMOÇÃO...*

📨 Preparando envio para ${users.length} usuários desbloqueados...

⏳ Aguarde...`, {
        parse_mode: 'Markdown'
      });
      
      // Criar cupons automáticos para cada produto (apenas para quem recebeu)
      const broadcastCouponIds = [];
      
      // Salvar campanha de broadcast primeiro para ter o ID
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .insert([{
          name: `Promoção ${new Date().toLocaleDateString('pt-BR')}`,
          message: message,
          target_audience: 'all',
          status: 'sending',
          created_by: user.id
        }])
        .select()
        .single();
      
      if (campaignError) {
        console.error('Erro ao salvar campanha:', campaignError);
      }
      
      // Criar cupons automáticos para cada produto (relacionados à campanha)
      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        const discount = session.productDiscounts[key];
        
        // Criar cupom automático para broadcast (sem código manual)
        const autoCouponCode = `BROADCAST_${campaign?.id || Date.now()}_${product.id}`;
        
        const { data: autoCoupon, error: autoCouponError } = await db.supabase
          .from('coupons')
          .insert([{
            code: autoCouponCode,
            discount_percentage: discount,
            product_id: product.type === 'product' ? product.id : null,
            media_pack_id: product.type === 'pack' ? product.id : null,
            is_active: true,
            is_broadcast_coupon: true,
            created_by: user.id
          }])
          .select()
          .single();
        
        if (autoCouponError) {
          console.error('Erro ao criar cupom automático:', autoCouponError);
          continue;
        }
        
        broadcastCouponIds.push(autoCoupon.id);
      }
      
      // Preparar botões com produtos e descontos
      const productButtons = [];
      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        const discPercent = session.productDiscounts[key];
        const discValue = session.productDiscountValues?.[key] || (parseFloat(product.price) * discPercent / 100);
        const discountedPrice = parseFloat(product.price) - discValue;
        const discountDisplay = Math.round(discPercent);
        if (product.type === 'product') {
          productButtons.push([{ text: `🛍️ ${product.name} - R$ ${discountedPrice.toFixed(2)} (${discountDisplay}% OFF)`, callback_data: `buy:${product.id}` }]);
        } else {
          productButtons.push([{ text: `📸 ${product.name} - R$ ${discountedPrice.toFixed(2)} (${discountDisplay}% OFF)`, callback_data: `buy_media:${product.id}` }]);
        }
      }

      // Atualizar campanha como PENDING com imagem e botões — cron-job processa em lotes
      await db.supabase
        .from('broadcast_campaigns')
        .update({
          status: 'pending',
          image_file_id: session.imageFileId || null,
          buttons_json: productButtons.length > 0 ? productButtons : null,
          creator_telegram_id: ctx.from.id
        })
        .eq('id', campaign.id);

      delete global._SESSIONS[ctx.from.id];

      // Buscar total para informar
      const { count: totalUsers } = await db.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_blocked', false);

      let agendadoMsg =
        `✅ *CASTCUPOM AGENDADO!*

` +
        `📨 Sua promoção será enviada para *${totalUsers}* usuários.

` +
        `📦 *Produtos com desconto:*
`;

      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        agendadoMsg += `• ${product.name} - ${session.productDiscounts[key]}% OFF
`;
      }

      agendadoMsg +=
        `
⏱️ O envio acontece em lotes a cada 2 minutos.
` +
        `🔔 Você receberá uma notificação quando concluir.`;

      return ctx.editMessageText(agendadoMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar ao Painel', 'creator_refresh')]
        ])
      });

    } catch (err) {
      console.error('Erro no broadcast + cupom:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Erro ao agendar CastCupom.');
    }
  });
  
  // ===== ATUALIZAR PAINEL =====
  // ===== REMARKETING — visão geral e disparo manual =====
  bot.action('creator_remarketing', async (ctx) => {
    await ctx.answerCbQuery('📈 Carregando...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;

    try {
      const sb = db.supabase;
      const [
        { count: totalUsers },
        { count: totalCompradores },
        { count: noMotor },
        { count: optOuts },
        { count: convertidos },
        { count: coldAtivos },
        { count: warmAtivos },
        { count: buyerAtivos },
        { data: ultimoEnvio }
      ] = await Promise.all([
        sb.from('users').select('*', { count: 'exact', head: true }).eq('is_blocked', false),
        sb.from('transactions').select('telegram_id', { count: 'exact', head: true }).eq('status', 'delivered'),
        sb.from('remarketing_log').select('*', { count: 'exact', head: true }),
        sb.from('remarketing_log').select('*', { count: 'exact', head: true }).eq('opted_out', true),
        sb.from('remarketing_log').select('*', { count: 'exact', head: true }).eq('converted', true),
        sb.from('remarketing_log').select('*', { count: 'exact', head: true }).eq('segment', 'cold').eq('opted_out', false).eq('converted', false),
        sb.from('remarketing_log').select('*', { count: 'exact', head: true }).eq('segment', 'warm').eq('opted_out', false).eq('converted', false),
        sb.from('remarketing_log').select('*', { count: 'exact', head: true }).eq('segment', 'buyer').eq('opted_out', false).eq('converted', false),
        sb.from('remarketing_log').select('last_sent_at').order('last_sent_at', { ascending: false }).limit(1)
      ]);

      const lastCycleAt = ultimoEnvio?.[0]?.last_sent_at;
      let statusLine = '🔴 Motor nunca rodou ainda';
      if (lastCycleAt) {
        const minsAgo = Math.round((Date.now() - new Date(lastCycleAt).getTime()) / 60000);
        const txt = minsAgo < 60 ? `${minsAgo} min` : `${Math.round(minsAgo / 60)}h`;
        statusLine = minsAgo <= 20 ? `🟢 Motor ativo — último ciclo há ${txt}` : `🟡 Motor pausado — último ciclo há ${txt}`;
      }

      const message = `📈 *REMARKETING AUTOMÁTICO*

${statusLine}

❄️ *Cold* (nunca comprou): ${coldAtivos || 0} no funil
🔥 *Warm* (abandonou PIX): ${warmAtivos || 0} no funil
💎 *Buyer* (upsell): ${buyerAtivos || 0} no funil

👥 Usuários ativos: ${totalUsers || 0}
💳 Já compraram: ${totalCompradores || 0}
🎯 No motor: ${noMotor || 0}
✅ Convertidos: ${convertidos || 0}
🚫 Opt-outs: ${optOuts || 0}

━━━━━━━━━━━━━━━━━━━━━━━━

Roda sozinho a cada 10 min (8h–22h BR). Use o botão abaixo para forçar um ciclo agora.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('▶ Disparar ciclo agora', 'creator_remarketing_run')],
        [Markup.button.callback('🔄 Atualizar', 'creator_remarketing')],
        [Markup.button.callback('⬅ Voltar', 'creator_refresh')]
      ]);

      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } catch (editError) {
          if (editError.response?.error_code === 400 && editError.response?.description?.includes('message is not modified')) return;
          throw editError;
        }
      }
      return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('❌ [CREATOR-REMARKETING] Erro:', err.message);
      return ctx.reply('❌ Erro ao carregar dados de remarketing.');
    }
  });

  // ===== REMARKETING — disparo manual do ciclo =====
  bot.action('creator_remarketing_run', async (ctx) => {
    await ctx.answerCbQuery('▶ Disparando ciclo...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;

    try {
      await ctx.reply('⏳ Disparando ciclo de remarketing, aguarde...');

      const { COLD, WARM, BUYER } = require('../remarketing/Templates');
      const { send } = require('../remarketing/Sender');
      const {
        getColdBatch, getWarmBatch, getBuyerBatch,
        upsertLog, optOut, getRandomImage,
      } = require('../remarketing/Segments');

      const sb = db.supabase;
      const BR_TZ_OFFSET = -3;
      const DELAY_MS = 800;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const isBRBusinessHour = () => {
        const utcHour = new Date().getUTCHours();
        const brHour = ((utcHour + BR_TZ_OFFSET + 24) % 24);
        return brHour >= 8 && brHour < 22;
      };
      const makeButton = (productId, label) => {
        const botName = process.env.BOT_USERNAME || '';
        const url = botName
          ? `https://t.me/${botName}?start=produto_${productId}`
          : `https://t.me/${process.env.TELEGRAM_BOT_TOKEN.split(':')[0]}?start=produto_${productId}`;
        return [[{ text: label || '🛒 Comprar agora', url }]];
      };

      if (!isBRBusinessHour()) {
        return ctx.reply('⏸ Fora do horário comercial (8h–22h BR). O ciclo automático só envia mensagens nesse intervalo.');
      }

      const startedAt = Date.now();
      const MAX_RUNTIME_MS = 25000; // margem segura dentro do timeout do bot
      const timeLeft = () => MAX_RUNTIME_MS - (Date.now() - startedAt);

      const coldList  = (await getColdBatch()).slice(0, 10);
      const warmList  = (await getWarmBatch()).slice(0, 10);
      const buyerList = (await getBuyerBatch()).slice(0, 10);

      let sentCold = 0, sentWarm = 0, sentBuyer = 0;
      const COLD_INTERVALS  = [6, 6, 6, 12, 24];
      const WARM_INTERVALS  = [2, 8, 24];
      const BUYER_INTERVALS = [24, 72, 168, 360];

      for (const u of coldList) {
        if (timeLeft() < 5000) break;
        const log_entry = u.remarketing_log?.[0];
        const step = log_entry?.sequence_step ?? 0;
        const template = COLD[Math.min(step, COLD.length - 1)];
        const text = template.text(u.first_name || '');
        const interval = COLD_INTERVALS[Math.min(step, COLD_INTERVALS.length - 1)];
        const imageUrl = await getRandomImage('pack_premium');
        const buttons = makeButton(template.product, '🛒 Ver produtos');
        try {
          await send(u.telegram_id, text, imageUrl, buttons);
          await upsertLog(u.telegram_id, 'cold', step, interval);
          sentCold++;
        } catch (err) {
          if (err.tgCode === 403) {
            await optOut(u.telegram_id);
            await sb.from('users').update({ is_blocked: true }).eq('telegram_id', u.telegram_id);
          }
        }
        await sleep(DELAY_MS);
      }

      for (const r of warmList) {
        if (timeLeft() < 5000) break;
        const u = r.users || r;
        const log_entry = r.remarketing_log?.[0];
        const step = log_entry?.sequence_step ?? 0;
        const template = WARM[Math.min(step, WARM.length - 1)];
        const text = template.text(u.first_name || r.first_name || '');
        const product = r.product_id || r.media_pack_id || 'pack_premium';
        const interval = WARM_INTERVALS[Math.min(step, WARM_INTERVALS.length - 1)];
        const imageUrl = await getRandomImage('pack_premium');
        const buttons = makeButton(product, '⚡ Finalizar compra');
        try {
          await send(r.telegram_id, text, imageUrl, buttons);
          await upsertLog(r.telegram_id, 'warm', step, interval);
          sentWarm++;
        } catch (err) {
          if (err.tgCode === 403) {
            await optOut(r.telegram_id);
            await sb.from('users').update({ is_blocked: true }).eq('telegram_id', r.telegram_id);
          }
        }
        await sleep(DELAY_MS);
      }

      for (const r of buyerList) {
        if (timeLeft() < 5000) break;
        const u = r.users || r;
        const log_entry = r.remarketing_log?.[0];
        const step = log_entry?.sequence_step ?? 0;
        const template = BUYER[Math.min(step, BUYER.length - 1)];
        const text = template.text(u.first_name || '', r.product_id);
        const product = template.forcedProduct || r.product_id || 'destaquesdasemana';
        const interval = BUYER_INTERVALS[Math.min(step, BUYER_INTERVALS.length - 1)];
        const imageUrl = await getRandomImage('pack_premium');
        const buttons = makeButton(product, '✨ Ver novidades');
        try {
          await send(r.telegram_id, text, imageUrl, buttons);
          await upsertLog(r.telegram_id, 'buyer', step, interval);
          sentBuyer++;
        } catch (err) {
          if (err.tgCode === 403) {
            await optOut(r.telegram_id);
            await sb.from('users').update({ is_blocked: true }).eq('telegram_id', r.telegram_id);
          }
        }
        await sleep(DELAY_MS);
      }

      const total = sentCold + sentWarm + sentBuyer;
      return ctx.reply(`✅ *Ciclo concluído!*\n\n❄️ Cold: ${sentCold}\n🔥 Warm: ${sentWarm}\n💎 Buyer: ${sentBuyer}\n\n📤 Total enviado: ${total}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('❌ [CREATOR-REMARKETING-RUN] Erro:', err.message);
      return ctx.reply('❌ Erro ao disparar ciclo: ' + err.message);
    }
  });

  bot.action('creator_refresh', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Atualizando...');
      
      const isCreator = await db.isUserCreator(ctx.from.id);
      if (!isCreator) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      // Buscar estatísticas em tempo real
      const stats = await db.getCreatorStats();
      const pendingResult = await db.getPendingTransactions(10, 0);
      const pendingCount = pendingResult.total || 0;
      
      const message = `👑 *PAINEL DO CRIADOR*

📊 *ESTATÍSTICAS EM TEMPO REAL*

💳 *Transações Aprovadas:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pendingCount}
📅 *Este Mês:* R$ ${parseFloat(stats.monthSales || 0).toFixed(2)}
💰 *Vendas:* R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}

📅 *Hoje:*
💰 Vendas: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}
📦 Transações: ${stats.todayTransactions || 0}

━━━━━━━━━━━━━━━━━━━━━━━━

Selecione uma opção abaixo:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Estatísticas', 'creator_stats')],
        [Markup.button.callback('📢 CastCupom', 'creator_broadcast')],
        [Markup.button.callback('📈 Remarketing', 'creator_remarketing')],
        [Markup.button.callback('🔄 Atualizar', 'creator_refresh')]
      ]);
      
      // Editar a mensagem existente ao invés de criar um update manual
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          return await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
        } catch (editError) {
          // Se o conteúdo for exatamente o mesmo, o Telegram retorna erro 400
          // Nesse caso, apenas confirmamos que recebemos o callback
          if (editError.response && editError.response.error_code === 400 && 
              editError.response.description && editError.response.description.includes('message is not modified')) {
            // Mensagem já está atualizada, apenas confirmar
            return;
          }
          // Outro tipo de erro, relançar
          throw editError;
        }
      } else {
        return ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
    } catch (err) {
      console.error('❌ [CREATOR-REFRESH] Erro:', err);
      // Tentar responder ao callback mesmo em caso de erro
      try {
        await ctx.answerCbQuery('❌ Erro ao atualizar. Tente novamente.');
      } catch (answerError) {
        // Callback pode ter expirado, não é crítico
      }
    }
  });
}

module.exports = { registerCreatorCommands };
