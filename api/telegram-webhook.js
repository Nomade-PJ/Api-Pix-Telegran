const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');

let bot;

module.exports = async (req, res) => {
  try {
    // Log inicial
    console.log('Webhook chamado:', req.method, req.url);
    
    // Aceitar apenas POST
    if (req.method !== 'POST') {
      console.log('Método não permitido:', req.method);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // Inicializar bot se ainda não foi criado
    if (!bot) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error('TELEGRAM_BOT_TOKEN não configurado!');
        return res.status(500).json({ error: 'Bot token not configured' });
      }
      console.log('Inicializando bot...');
      bot = BotLogic.createBot(token);
      console.log('Bot inicializado com sucesso');
    }
    
    // O body do Telegram vem como application/json
    console.log('Recebendo update do Telegram');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    await bot.handleUpdate(req.body);
    
    console.log('Update processado com sucesso');
    return res.status(200).json({ ok: true });
    
  } catch (err) {
    console.error('Webhook error:', err.message);
    console.error('Stack:', err.stack);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: err.message 
    });
  }
};

