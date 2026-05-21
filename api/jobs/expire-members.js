// api/jobs/expire-members.js
// Endpoint de cron job para expiração e remoção de membros
// Este endpoint deve ser chamado por um serviço externo de cron (cron-job.org, EasyCron, etc)

const { createBot } = require('../../src/bot');
const groupControl = require('../../src/groupControl');

/**
 * Handler do endpoint de expiração de membros
 * Executa verificação e remoção de membros expirados
 * 
 * Segurança: Requer header x-cron-secret
 * Frequência recomendada: A cada 30 minutos
 */
module.exports = async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // ===== SEGURANÇA: Validar secret =====
    const secret = req.headers['x-cron-secret'];
    
    if (!secret || secret !== process.env.CRON_SECRET) {
      console.error('❌ [CRON-EXPIRE] Tentativa de acesso não autorizada', {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        hasSecret: !!secret
      });
      
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing x-cron-secret header'
      });
    }
    
    console.log('🔄 [CRON-EXPIRE] Job de expiração iniciado', {
      timestamp: new Date().toISOString(),
      source: 'cron-endpoint'
    });
    
    // ===== CRIAR BOT E EXECUTAR JOB =====
    const bot = createBot(process.env.TELEGRAM_BOT_TOKEN);
    
    // Executar verificação de expirações
    const result = await groupControl.checkExpirations(bot);
    
    const duration = Date.now() - startTime;
    
    console.log('✅ [CRON-EXPIRE] Job concluído com sucesso', {
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
    
    console.error('❌ [CRON-EXPIRE] Erro crítico no job de expiração', {
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
