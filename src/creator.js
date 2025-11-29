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
      const pendingCount = await db.getPendingTransactions().then(txs => txs.length);
      
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
      const pending = await db.getPendingTransactions();
      
      const message = `📊 *ESTATÍSTICAS DETALHADAS*

💳 *Transações Aprovadas:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pending.length}

💰 *FINANCEIRO*
• Total Vendido: R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}
• Hoje: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}

📅 *PERÍODO*
• Transações Hoje: ${stats.todayTransactions || 0}

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
      
      const message = `📢 *NOVO BROADCAST*

Escolha o tipo de broadcast:

1️⃣ *Broadcast Simples* - Mensagem para todos os usuários
2️⃣ *Broadcast com Produto* - Associar a um produto específico
3️⃣ *Broadcast com Cupom* - Criar cupom e divulgar

Selecione uma opção:`;

      const buttons = [
        [Markup.button.callback('📣 Broadcast Simples', 'creator_broadcast_simple')],
        [Markup.button.callback('🛍️ Broadcast + Produto', 'creator_broadcast_product')],
        [Markup.button.callback('🎟️ Broadcast + Cupom', 'creator_broadcast_coupon')],
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
    await ctx.answerCbQuery('📢 Enviando broadcast...');
    const isCreator = await db.isUserCreator(ctx.from.id);
    if (!isCreator) return;
    
    const session = global._SESSIONS?.[ctx.from.id];
    if (!session || session.type !== 'creator_broadcast' || session.step !== 'confirm') {
      return ctx.reply('❌ Sessão de broadcast não encontrada.');
    }
    
    try {
      const message = session.data.message;
      const user = await db.getOrCreateUser(ctx.from);
      
      // Buscar todos os usuários
      const users = await db.getRecentUsers(10000); // Buscar muitos usuários
      
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

📨 Mensagem sendo enviada para ${users.length} usuários...

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
          console.error(`Erro ao enviar para ${user.telegram_id}:`, err.message);
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

✅ Enviados: ${success}
❌ Falhas: ${failed}
📊 Total: ${users.length}`;

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
      const pendingTxs = await db.getPendingTransactions();
      const pendingCount = pendingTxs.length;
      
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

