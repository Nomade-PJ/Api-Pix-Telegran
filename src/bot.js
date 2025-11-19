// src/bot.js
const { Telegraf, Markup } = require('telegraf');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');
const db = require('./database');
const admin = require('./admin');

function createBot(token) {
  const bot = new Telegraf(token);

  // Registrar handler do /start PRIMEIRO (antes dos comandos admin)
  bot.start(async (ctx) => {
    try {
      // Paralelizar queries (OTIMIZAÇÃO #4)
      const [user, products] = await Promise.all([
        db.getOrCreateUser(ctx.from),
        db.getAllProducts()
      ]);
      
      if (products.length === 0) {
        return ctx.reply('🚧 Nenhum produto disponível no momento. Volte mais tarde!');
      }
      
      // Gerar botões dinamicamente (sem logs pesados)
      const buttons = products.map(product => {
        const emoji = parseFloat(product.price) >= 50 ? '💎' : '🛍️';
        const buttonText = `${emoji} ${product.name} (R$${parseFloat(product.price).toFixed(2)})`;
        return [Markup.button.callback(buttonText, `buy:${product.product_id}`)];
      });
      
      buttons.push([Markup.button.url('📢 Entrar no grupo', 'https://t.me/seugrupo')]);
      
      const text = `👋 Olá! Bem-vindo ao Bot da Val 🌶️🔥\n\nEscolha uma opção abaixo:`;
      
      return await ctx.reply(text, Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('Erro no /start:', err.message);
      return ctx.reply('❌ Erro ao carregar menu. Tente novamente.');
    }
  });

  // Registrar comandos admin DEPOIS do /start
  admin.registerAdminCommands(bot);

  bot.action(/buy:(.+)/, async (ctx) => {
    try {
      const productId = ctx.match[1];
      
      // OTIMIZAÇÃO #1: Responder imediatamente ao clique (feedback visual instantâneo)
      await ctx.answerCbQuery('⏳ Gerando cobrança PIX...');
      
      // OTIMIZAÇÃO #4: Paralelizar busca de produto e usuário
      const [product, user] = await Promise.all([
        db.getProduct(productId),
        db.getOrCreateUser(ctx.from)
      ]);
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      const amount = product.price.toString();

      // Gerar cobrança PIX e salvar transação em paralelo
      const resp = await manualPix.createManualCharge({ amount, productId });
      const charge = resp.charge;
      const txid = charge.txid;
      
      // Salvar no banco (não precisa aguardar para enviar QR Code)
      db.createTransaction({
        txid,
        userId: user.id,
        telegramId: ctx.chat.id,
        productId,
        amount,
        pixKey: charge.key,
        pixPayload: charge.copiaCola
      }).catch(err => console.error('Erro ao salvar transação:', err));

      // Enviar QR Code imediatamente
      if (charge.qrcodeBuffer) {
        return await ctx.replyWithPhoto(
          { source: charge.qrcodeBuffer },
          {
            caption: `💰 Pague R$ ${amount} usando PIX

🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

📸 Após pagar, envie o comprovante (foto) aqui.

🆔 TXID: ${txid}`,
            parse_mode: 'Markdown'
          }
        );
      } else {
        return await ctx.reply(`Pague R$ ${amount} na chave: ${charge.key}
Copia & Cola:
${charge.copiaCola}
Envie o comprovante quando pagar.
TXID: ${txid}`);
      }
    } catch (err) {
      console.error('Erro na compra:', err.message);
      await ctx.reply('❌ Erro ao gerar cobrança. Tente novamente.');
    }
  });

  // Receber comprovante (foto ou documento)
  bot.on(['photo', 'document'], async (ctx) => {
    try {
      const transaction = await db.getLastPendingTransaction(ctx.chat.id);
      
      if (!transaction) {
        return ctx.reply('❌ Não localizei uma cobrança pendente.\n\nSe acabou de pagar, aguarde alguns segundos e tente novamente.');
      }

      const fileId = ctx.message.photo 
        ? ctx.message.photo.slice(-1)[0].file_id 
        : (ctx.message.document?.file_id || null);
      
      if (!fileId) {
        return ctx.reply('❌ Erro ao processar comprovante. Envie uma foto ou documento válido.');
      }

      // Responder usuário imediatamente (OTIMIZAÇÃO #7)
      ctx.reply('✅ **Comprovante recebido com sucesso!**\n\nEstamos validando seu pagamento.\nVocê será notificado em breve! ⏳', {
        parse_mode: 'Markdown'
      });

      // Salvar e notificar em paralelo (não bloqueia resposta ao usuário)
      await Promise.all([
        db.updateTransactionProof(transaction.txid, fileId),
        (async () => {
          const operatorId = process.env.OPERATOR_CHAT_ID;
          if (operatorId) {
            try {
              await ctx.telegram.sendPhoto(operatorId, fileId, {
                caption: `🔔 **NOVO COMPROVANTE**\n\n🆔 TXID: \`${transaction.txid}\`\n👤 ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})\n💰 R$ ${transaction.amount}\n\n/validar_${transaction.txid}`,
                parse_mode: 'Markdown'
              });
            } catch (err) {
              console.error('Erro notificar operador:', err.message);
            }
          }
        })()
      ]);
    } catch (err) {
      console.error('Erro receber comprovante:', err.message);
      await ctx.reply('❌ Erro ao processar. Tente novamente.');
    }
  });

  // Endpoint auxiliar para trigger delivery via HTTP (usado por operador/n8n)
  // NOTA: a chamada para envio final será feita via api/trigger-delivery.js
  return bot;
}

module.exports = { createBot };

