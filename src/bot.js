// src/bot.js
const { Telegraf, Markup } = require('telegraf');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');

function createBot(token) {
  const bot = new Telegraf(token);

  bot.start((ctx) => {
    const text = `Olá! Bem-vindo. Escolha uma opção:`;
    return ctx.reply(text, Markup.inlineKeyboard([
      [Markup.button.callback('Comprar Pack A (R$30)', 'buy:packA')],
      [Markup.button.callback('Comprar Pack B (R$50)', 'buy:packB')],
      [Markup.button.url('Entrar no grupo', 'https://t.me/seugrupo')]
    ]));
  });

  bot.action(/buy:(.+)/, async (ctx) => {
    try {
      console.log('Botão de compra clicado!');
      const productId = ctx.match[1];
      const chatId = ctx.chat.id;
      console.log('Product ID:', productId, 'Chat ID:', chatId);
      
      // Definir preço por produto (exemplo simples)
      const prices = { packA: "30.00", packB: "50.00" };
      const amount = prices[productId] || "10.00";
      console.log('Valor do produto:', amount);

      // Criar cobrança modo manual (B)
      console.log('Chamando createManualCharge...');
      const resp = await manualPix.createManualCharge({ amount, productId });
      console.log('Resposta recebida:', resp);
      const charge = resp.charge;

      // Salvar mapping txid -> chatId (simples memória) - ideal: usar DB (Supabase/Postgres)
      const txid = charge.txid || `manual_${Date.now()}_${chatId}`;
      // **Você deve guardar isso em DB.**
      // Para demo, salvamos na memória (não recomendado para produção)
      global._TXS = global._TXS || {};
      global._TXS[txid] = { chatId, productId, amount, charge };

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
      // pegar último txid vinculado a este chat (simples exemplo)
      // Ideal: usar DB para mapping; aqui, procura por txid mais recente do chat
      let txid;
      if (global._TXS) {
        txid = Object.keys(global._TXS).reverse().find(t => global._TXS[t].chatId === chatId);
      }
      if (!txid) {
        await ctx.reply('Não localizei uma cobrança pendente. Se pagou, envie o TXID ou entre em contato com suporte.');
        return;
      }

      // Salvar info do comprovante (por simplicidade, apenas notificar operador)
      const operatorId = process.env.OPERATOR_CHAT_ID;
      if (operatorId) {
        const fileId = ctx.message.photo ? ctx.message.photo.slice(-1)[0].file_id : (ctx.message.document && ctx.message.document.file_id);
        await ctx.telegram.sendMessage(operatorId, `Novo comprovante recebido.
ChatId: ${chatId}
TXID: ${txid}
FileId: ${fileId}`);
        await ctx.reply('Comprovante recebido. Em breve validaremos e liberaremos seu acesso.');
      } else {
        await ctx.reply('Comprovante recebido. Porém não há operador configurado para validar automaticamente.');
      }
      // Opcional: armazenar fileId em DB para posterior análise.
      global._TXS[txid].proof = true;
    } catch (err) {
      console.error('Error receiving proof:', err);
      await ctx.reply('Erro ao receber comprovante. Tente novamente.');
    }
  });

  // Endpoint auxiliar para trigger delivery via HTTP (usado por operador/n8n)
  // NOTA: a chamada para envio final será feita via api/trigger-delivery.js
  return bot;
}

module.exports = { createBot };

