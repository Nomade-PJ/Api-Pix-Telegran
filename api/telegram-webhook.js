// api/telegram-webhook.js
const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');

let bot;

// Vercel handler
module.exports = async (req, res) => {
  try {
    // Aceitar apenas POST
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
    // Inicializar bot se ainda não foi criado
    if (!bot) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error('TELEGRAM_BOT_TOKEN não configurado!');
        return res.status(500).send('Bot token not configured');
      }
      console.log('Inicializando bot...');
      bot = BotLogic.createBot(token);
    }
    
    // O body do Telegram vem como application/json
    console.log('Recebendo update do Telegram:', JSON.stringify(req.body));
    await bot.handleUpdate(req.body);
    console.log('Update processado com sucesso');
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    console.error('Stack:', err.stack);
    return res.status(500).send('Error: ' + err.message);
  }
};

