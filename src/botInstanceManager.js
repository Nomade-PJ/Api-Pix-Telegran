// src/botInstanceManager.js
const { Telegraf, Markup } = require('telegraf');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');
const db = require('./database');
const botManager = require('./modules/botManager');

// Cache de instâncias de bots
const botInstances = new Map();

/**
 * Obter ou criar instância de bot
 */
async function getBotInstance(botToken) {
  // Se já está em cache, retorna
  if (botInstances.has(botToken)) {
    return botInstances.get(botToken);
  }
  
  // Buscar no banco
  const botConfig = await botManager.getBotByToken(botToken);
  
  if (!botConfig || !botConfig.is_active) {
    return null;
  }
  
  // Criar nova instância
  const bot = createBotInstance(botConfig);
  
  // Salvar em cache
  botInstances.set(botToken, {
    instance: bot,
    config: botConfig
  });
  
  return { instance: bot, config: botConfig };
}

/**
 * Criar instância de bot específica do criador
 */
function createBotInstance(botConfig) {
  const bot = new Telegraf(botConfig.bot_token);
  
  // ============================================
  // COMANDO: /start
  // ============================================
  bot.start(async (ctx) => {
    try {
      // Salvar usuário no banco
      const user = await db.getOrCreateUser(ctx.from);
      
      // Mensagem de boas-vindas personalizada ou padrão
      const welcomeMessage = botConfig.welcome_message || 
        `🎉 *Bem-vindo!*\n\n🛍️ Confira nossos produtos abaixo:`;
      
      await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
      
      // Buscar produtos DESTE bot específico
      const { data: products } = await db.supabase
        .from('products')
        .select('*')
        .eq('bot_instance_id', botConfig.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (!products || products.length === 0) {
        return ctx.reply('📦 Ainda não temos produtos disponíveis.\n\nVolte em breve!');
      }
      
      // Mostrar produtos
      let message = '🛍️ *PRODUTOS DISPONÍVEIS:*\n\n';
      const buttons = [];
      
      for (const product of products) {
        message += `📦 *${product.name}*\n`;
        if (product.description) {
          message += `${product.description}\n`;
        }
        message += `💰 R$ ${parseFloat(product.price).toFixed(2)}\n\n`;
        
        buttons.push([Markup.button.callback(`🛒 Comprar ${product.name}`, `buy_${product.product_id}`)]);
      }
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro em /start do bot criador:', err);
      return ctx.reply('❌ Erro ao carregar produtos.');
    }
  });
  
  // ============================================
  // AÇÃO: Comprar produto
  // ============================================
  bot.action(/buy_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const productId = ctx.match[1];
      
      // Buscar produto DESTE bot
      const { data: product } = await db.supabase
        .from('products')
        .select('*')
        .eq('product_id', productId)
        .eq('bot_instance_id', botConfig.id)
        .single();
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      if (!product.is_active) {
        return ctx.reply('❌ Produto indisponível no momento.');
      }
      
      // Gerar PIX com a chave do bot
      const charge = await manualPix.createManualCharge({
        amount: product.price,
        productId: product.product_id,
        pixKey: botConfig.pix_key // Chave PIX deste bot
      });
      
      // Salvar transação com bot_instance_id
      const user = await db.getOrCreateUser(ctx.from);
      await db.supabase
        .from('transactions')
        .insert([{
          txid: charge.txid,
          user_id: user.id,
          telegram_id: ctx.from.id,
          product_id: product.product_id,
          bot_instance_id: botConfig.id, // Vincular ao bot
          amount: product.price,
          pix_key: botConfig.pix_key,
          pix_payload: charge.payload,
          status: 'pending'
        }]);
      
      // Enviar QR Code
      await ctx.replyWithPhoto(
        { source: charge.qrcodeBuffer },
        {
          caption: `💳 *PIX COPIA E COLA*\n\n\`${charge.payload}\`\n\n💰 Valor: R$ ${product.price}\n📦 Produto: ${product.name}\n\n📸 Após pagar, envie o comprovante aqui!`,
          parse_mode: 'Markdown'
        }
      );
      
      // Atualizar estatísticas do bot
      await botManager.updateBotStats(botConfig.id, {
        totalCustomers: (botConfig.total_customers || 0) + 1
      });
      
    } catch (err) {
      console.error('Erro ao processar compra:', err);
      return ctx.reply('❌ Erro ao gerar pagamento. Tente novamente.');
    }
  });
  
  // ============================================
  // COMANDO: /admin (para o dono do bot)
  // ============================================
  bot.command('admin', async (ctx) => {
    try {
      // Verificar se é o dono do bot
      if (ctx.from.id !== botConfig.owner_telegram_id) {
        return ctx.reply('❌ Acesso negado. Apenas o dono do bot pode usar este comando.');
      }
      
      // Buscar estatísticas deste bot
      const { data: stats } = await db.supabase
        .from('transactions')
        .select('amount, status')
        .eq('bot_instance_id', botConfig.id);
      
      const delivered = stats?.filter(t => t.status === 'delivered') || [];
      const pending = stats?.filter(t => t.status === 'pending' || t.status === 'proof_sent') || [];
      const totalRevenue = delivered.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const { count: productsCount } = await db.supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('bot_instance_id', botConfig.id);
      
      let message = `🤖 *MEU BOT* - @${botConfig.bot_username}\n\n`;
      message += `📊 *ESTATÍSTICAS:*\n`;
      message += `💰 R$ ${totalRevenue.toFixed(2)} em vendas\n`;
      message += `🛍️ ${delivered.length} vendas realizadas\n`;
      message += `⏳ ${pending.length} pagamentos pendentes\n`;
      message += `📦 ${productsCount || 0} produtos cadastrados\n\n`;
      message += `_Use o painel admin no bot principal para gerenciar produtos_`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro em /admin do bot criador:', err);
      return ctx.reply('❌ Erro ao carregar painel.');
    }
  });
  
  // ============================================
  // RECEBER COMPROVANTES
  // ============================================
  bot.on(['photo', 'document'], async (ctx) => {
    try {
      // Buscar última transação pendente DESTE bot
      const { data: transaction } = await db.supabase
        .from('transactions')
        .select('*')
        .eq('telegram_id', ctx.from.id)
        .eq('bot_instance_id', botConfig.id)
        .in('status', ['pending', 'proof_sent'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!transaction) {
        return ctx.reply('❌ Não encontrei uma cobrança pendente.\n\nSe acabou de pagar, aguarde alguns segundos e tente novamente.');
      }
      
      const fileId = ctx.message.photo 
        ? ctx.message.photo.slice(-1)[0].file_id 
        : (ctx.message.document?.file_id || null);
      
      if (!fileId) {
        return ctx.reply('❌ Erro ao processar comprovante.');
      }
      
      // Atualizar transação
      await db.supabase
        .from('transactions')
        .update({
          proof_file_id: fileId,
          proof_received_at: new Date().toISOString(),
          status: 'proof_sent',
          updated_at: new Date().toISOString()
        })
        .eq('txid', transaction.txid);
      
      // Notificar o dono do bot
      try {
        await ctx.telegram.sendPhoto(botConfig.owner_telegram_id, fileId, {
          caption: `🔔 *NOVO COMPROVANTE*\n\n🤖 Bot: @${botConfig.bot_username}\n💰 Valor: R$ ${transaction.amount}\n👤 Cliente: ${ctx.from.first_name}\n\n_Valide pelo painel admin_`,
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar dono do bot:', err);
      }
      
      return ctx.reply('✅ *Comprovante recebido!*\n\nEstamos validando seu pagamento.\nVocê será notificado em breve! ⏳', {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao receber comprovante:', err);
      return ctx.reply('❌ Erro ao processar comprovante. Tente novamente.');
    }
  });
  
  return bot;
}

/**
 * Limpar cache de bot
 */
function clearBotCache(botToken) {
  botInstances.delete(botToken);
}

/**
 * Limpar todos os caches
 */
function clearAllCaches() {
  botInstances.clear();
}

module.exports = {
  getBotInstance,
  clearBotCache,
  clearAllCaches
};

