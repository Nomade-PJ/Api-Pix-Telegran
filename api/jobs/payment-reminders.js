// api/jobs/payment-reminders.js
// Endpoint de cron job para envio de lembretes de pagamento de transações pendentes
// Este endpoint deve ser chamado por um serviço externo de cron (ex: cron-job.org)

const { createBot } = require('../../src/bot');
const { sendPaymentReminders } = require('../../src/jobs/sendPaymentReminders');

/**
 * Handler do endpoint de lembretes de pagamento
 * 
 * Segurança: Requer header x-cron-secret
 * Frequência recomendada: A cada 2 a 5 minutos
 */
module.exports = async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // ===== SEGURANÇA: Validar secret =====
    const secret = req.headers['x-cron-secret'];
    
    if (!secret || secret !== process.env.CRON_SECRET) {
      console.error('❌ [CRON-REMINDERS] Tentativa de acesso não autorizada', {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        hasSecret: !!secret
      });
      
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing x-cron-secret header'
      });
    }
    
    console.log('🔄 [CRON-REMINDERS] Job de lembretes iniciado', {
      timestamp: new Date().toISOString(),
      source: 'cron-endpoint'
    });
    
    // ===== CRIAR BOT E EXECUTAR JOB =====
    const bot = createBot(process.env.TELEGRAM_BOT_TOKEN);
    
    // Executar envio de lembretes
    const result = await sendPaymentReminders(bot);
    
    const duration = Date.now() - startTime;
    
    console.log('✅ [CRON-REMINDERS] Job concluído com sucesso', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      result
    });
    
    // Retornar sucesso com detalhes
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      result
    });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON-REMINDERS] Erro crítico no job de lembretes', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  }
};
