const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');

let bot;

module.exports = async (req, res) => {
  try {
    // Aceitar apenas POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // 🆕 LOG DETALHADO DO UPDATE RECEBIDO
    const update = req.body;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 [WEBHOOK] Update recebido do Telegram');
    console.log(`📋 [WEBHOOK] Update ID: ${update.update_id}`);
    console.log(`📋 [WEBHOOK] Tipo: ${update.message ? 'message' : update.callback_query ? 'callback_query' : 'other'}`);
    
    if (update.message) {
      console.log(`👤 [WEBHOOK] From: ${update.message.from.id} (@${update.message.from.username || 'N/A'})`);
      console.log(`📝 [WEBHOOK] Text: ${update.message.text || 'N/A'}`);
      console.log(`📷 [WEBHOOK] Photo: ${update.message.photo ? 'SIM' : 'NÃO'}`);
      console.log(`📄 [WEBHOOK] Document: ${update.message.document ? 'SIM' : 'NÃO'}`);
      
      if (update.message.document) {
        console.log(`📄 [WEBHOOK] Document details:`, {
          file_id: update.message.document.file_id?.substring(0, 30) + '...',
          file_name: update.message.document.file_name,
          mime_type: update.message.document.mime_type,
          file_size: update.message.document.file_size
        });
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Inicializar bot se ainda não foi criado
    if (!bot) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error('❌ [WEBHOOK] TELEGRAM_BOT_TOKEN não configurado!');
        return res.status(500).json({ error: 'Bot token not configured' });
      }
      console.log('🤖 [WEBHOOK] Inicializando bot...');
      bot = BotLogic.createBot(token);
      console.log('✅ [WEBHOOK] Bot inicializado com sucesso');
    }
    
    // Processar update
    console.log('⚙️ [WEBHOOK] Processando update...');
    try {
      await bot.handleUpdate(update);
      console.log('✅ [WEBHOOK] Update processado com sucesso');
    } catch (updateError) {
      console.error('❌ [WEBHOOK] Erro ao processar update:', updateError.message);
      console.error('Stack:', updateError.stack);
      // Não retornar erro para não quebrar o webhook
    }
    
    console.log('🏁 [WEBHOOK] Finalizando webhook\n');
    return res.status(200).json({ ok: true });
    
  } catch (err) {
    console.error('❌ [WEBHOOK] Erro crítico:', err.message);
    console.error('Stack:', err.stack);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: err.message 
    });
  }
};

