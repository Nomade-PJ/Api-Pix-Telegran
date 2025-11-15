const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');
const botInstanceManager = require('../src/botInstanceManager');
const db = require('../src/database');

let mainBot; // Bot principal (gerenciamento)
const botCache = new Map(); // Cache de bots criados pelos usuários

module.exports = async (req, res) => {
  try {
    // Log inicial
    console.log('Webhook chamado:', req.method, req.url);
    
    // Aceitar apenas POST
    if (req.method !== 'POST') {
      console.log('Método não permitido:', req.method);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // O body do Telegram vem como application/json
    console.log('Recebendo update do Telegram');
    
    // Verificar se é um comando
    if (req.body.message && req.body.message.text) {
      console.log('Mensagem de texto recebida:', req.body.message.text);
    }
    
    // ============================================
    // IDENTIFICAR QUAL BOT DEVE PROCESSAR
    // ============================================
    
    let botToUse = null;
    let isMainBot = true;
    
    // Tentar identificar o bot pelo chat
    // Se o update contém informação de chat, podemos verificar se é de um bot específico
    const chatId = req.body.message?.chat?.id || 
                   req.body.callback_query?.message?.chat?.id;
    
    if (chatId) {
      // Verificar se este chat tem transações em algum bot específico
      const { data: recentTransaction } = await db.supabase
        .from('transactions')
        .select('bot_instance_id, bot_instances!inner(bot_token, is_active)')
        .eq('telegram_id', chatId)
        .not('bot_instance_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (recentTransaction && recentTransaction.bot_instances) {
        // Este usuário está interagindo com um bot específico
        const botToken = recentTransaction.bot_instances.bot_token;
        const isActive = recentTransaction.bot_instances.is_active;
        
        if (isActive) {
          console.log('Identificado bot criado pelo usuário');
          
          // Obter ou criar instância do bot
          const botInstance = await botInstanceManager.getBotInstance(botToken);
          
          if (botInstance) {
            botToUse = botInstance.instance;
            isMainBot = false;
          }
        }
      }
    }
    
    // Se não identificou um bot específico, usar o bot principal
    if (!botToUse) {
      // Inicializar bot principal se ainda não foi criado
      if (!mainBot) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          console.error('TELEGRAM_BOT_TOKEN não configurado!');
          return res.status(500).json({ error: 'Bot token not configured' });
        }
        console.log('Inicializando bot principal...');
        mainBot = BotLogic.createBot(token);
        console.log('Bot principal inicializado com sucesso');
      }
      botToUse = mainBot;
      console.log('Usando bot principal');
    }
    
    // Processar update
    try {
      await botToUse.handleUpdate(req.body);
      console.log('Update processado com sucesso');
    } catch (updateError) {
      console.error('Erro ao processar update:', updateError);
      console.error('Stack do update:', updateError.stack);
      // Não retornar erro aqui, apenas logar, para não quebrar o webhook
    }
    
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

