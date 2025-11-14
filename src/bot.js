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
    console.log('=== HANDLER /start CHAMADO ===');
    console.log('Chat ID:', ctx.chat.id);
    console.log('User ID:', ctx.from.id);
    try {
      console.log('Comando /start recebido de:', ctx.from.id);
      
      // Salvar/atualizar usuário no banco
      await db.getOrCreateUser(ctx.from);
      console.log('Usuário salvo/atualizado no banco');
      
      // Buscar produtos ativos do banco
      const products = await db.getAllProducts();
      console.log('Produtos encontrados:', products.length);
      console.log('Produtos:', JSON.stringify(products.map(p => ({ id: p.product_id, name: p.name }))));
      
      if (products.length === 0) {
        console.log('Nenhum produto encontrado, enviando mensagem de aviso');
        return ctx.reply('🚧 Nenhum produto disponível no momento. Volte mais tarde!');
      }
      
      // Gerar botões dinamicamente
      const buttons = products.map(product => {
        const emoji = parseFloat(product.price) >= 50 ? '💎' : '🛍️';
        const buttonText = `${emoji} ${product.name} (R$${parseFloat(product.price).toFixed(2)})`;
        console.log('Criando botão:', buttonText, 'para produto:', product.product_id);
        return [Markup.button.callback(
          buttonText,
          `buy:${product.product_id}`
        )];
      });
      
      // Adicionar botão do grupo
      buttons.push([Markup.button.url('📢 Entrar no grupo', 'https://t.me/seugrupo')]);
      
      const text = `👋 Olá! Bem-vindo ao Bot da Val 🌶️🔥\n\nEscolha uma opção abaixo:`;
      console.log('Enviando mensagem com', buttons.length, 'botões');
      
      const keyboard = Markup.inlineKeyboard(buttons);
      console.log('Keyboard criado:', JSON.stringify(keyboard, null, 2));
      
      const result = await ctx.reply(text, keyboard);
      
      console.log('Mensagem enviada com sucesso:', result.message_id);
      return result;
    } catch (err) {
      console.error('Erro no /start:', err);
      console.error('Stack:', err.stack);
      return ctx.reply('❌ Erro ao carregar menu. Tente novamente.');
    }
  });

  // Registrar comandos admin DEPOIS do /start
  admin.registerAdminCommands(bot);

  bot.action(/buy:(.+)/, async (ctx) => {
    try {
      console.log('Botão de compra clicado!');
      const productId = ctx.match[1];
      const chatId = ctx.chat.id;
      console.log('Product ID:', productId, 'Chat ID:', chatId);
      
      // Buscar produto no banco de dados
      const product = await db.getProduct(productId);
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      const amount = product.price.toString();
      console.log('Valor do produto:', amount);

      // Criar usuário se não existe
      const user = await db.getOrCreateUser(ctx.from);

      // Criar cobrança PIX
      console.log('Chamando createManualCharge...');
      const resp = await manualPix.createManualCharge({ amount, productId });
      console.log('Resposta recebida:', resp);
      const charge = resp.charge;

      // Salvar transação no banco de dados
      const txid = charge.txid;
      await db.createTransaction({
        txid,
        userId: user.id,
        telegramId: chatId,
        productId,
        amount,
        pixKey: charge.key,
        pixPayload: charge.copiaCola
      });

      // Enviar QRCode + copia&cola e instruções
      if (charge.qrcodeBuffer) {
        console.log('Enviando QR Code via buffer...');
        await ctx.replyWithPhoto(
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
        console.log('QR Code enviado com sucesso');
      } else {
        await ctx.reply(`Pague R$ ${amount} na chave: ${charge.key}
Copia & Cola:
${charge.copiaCola}
Envie o comprovante quando pagar.
TXID: ${txid}`);
      }
    } catch (err) {
      console.error('Error on buy:', err);
      await ctx.reply('Ocorreu um erro ao gerar a cobrança. Tente novamente mais tarde.');
    }
  });

  // Receber comprovante (foto ou documento)
  bot.on(['photo', 'document'], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      
      // Buscar última transação pendente do usuário no banco de dados
      const transaction = await db.getLastPendingTransaction(chatId);
      
      if (!transaction) {
        return ctx.reply('❌ Não localizei uma cobrança pendente.\n\nSe acabou de pagar, aguarde alguns segundos e tente novamente.');
      }

      // Pegar fileId do comprovante
      const fileId = ctx.message.photo 
        ? ctx.message.photo.slice(-1)[0].file_id 
        : (ctx.message.document?.file_id || null);
      
      if (!fileId) {
        return ctx.reply('❌ Erro ao processar comprovante. Envie uma foto ou documento válido.');
      }

      // Salvar comprovante no banco de dados
      await db.updateTransactionProof(transaction.txid, fileId);

      // Notificar operador
      const operatorId = process.env.OPERATOR_CHAT_ID;
      if (operatorId) {
        try {
          await ctx.telegram.sendPhoto(operatorId, fileId, {
            caption: `🔔 **NOVO COMPROVANTE RECEBIDO**\n\n🆔 TXID: \`${transaction.txid}\`\n👤 Cliente: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})\n💰 Valor: R$ ${transaction.amount}\n\n**Para validar:**\n/validar_${transaction.txid}`,
            parse_mode: 'Markdown'
          });
        } catch (notifyErr) {
          console.error('Erro ao notificar operador:', notifyErr);
        }
      }

      await ctx.reply('✅ **Comprovante recebido com sucesso!**\n\nEstamos validando seu pagamento.\nVocê será notificado em breve! ⏳', {
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error('Error receiving proof:', err);
      await ctx.reply('❌ Erro ao receber comprovante. Tente novamente.');
    }
  });

  // Endpoint auxiliar para trigger delivery via HTTP (usado por operador/n8n)
  // NOTA: a chamada para envio final será feita via api/trigger-delivery.js
  return bot;
}

module.exports = { createBot };

