// api/telegram-webhook.js
const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');

const bot = BotLogic.createBot(process.env.TELEGRAM_BOT_TOKEN);

// Vercel handler
module.exports = async (req, res) => {
  try {
    // Aceitar apenas POST
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
    // O body do Telegram vem como application/json
    await bot.handleUpdate(req.body);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('Error');
  }
};

