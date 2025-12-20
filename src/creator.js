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
• Hoje: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}

📅 *PERÍODO*
• Transações Hoje: ${stats.todayTransactions || 0}

🔄 *Atualização:* Automática em tempo real
📅 *Última atualização:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

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
  
  // ===== LISTAR USUÁRIOS (REMOVIDO DO PAINEL - APENAS ADMIN) =====
  // Esta função foi removida do painel do criador por segurança
  
  // ===== BROADCAST MELHORADO COM PRODUTOS =====
  bot.action('creator_broadcast', async (ctx) => {
    await ctx.answerCbQuery('📢 Preparando broadcast...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      // Buscar produtos ativos
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();
      
      // Verificar se broadcast com cupom está ativado
      const broadcastCouponEnabled = await db.getSetting('broadcast_coupon_enabled');
      const showBroadcastCoupon = broadcastCouponEnabled === 'true' || broadcastCouponEnabled === true;
      
      let message = `📢 *BROADCAST*

*Criar novo broadcast:*

1️⃣ *Simples* - Mensagem para todos
2️⃣ *Com Produto* - Associar produto
3️⃣ *Com Cupom* - Criar e divulgar cupom`;

      if (showBroadcastCoupon) {
        message += `
4️⃣ *Produto + Cupom* - Desconto automático`;
      }

      message += `

━━━━━━━━━━━━━━━━━━━━━━━━

*Gerenciar promoções ativas:*`;

      const buttons = [
        [Markup.button.callback('📣 Simples', 'creator_broadcast_simple')],
        [Markup.button.callback('🛍️ Com Produto', 'creator_broadcast_product')],
        [Markup.button.callback('🎟️ Com Cupom', 'creator_broadcast_coupon')]
      ];
      
      if (showBroadcastCoupon) {
        buttons.push([Markup.button.callback('🎁 Produto + Cupom', 'creator_broadcast_product_coupon')]);
      }
      
      buttons.push(
        [Markup.button.callback('🗑️ Deletar Promoções', 'creator_delete_promotions')],
        [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
      );
      
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

Digite a *porcentagem de desconto* para este produto (ex: 10, 20, 50):

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
      ])
    });
  });
  
  // ===== CUPONS =====
  bot.action('creator_coupons', async (ctx) => {
    await ctx.answerCbQuery('🎟️ Carregando cupons...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      // Buscar cupons criados pelo usuário
      const user = await db.getOrCreateUser(ctx.from);
      const { data: coupons, error } = await db.supabase
        .from('coupons')
        .select('*, products:product_id(name), media_packs:media_pack_id(name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      let message = `🎟️ *GERENCIAR CUPONS*\n\n`;
      
      if (!coupons || coupons.length === 0) {
        message += `Nenhum cupom criado ainda.\n\n`;
      } else {
        message += `📋 *Seus cupons:*\n\n`;
        
        for (const coupon of coupons) {
          const status = coupon.is_active ? '✅' : '❌';
          const productName = coupon.products?.name || coupon.media_packs?.name || 'Produto removido';
          const uses = coupon.max_uses ? `${coupon.current_uses}/${coupon.max_uses}` : `${coupon.current_uses}/∞`;
          
          message += `${status} \`${coupon.code}\`\n`;
          message += `   💰 ${coupon.discount_percentage}% de desconto\n`;
          message += `   📦 ${productName}\n`;
          message += `   📊 Usos: ${uses}\n`;
          if (coupon.expires_at) {
            const expiresAt = new Date(coupon.expires_at);
            message += `   ⏰ Expira: ${expiresAt.toLocaleDateString('pt-BR')}\n`;
          }
          message += `\n`;
        }
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `Selecione uma opção:`;
      
      const buttons = [
        [Markup.button.callback('➕ Novo Cupom', 'creator_new_coupon')],
        [Markup.button.callback('📊 Ver Estatísticas', 'creator_coupon_stats')],
        [Markup.button.callback('🔙 Voltar', 'creator_refresh')]
      ];
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar cupons:', err);
      return ctx.reply('❌ Erro ao carregar cupons.');
    }
  });
  
  // Criar novo cupom
  bot.action('creator_new_coupon', async (ctx) => {
    await ctx.answerCbQuery('➕ Iniciando criação de cupom...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const products = await db.getAllProducts();
      const mediaPacks = await db.getAllMediaPacks();
      
      if (products.length === 0 && mediaPacks.length === 0) {
        return ctx.editMessageText('📦 Nenhum produto disponível para criar cupom.\n\nCrie produtos primeiro no painel admin.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Voltar', 'creator_coupons')]
          ])
        });
      }
      
      let message = `➕ *CRIAR NOVO CUPOM*

Selecione o produto para o cupom:

`;
      
      const buttons = [];
      
      // Adicionar produtos
      for (const product of products) {
        message += `• ${product.name} - R$ ${parseFloat(product.price).toFixed(2)}\n`;
        buttons.push([Markup.button.callback(
          `📦 ${product.name}`, 
          `creator_coupon_select_product:${product.product_id}`
        )]);
      }
      
      // Adicionar media packs
      for (const pack of mediaPacks) {
        if (pack.is_active) {
          message += `• ${pack.name} - R$ ${parseFloat(pack.price).toFixed(2)}\n`;
          buttons.push([Markup.button.callback(
            `📸 ${pack.name}`, 
            `creator_coupon_select_pack:${pack.pack_id}`
          )]);
        }
      }
      
      buttons.push([Markup.button.callback('🔙 Voltar', 'creator_coupons')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao iniciar criação de cupom:', err);
      return ctx.reply('❌ Erro ao iniciar criação de cupom.');
    }
  });
  
  // Selecionar produto para cupom
  bot.action(/^creator_coupon_select_product:(.+)$/, async (ctx) => {
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
      type: 'create_coupon',
      step: 'code',
      productId: productId,
      productName: product.name,
      productPrice: product.price
    };
    
    return ctx.editMessageText(`🎟️ *CRIAR CUPOM: ${product.name}*

💰 Preço original: R$ ${parseFloat(product.price).toFixed(2)}

*Passo 1/4:* Digite o *código do cupom* (ex: BLACKFRIDAY, NATAL20, etc):

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_create_coupon')]
      ])
    });
  });
  
  // Selecionar media pack para cupom
  bot.action(/^creator_coupon_select_pack:(.+)$/, async (ctx) => {
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
      type: 'create_coupon',
      step: 'code',
      mediaPackId: packId,
      packName: pack.name,
      packPrice: pack.price
    };
    
    return ctx.editMessageText(`🎟️ *CRIAR CUPOM: ${pack.name}*

💰 Preço original: R$ ${parseFloat(pack.price).toFixed(2)}

*Passo 1/4:* Digite o *código do cupom* (ex: BLACKFRIDAY, NATAL20, etc):

_Cancelar: /cancelar_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_create_coupon')]
      ])
    });
  });
  
  // Cancelar criação de cupom
  bot.action('cancel_create_coupon', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    delete global._SESSIONS[ctx.from.id];
    return ctx.editMessageText('❌ Criação de cupom cancelada.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Voltar', 'creator_coupons')]
      ])
    });
  });
  
  // Estatísticas de cupons
  bot.action('creator_coupon_stats', async (ctx) => {
    await ctx.answerCbQuery('📊 Carregando estatísticas...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    try {
      const user = await db.getOrCreateUser(ctx.from);
      
      // Buscar estatísticas de cupons
      const { data: coupons, error: couponsError } = await db.supabase
        .from('coupons')
        .select('id, code, discount_percentage, current_uses, max_uses')
        .eq('created_by', user.id);
      
      if (couponsError) throw couponsError;
      
      // Buscar uso total
      const { data: usage, error: usageError } = await db.supabase
        .from('coupon_usage')
        .select('discount_amount, coupon_id')
        .in('coupon_id', coupons.map(c => c.id));
      
      if (usageError) throw usageError;
      
      const totalCoupons = coupons.length;
      const totalUses = usage?.length || 0;
      const totalDiscount = usage?.reduce((sum, u) => sum + parseFloat(u.discount_amount), 0) || 0;
      const activeCoupons = coupons.filter(c => c.current_uses < (c.max_uses || Infinity)).length;
      
      const message = `📊 *ESTATÍSTICAS DE CUPONS*

🎟️ *Total de cupons:* ${totalCoupons}
✅ *Cupons ativos:* ${activeCoupons}
📈 *Total de usos:* ${totalUses}
💰 *Desconto total gerado:* R$ ${totalDiscount.toFixed(2)}

${coupons.length > 0 ? '\n📋 *Top 5 cupons mais usados:*\n\n' + coupons
  .sort((a, b) => b.current_uses - a.current_uses)
  .slice(0, 5)
  .map((c, i) => `${i + 1}. \`${c.code}\` - ${c.current_uses} usos (${c.discount_percentage}% off)`)
  .join('\n') : ''}`;
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'creator_coupons')]
        ])
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas.');
    }
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
          // Não logar como erro se o bot foi bloqueado pelo usuário (comportamento esperado)
          if (err.message && err.message.includes('bot was blocked by the user')) {
            // Silencioso - apenas contar como falha
          } else {
            // Logar apenas erros reais (não relacionados a bloqueio)
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
      // Buscar por código do cupom OU por produto/pack relacionado OU por tipo broadcast
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
      
      // Buscar cupons relacionados (por código, produto, pack ou tipo broadcast)
      const { data: relatedCoupons, error: couponsError } = await db.supabase
        .from('coupons')
        .select('id, code, product_id, media_pack_id, is_broadcast_coupon')
        .or(couponConditions.length > 0 ? couponConditions.join(',') : 'is_broadcast_coupon.eq.true');
      
      if (!couponsError && relatedCoupons && relatedCoupons.length > 0) {
        // Filtrar apenas cupons que realmente pertencem a este broadcast
        const campaignDate = new Date(campaign.created_at);
        const startDate = new Date(campaignDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(campaignDate);
        endDate.setHours(23, 59, 59, 999);
        
        // Buscar cupons criados no mesmo dia e que correspondem ao broadcast
        const { data: allRelatedCoupons } = await db.supabase
          .from('coupons')
          .select('id')
          .or(couponConditions.length > 0 ? couponConditions.join(',') : 'is_broadcast_coupon.eq.true')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        
        if (allRelatedCoupons && allRelatedCoupons.length > 0) {
          const couponIds = allRelatedCoupons.map(c => c.id);
          
          // Desativar todos os cupons relacionados
          const { error: updateError } = await db.supabase
            .from('coupons')
            .update({ is_active: false })
            .in('id', couponIds);
          
          if (updateError) {
            console.error('Erro ao desativar cupons:', updateError);
          } else {
            console.log(`✅ ${couponIds.length} cupom(ns) desativado(s) ao deletar broadcast ${campaignId}`);
          }
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
❌ Cupons desativados

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
      
      // Buscar usuários desbloqueados
      const users = await db.getActiveBuyers();
      
      if (users.length === 0) {
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Nenhum comprador ativo encontrado.');
      }
      
      await ctx.editMessageText(`🎁 *CRIANDO CUPONS E ENVIANDO...*

📨 Preparando envio para ${users.length} compradores ativos...

⏳ Aguarde...`, {
        parse_mode: 'Markdown'
      });
      
      // Criar cupons automáticos para cada produto
      const createdCoupons = [];
      const broadcastCouponIds = [];
      
      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        const discount = session.productDiscounts[key];
        
        // Criar cupom automático para broadcast
        const autoCouponCode = `AUTO_${session.couponCode}_${product.id}`;
        
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
        
        // Criar cupom manual para novos usuários
        const { data: manualCoupon, error: manualCouponError } = await db.supabase
          .from('coupons')
          .insert([{
            code: session.couponCode,
            discount_percentage: discount,
            product_id: product.type === 'product' ? product.id : null,
            media_pack_id: product.type === 'pack' ? product.id : null,
            is_active: true,
            is_broadcast_coupon: false,
            created_by: user.id
          }])
          .select()
          .single();
        
        if (manualCouponError) {
          console.error('Erro ao criar cupom manual:', manualCouponError);
        } else {
          createdCoupons.push(manualCoupon);
        }
      }
      
      // Salvar campanha de broadcast
      const { data: campaign, error: campaignError } = await db.supabase
        .from('broadcast_campaigns')
        .insert([{
          name: `Broadcast + Cupom ${new Date().toLocaleDateString('pt-BR')}`,
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
      
      // Registrar usuários que receberão o broadcast
      const broadcastRecipients = [];
      for (const recipient of users) {
        broadcastRecipients.push({
          telegram_id: recipient.telegram_id,
          broadcast_campaign_id: campaign?.id || null
        });
      }
      
      if (broadcastRecipients.length > 0) {
        await db.supabase
          .from('broadcast_recipients')
          .insert(broadcastRecipients)
          .catch(err => console.error('Erro ao registrar destinatários:', err));
      }
      
      // Enviar broadcast
      let success = 0;
      let failed = 0;
      
      for (const recipient of users) {
        try {
          // Adicionar cupom copiável na mensagem
          const messageWithCoupon = `${message}

━━━━━━━━━━━━━━━━━━━━━━━━

🎟️ *Cupom:* \`${session.couponCode}\`
_(Toque para copiar)_`;
          
          await ctx.telegram.sendMessage(recipient.telegram_id, messageWithCoupon, {
            parse_mode: 'Markdown'
          });
          success++;
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (err) {
          failed++;
          if (!err.message || !err.message.includes('bot was blocked by the user')) {
            console.error(`❌ [BPC-BROADCAST] Erro ao enviar para ${recipient.telegram_id}:`, err.message);
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
      
      let resultMessage = `✅ *BROADCAST + CUPOM CONCLUÍDO!*

📊 *Estatísticas:*
✅ Enviados: ${success}
❌ Falhas: ${failed}
📝 Total: ${users.length}

🎟️ *Cupom criado:* \`${session.couponCode}\`

📦 *Produtos com desconto:*

`;
      
      for (const product of session.selectedProducts) {
        const key = `${product.type}_${product.id}`;
        const disc = session.productDiscounts[key];
        resultMessage += `• ${product.name} - ${disc}% OFF\n`;
      }
      
      resultMessage += `

━━━━━━━━━━━━━━━━━━━━━━━━

✅ *Usuários que receberam:* Desconto aplicado automaticamente
🎟️ *Novos usuários:* Podem usar o cupom \`${session.couponCode}\`

_Broadcast enviado com sucesso!_`;
      
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

