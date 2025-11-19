const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');

let bot;

module.exports = async (req, res) => {
  try {
    // Aceitar apenas POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // Inicializar bot se ainda não foi criado
    if (!bot) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error('TELEGRAM_BOT_TOKEN não configurado!');
        return res.status(500).json({ error: 'Bot token not configured' });
      }
      bot = BotLogic.createBot(token);
    }
    
    // OTIMIZAÇÃO #6: Processar update sem logs pesados
    try {
      await bot.handleUpdate(req.body);
    } catch (updateError) {
      console.error('Erro processar update:', updateError.message);
      // Não retornar erro para não quebrar o webhook
    }
    
    return res.status(200).json({ ok: true });
    
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: err.message 
    });
  }
};

