// api/process-notifications.js
// Worker para processar notificações agendadas
// Pode ser chamado via cron job ou endpoint manual

const { Telegram } = require('telegraf');
const notifications = require('../src/modules/notifications');

const tg = new Telegram(process.env.TELEGRAM_BOT_TOKEN);

module.exports = async (req, res) => {
  try {
    console.log('Processando notificações pendentes...');
    
    // Verificar secret (opcional, para segurança)
    const secret = req.query.secret || req.body?.secret;
    if (process.env.NOTIFICATION_SECRET && secret !== process.env.NOTIFICATION_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Buscar notificações pendentes
    const pendingNotifications = await notifications.getPendingNotifications();
    
    console.log(`${pendingNotifications.length} notificações pendentes`);
    
    let sent = 0;
    let failed = 0;
    
    for (const notification of pendingNotifications) {
      try {
        // Enviar mensagem
        await tg.sendMessage(
          notification.user.telegram_id,
          notification.message,
          { parse_mode: 'Markdown' }
        );
        
        // Marcar como enviada
        await notifications.markAsSent(notification.id);
        sent++;
        
        console.log(`Notificação ${notification.id} enviada para ${notification.user.telegram_id}`);
      } catch (err) {
        console.error(`Erro ao enviar notificação ${notification.id}:`, err);
        await notifications.markAsFailed(notification.id);
        failed++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const result = {
      processed: pendingNotifications.length,
      sent,
      failed
    };
    
    console.log('Processamento concluído:', result);
    
    return res.status(200).json(result);
    
  } catch (err) {
    console.error('Erro ao processar notificações:', err);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: err.message 
    });
  }
};

