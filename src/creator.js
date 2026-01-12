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
        return ctx.reply('❌ Acesso negado. Você não tem permissão para acessar o painel do criador.');
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
  
  // Broadcast com Produto
  bot.action('creator_broadcast_product', async (ctx) => {
    await ctx.answerCbQuery('🛍️ Carregando produtos...');
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
      
      let message = `🛍️ *BROADCAST COM PRODUTO*

Selecione o produto que deseja divulgar:

`;
      
      const buttons = [];
      
      // Adicionar produtos
      for (const product of products) {
        message += `• ${product.name} - R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(
          `📦 ${product.name}`, 
          `creator_broadcast_select_product:${product.product_id}`
        )]);
      }
      
      // Adicionar media packs
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          message += `• ${pack.name} - R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(
            `📸 ${pack.name}`, 
            `creator_broadcast_select_pack:${pack.pack_id}`
          )]);
        }
      }
      
      buttons.push([Markup.button.callback('🔙 Voltar', 'creator_broadcast')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao listar produtos.');
    }
  });
  
  // Selecionar produto para broadcast
  bot.action(/^creator_broadcast_select_product:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('✅ Produto selecionado');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const productId = ctx.match[1];
    const product = await db.getProduct(productId);
    
    if (!product) {
      return ctx.reply('❌ Produto não encontrado.');
    }
    
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'creator_broadcast',
      step: 'message',
      broadcastType: 'product',
      productId: productId,
      productName: product.name,
      productPrice: product.price
    };
    
    return ctx.editMessageText(`🛍️ *BROADCAST: ${product.name}*

💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}

📝 Agora envie a mensagem promocional:

💡 *Exemplo:*
"🔥 *BLACK FRIDAY 90% OFF!*

${product.name} por apenas R$ ${parseFloat(product.price).toFixed(2)}!

Promoção válida apenas hoje! 🎉

Compre agora: /start"

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
      ])
    });
  });
  
  // Selecionar media pack para broadcast
  bot.action(/^creator_broadcast_select_pack:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('✅ Pack selecionado');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const packId = ctx.match[1];
    const pack = await db.getMediaPackById(packId);
    
    if (!pack) {
      return ctx.reply('❌ Pack não encontrado.');
    }
    
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'creator_broadcast',
      step: 'message',
      broadcastType: 'media_pack',
      mediaPackId: packId,
      packName: pack.name,
      packPrice: pack.price
    };
    
    return ctx.editMessageText(`📸 *BROADCAST: ${pack.name}*

💰 Preço: R$ ${parseFloat(pack.price).toFixed(2)}

📝 Agora envie a mensagem promocional:

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
      ])
    });
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
      
      // Buscar apenas usuários que já compraram e estão desbloqueados
      const users = await db.getActiveBuyers();
      
      if (users.length === 0) {
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Nenhum comprador ativo encontrado para enviar o broadcast.');
      }
      
      // Salvar campanha de broadcast no banco
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .insert([{
          name: `Broadcast ${new Date().toLocaleDateString('pt-BR')}`,
          message: message,
          product_id: session.productId || null,
          media_pack_id: session.mediaPackId || null,
          target_audience: 'all',
          status: 'sending',
          created_by: user.id
        }])
        .select()
        .single();
      
      if (campaignError) {
        console.error('Erro ao salvar campanha:', campaignError);
      }
      
      await ctx.editMessageText(`📢 *ENVIANDO BROADCAST...*

📨 Mensagem sendo enviada para ${users.length} compradores ativos...

✅ Apenas usuários que já compraram e estão desbloqueados

⏳ Aguarde...`, {
        parse_mode: 'Markdown'
      });
      
      let success = 0;
      let failed = 0;
      
      // Adicionar botão com link para o produto (se houver)
      let replyMarkup = undefined;
      if (session.broadcastType === 'product' && session.productId) {
        replyMarkup = {
          inline_keyboard: [
            [{ text: `🛍️ Comprar ${session.productName}`, callback_data: `buy:${session.productId}` }]
          ]
        };
      } else if (session.broadcastType === 'media_pack' && session.mediaPackId) {
        replyMarkup = {
          inline_keyboard: [
            [{ text: `📸 Comprar ${session.packName}`, callback_data: `buy_media:${session.mediaPackId}` }]
          ]
        };
      }
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, {
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          });
          success++;
          
          // Delay para evitar flood
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (err) {
          failed++;
          // Não logar como erro se for um caso esperado (comportamento normal)
          const errorMessage = err.message || '';
          const isExpectedError = 
            errorMessage.includes('bot was blocked by the user') ||
            errorMessage.includes('user is deactivated') ||
            errorMessage.includes('chat not found') ||
            errorMessage.includes('user not found') ||
            errorMessage.includes('chat_id is empty');
          
          if (isExpectedError) {
            // Silencioso - apenas contar como falha (comportamento esperado)
          } else {
            // Logar apenas erros reais (não relacionados a usuários inativos)
            console.error(`❌ [CREATOR-BROADCAST] Erro ao enviar para ${user.telegram_id}:`, err.message);
          }
        }
      }
      
      // Atualizar campanha com resultado
      if (campaign) {
        await db.supabase
          .from('broadcast_campaigns')
          .update({
            sent_count: success,
            failed_count: failed,
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', campaign.id);
      }
      
      delete global._SESSIONS[ctx.from.id];
      
      let resultMessage = `✅ *BROADCAST CONCLUÍDO!*

📊 *Estatísticas:*
✅ Enviados: ${success}
❌ Falhas: ${failed}
📝 Total de compradores ativos: ${users.length}

💡 *Nota:* Enviado apenas para usuários que já compraram e estão desbloqueados.`;

      if (session.broadcastType === 'product' && session.productName) {
        resultMessage += `\n\n📦 *Produto divulgado:* ${session.productName}`;
      } else if (session.broadcastType === 'media_pack' && session.packName) {
        resultMessage += `\n\n📸 *Pack divulgado:* ${session.packName}`;
      }

      resultMessage += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n_Mensagem enviada com sucesso!_`;
      
      return ctx.editMessageText(resultMessage, {
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
  
  // ===== DELETAR PROMOÇÕES =====
  bot.action('creator_delete_promotions', async (ctx) => {
    await ctx.answerCbQuery('🗑️ Carregando promoções...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const user = await db.getOrCreateUser(ctx.from);
      
      // Buscar broadcasts com cupons (promoções) do criador
      const { data: campaigns, error } = await db.supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('created_by', user.id)
        .not('coupon_code', 'is', null)
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
        const { data: activeCoupons } = await db.supabase
          .from('coupons')
          .select('code, discount_percentage, is_active')
          .or(`code.eq.${campaign.coupon_code},is_broadcast_coupon.eq.true`)
          .eq('is_active', true)
          .limit(5);
        
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
      const campaignDate = new Date(campaign.created_at);
      const startDate = new Date(campaignDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(campaignDate);
      endDate.setHours(23, 59, 59, 999);
      
      const { data: allCoupons, error: couponsError } = await db.supabase
        .from('coupons')
        .select('code, discount_percentage, is_active, product_id, media_pack_id, created_at')
        .or(`code.eq.${campaign.coupon_code},is_broadcast_coupon.eq.true`)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
      
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
      const campaignDate = new Date(campaign.created_at);
      const startDate = new Date(campaignDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(campaignDate);
      endDate.setHours(23, 59, 59, 999);
      
      let couponConditions = [];
      if (campaign.coupon_code) {
        couponConditions.push(`code.eq.${campaign.coupon_code}`);
      }
      if (campaign.product_id) {
        couponConditions.push(`product_id.eq.${campaign.product_id}`);
      }
      if (campaign.media_pack_id) {
        couponConditions.push(`media_pack_id.eq.${campaign.media_pack_id}`);
      }
      
      const { data: relatedCoupons } = await db.supabase
        .from('coupons')
        .select('id')
        .or(couponConditions.length > 0 ? couponConditions.join(',') : 'is_broadcast_coupon.eq.true')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      let deactivatedCount = 0;
      
      if (relatedCoupons && relatedCoupons.length > 0) {
        const couponIds = relatedCoupons.map(c => c.id);
        
        const { error: updateError } = await db.supabase
          .from('coupons')
          .update({ is_active: false })
          .in('id', couponIds);
        
        if (updateError) {
          console.error('Erro ao desativar cupons:', updateError);
        } else {
          deactivatedCount = relatedCoupons.length;
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
      // IMPORTANTE: Desativar por código (todos os cupons com mesmo código, independente da data)
      // E também cupons automáticos do mesmo produto/pack criados no mesmo dia
      
      let deactivatedCount = 0;
      
      // Primeiro: Desativar TODOS os cupons com o mesmo código (manuais e automáticos)
      if (campaign.coupon_code) {
        const { data: sameCodeCoupons, error: codeError } = await db.supabase
          .from('coupons')
          .select('id')
          .eq('code', campaign.coupon_code)
          .eq('is_active', true);
        
        if (!codeError && sameCodeCoupons && sameCodeCoupons.length > 0) {
          const codeCouponIds = sameCodeCoupons.map(c => c.id);
          
          const { error: updateCodeError } = await db.supabase
            .from('coupons')
            .update({ is_active: false })
            .in('id', codeCouponIds);
          
          if (!updateCodeError) {
            deactivatedCount += codeCouponIds.length;
            console.log(`✅ ${codeCouponIds.length} cupom(ns) com código ${campaign.coupon_code} desativado(s)`);
          }
        }
      }
      
      // Segundo: Desativar cupons automáticos do mesmo produto/pack criados no mesmo dia
      const campaignDate = new Date(campaign.created_at);
      const startDate = new Date(campaignDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(campaignDate);
      endDate.setHours(23, 59, 59, 999);
      
      let autoCouponConditions = ['is_broadcast_coupon.eq.true'];
      
      if (campaign.product_id) {
        autoCouponConditions.push(`product_id.eq.${campaign.product_id}`);
      }
      if (campaign.media_pack_id) {
        autoCouponConditions.push(`media_pack_id.eq.${campaign.media_pack_id}`);
      }
      
      const { data: autoCoupons, error: autoError } = await db.supabase
        .from('coupons')
        .select('id')
        .or(autoCouponConditions.join(','))
        .eq('is_active', true)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (!autoError && autoCoupons && autoCoupons.length > 0) {
        const autoCouponIds = autoCoupons.map(c => c.id);
        
        const { error: updateAutoError } = await db.supabase
          .from('coupons')
          .update({ is_active: false })
          .in('id', autoCouponIds);
        
        if (!updateAutoError) {
          deactivatedCount += autoCouponIds.length;
          console.log(`✅ ${autoCouponIds.length} cupom(ns) automático(s) desativado(s)`);
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
      
      // Registrar usuários que receberão o broadcast
      const broadcastRecipients = [];
      for (const recipient of users) {
        broadcastRecipients.push({
          telegram_id: recipient.telegram_id,
          broadcast_campaign_id: campaign?.id || null
        });
      }
      
      if (broadcastRecipients.length > 0) {
        const { error: recipientsError } = await db.supabase
          .from('broadcast_recipients')
          .insert(broadcastRecipients);
        
        if (recipientsError) {
          console.error('Erro ao registrar destinatários:', recipientsError);
        }
      }
      
      // Preparar mensagem com produtos em botões
      const productButtons = [];
      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        const discPercent = session.productDiscounts[key];
        const discValue = session.productDiscountValues?.[key] || (parseFloat(product.price) * discPercent / 100);
        const originalPrice = parseFloat(product.price);
        const discountedPrice = originalPrice - discValue;
        
        // Formatar desconto como número inteiro seguido de %
        const discountDisplay = Math.round(discPercent);
        
        if (product.type === 'product') {
          productButtons.push([Markup.button.callback(
            `🛍️ ${product.name} - R$ ${discountedPrice.toFixed(2)} (${discountDisplay}%)`,
            `buy:${product.id}`
          )]);
        } else {
          productButtons.push([Markup.button.callback(
            `📸 ${product.name} - R$ ${discountedPrice.toFixed(2)} (${discountDisplay}%)`,
            `buy_media:${product.id}`
          )]);
        }
      }
      
      // Enviar broadcast
      let success = 0;
      let failed = 0;
      
      for (const recipient of users) {
        try {
          // Enviar imagem primeiro (se houver)
          if (session.imageFileId) {
            await ctx.telegram.sendPhoto(recipient.telegram_id, session.imageFileId, {
              caption: message,
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard(productButtons).reply_markup
            });
          } else {
            // Se não tiver imagem, enviar apenas mensagem com produtos
            await ctx.telegram.sendMessage(recipient.telegram_id, message, {
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard(productButtons).reply_markup
            });
          }
          success++;
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (err) {
          failed++;
          // Não logar como erro se for um caso esperado (comportamento normal)
          const errorMessage = err.message || '';
          const isExpectedError = 
            errorMessage.includes('bot was blocked by the user') ||
            errorMessage.includes('user is deactivated') ||
            errorMessage.includes('chat not found') ||
            errorMessage.includes('user not found') ||
            errorMessage.includes('chat_id is empty') ||
            errorMessage.includes('bot was blocked') ||
            errorMessage.includes('chat_not_found');
          
          if (!isExpectedError) {
            // Logar apenas erros reais (não relacionados a usuários inativos)
            console.error(`❌ [BPC-BROADCAST] Erro inesperado ao enviar para ${recipient.telegram_id}:`, err.message);
            console.error(`❌ [BPC-BROADCAST] Código de erro:`, err.code);
          }
        }
      }
      
      // Atualizar campanha
      if (campaign) {
        await db.supabase
          .from('broadcast_campaigns')
          .update({
            sent_count: success,
            failed_count: failed,
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', campaign.id);
      }
      
      delete global._SESSIONS[ctx.from.id];
      
      let resultMessage = `✅ *PROMOÇÃO ENVIADA COM SUCESSO!*

📊 *Estatísticas:*
✅ Enviados: ${success}
❌ Falhas: ${failed}
📝 Total: ${users.length}

📦 *Produtos com desconto:*

`;
      
      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        const disc = session.productDiscounts[key];
        resultMessage += `• ${product.name} - ${disc}% OFF\n`;
      }
      
      resultMessage += `

━━━━━━━━━━━━━━━━━━━━━━━━

✅ *Usuários que receberam:* Verão o preço com desconto automaticamente ao clicar no produto

_Promoção enviada com sucesso!_`;
      
      return ctx.editMessageText(resultMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar ao Painel', 'creator_refresh')]
        ])
      });
      
    } catch (err) {
      console.error('Erro no broadcast + cupom:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Erro ao enviar broadcast.');
    }
  });
  
  // ===== ATUALIZAR PAINEL =====
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
        [Markup.button.callback('📢 Broadcast', 'creator_broadcast')],
        [Markup.button.callback('🎟️ Cupons', 'creator_coupons')],
        [Markup.button.callback('🔄 Atualizar', 'creator_refresh')]
      ]);
      
      // Editar a mensagem existente ao invés de criar um update manual
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        return ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        return ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
    } catch (err) {
      console.error('❌ [CREATOR-REFRESH] Erro:', err);
      return ctx.answerCbQuery('❌ Erro ao atualizar. Tente novamente.');
    }
  });
}

module.exports = { registerCreatorCommands };

