// api/jobs/broadcast.js
// Endpoint chamado pelo cron-job.org a cada 2 minutos
// Processa um lote de 50 usuários por vez — sem timeout

const { createClient } = require('@supabase/supabase-js');
const { Telegraf } = require('telegraf');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BATCH_SIZE = 50; // usuários por execução

module.exports = async function handler(req, res) {
  const startTime = Date.now();

  // ===== SEGURANÇA =====
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ===== BUSCAR CAMPANHA PENDENTE OU EM ANDAMENTO =====
    const { data: campaign, error: fetchErr } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .in('status', ['pending', 'sending'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchErr || !campaign) {
      // Nenhuma campanha para processar — OK
      return res.status(200).json({ message: 'Nenhuma campanha pendente', duration_ms: Date.now() - startTime });
    }

    console.log(`📢 [BROADCAST-JOB] Processando campanha ${campaign.id} | offset: ${campaign.current_offset}`);

    // ===== MARCAR COMO SENDING SE AINDA PENDING =====
    if (campaign.status === 'pending') {
      // Contar total de usuários desbloqueados
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_blocked', false);

      await supabase
        .from('broadcast_campaigns')
        .update({ status: 'sending', total_users: totalUsers })
        .eq('id', campaign.id);

      campaign.total_users = totalUsers;
      campaign.status = 'sending';
    }

    // ===== BUSCAR LOTE DE USUÁRIOS =====
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('is_blocked', false)
      .order('created_at', { ascending: true })
      .range(campaign.current_offset, campaign.current_offset + BATCH_SIZE - 1);

    if (usersErr) throw usersErr;

    if (!users || users.length === 0) {
      // Todos os lotes processados — marcar como concluído
      await _finalizeCampaign(campaign, supabase);
      return res.status(200).json({
        message: 'Broadcast concluído!',
        campaign_id: campaign.id,
        duration_ms: Date.now() - startTime
      });
    }

    // ===== PREPARAR BOT E MENSAGEM =====
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    const buttons = campaign.buttons_json || null;
    const replyMarkup = buttons ? { inline_keyboard: buttons } : undefined;

    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        if (campaign.image_file_id) {
          await bot.telegram.sendPhoto(user.telegram_id, campaign.image_file_id, {
            caption: campaign.message,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          });
        } else {
          await bot.telegram.sendMessage(user.telegram_id, campaign.message, {
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          });
        }
        success++;
        // 350ms de delay entre envios — rate limit seguro
        await new Promise(r => setTimeout(r, 350));
      } catch (err) {
        failed++;
        const msg = err.message || '';
        const isExpected =
          msg.includes('bot was blocked') ||
          msg.includes('user is deactivated') ||
          msg.includes('chat not found') ||
          msg.includes('user not found');
        if (!isExpected) {
          console.error(`❌ [BROADCAST-JOB] Erro inesperado para ${user.telegram_id}:`, msg);
        }
      }
    }

    const newOffset = campaign.current_offset + users.length;
    const newSuccess = (campaign.success_count || 0) + success;
    const newFailed = (campaign.failed_count || 0) + failed;
    const isLast = users.length < BATCH_SIZE;

    if (isLast) {
      // Último lote — finalizar
      await _finalizeCampaign({ ...campaign, success_count: newSuccess, failed_count: newFailed }, supabase);

      // Notificar criador
      if (campaign.creator_telegram_id) {
        try {
          await bot.telegram.sendMessage(
            campaign.creator_telegram_id,
            `✅ *CASTCUPOM CONCLUÍDO!*\n\n` +
            `📊 *Resultado Final:*\n` +
            `✅ Enviados: ${newSuccess}\n` +
            `❌ Falhas: ${newFailed}\n` +
            `👥 Total: ${campaign.total_users}\n\n` +
            `_Todos os usuários foram notificados!_`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.warn('⚠️ [BROADCAST-JOB] Não foi possível notificar criador:', e.message);
        }
      }
    } else {
      // Atualizar progresso para próximo lote
      await supabase
        .from('broadcast_campaigns')
        .update({
          current_offset: newOffset,
          success_count: newSuccess,
          failed_count: newFailed,
          sent_count: newSuccess
        })
        .eq('id', campaign.id);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [BROADCAST-JOB] Lote concluído | enviados: ${success} | falhas: ${failed} | próximo offset: ${newOffset} | ${duration}ms`);

    return res.status(200).json({
      campaign_id: campaign.id,
      batch_sent: success,
      batch_failed: failed,
      next_offset: newOffset,
      total_users: campaign.total_users,
      completed: isLast,
      duration_ms: duration
    });

  } catch (err) {
    console.error('❌ [BROADCAST-JOB] Erro crítico:', err.message);
    return res.status(500).json({ error: err.message, duration_ms: Date.now() - startTime });
  }
};

async function _finalizeCampaign(campaign, supabase) {
  await supabase
    .from('broadcast_campaigns')
    .update({
      status: 'sent',
      success_count: campaign.success_count,
      failed_count: campaign.failed_count,
      sent_count: campaign.success_count,
      completed_at: new Date().toISOString()
    })
    .eq('id', campaign.id);
}
