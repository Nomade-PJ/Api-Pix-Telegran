// src/jobs/retryDeliveries.js
// Job automático: tenta reenviar entregas que falharam por erro temporário

const db = require('../database');
const deliver = require('../deliver');

/**
 * Busca transações com delivery_failed (não bloqueadas) e tenta reenviar.
 * Roda a cada 20 minutos.
 */
async function retryFailedDeliveries(botInstance) {
  try {
    console.log('🔄 [RETRY-JOB] Verificando entregas com falha...');

    const failed = await db.getFailedDeliveries();

    if (failed.length === 0) {
      console.log('✅ [RETRY-JOB] Nenhuma entrega pendente de reenvio');
      return { retried: 0 };
    }

    console.log(`📋 [RETRY-JOB] ${failed.length} entrega(s) para tentar reenviar`);

    let retriedOk = 0;
    let retriedFail = 0;

    for (const tx of failed) {
      console.log(`🔄 [RETRY-JOB] Tentando reenviar TXID: ${tx.txid} (tentativa ${tx.delivery_attempts + 1})`);

      try {
        // ---- Produto normal ----
        if (tx.product_id && !tx.product_id.startsWith('group_')) {
          const product = await db.getProduct(tx.product_id, true);
          if (!product) throw new Error(`Produto ${tx.product_id} não encontrado`);
          await deliver.deliverContent(tx.telegram_id, product);
        }

        // ---- Media pack ----
        if (tx.media_pack_id) {
          const { data: transData } = await db.supabase
            .from('transactions')
            .select('id')
            .eq('txid', tx.txid)
            .single();
          await deliver.deliverMediaPack(tx.telegram_id, tx.media_pack_id, tx.user_id, transData.id, db);
        }

        // ---- Grupo ----
        if (tx.group_id || (tx.product_id && tx.product_id.startsWith('group_'))) {
          let group = null;
          if (tx.group_id) {
            const { data } = await db.supabase.from('groups').select('*').eq('id', tx.group_id).single();
            group = data;
          }
          if (!group && tx.product_id?.startsWith('group_')) {
            const gid = parseInt(tx.product_id.replace('group_', ''));
            group = await db.getGroupById(gid);
          }
          if (!group) throw new Error('Grupo não encontrado');
          await botInstance.telegram.sendMessage(tx.telegram_id,
            `✅ *SEU ACESSO FOI LIBERADO!*\n\n👥 Grupo: ${group.group_name}\n🔗 ${group.group_link}`,
            { parse_mode: 'Markdown' }
          );
        }

        // Sucesso: marcar como entregue
        await db.markAsDelivered(tx.txid);
        retriedOk++;
        console.log(`✅ [RETRY-JOB] Reenvio bem-sucedido: ${tx.txid}`);

      } catch (err) {
        const errorType = deliver.classifyDeliveryError(err);
        console.error(`❌ [RETRY-JOB] Reenvio falhou (${errorType}): ${tx.txid} — ${err.message}`);

        // Atualizar contador e tipo de erro
        await db.markDeliveryFailed(tx.txid, err.message, errorType);

        // Se bloqueou o bot, notificar admins imediatamente
        if (errorType === 'blocked') {
          await notifyAdmins(botInstance, tx, err.message, errorType);
        }

        retriedFail++;
      }

      // Pequeno delay entre tentativas para não saturar a API
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`✅ [RETRY-JOB] Concluído: ${retriedOk} ok | ${retriedFail} ainda com falha`);
    return { retried: retriedOk, failed: retriedFail };

  } catch (err) {
    console.error('❌ [RETRY-JOB] Erro crítico:', err.message);
    return { retried: 0, error: err.message };
  }
}

/**
 * Notifica todos os admins sobre uma falha de entrega com botões de ação
 */
async function notifyAdmins(botInstance, tx, errorMessage, errorType) {
  try {
    const admins = await db.getAdmins();
    if (!admins || admins.length === 0) return;

    const esc = (s) => String(s || '').replace(/([_*`\[\]])/g, '\\$1');

    const typeLabel = {
      blocked: '🚫 Usuário bloqueou o bot',
      temporary: '⏱️ Erro temporário de rede',
      unknown: '❓ Erro desconhecido'
    }[errorType] || errorType;

    const userName = tx.user?.first_name || 'N/A';
    const userUsername = tx.user?.username ? `@${esc(tx.user.username)}` : 'sem username';
    const produto = tx.product_id || tx.media_pack_id || tx.group_id || 'N/A';

    const message =
      `⚠️ *FALHA NA ENTREGA*\n\n` +
      `👤 ${esc(userName)} \\(${userUsername}\\)\n` +
      `🔢 ID: \`${tx.telegram_id}\`\n` +
      `📦 Produto: \`${esc(produto)}\`\n` +
      `💵 Valor: R$ ${tx.amount}\n` +
      `❌ Motivo: ${typeLabel}\n` +
      `🔁 Tentativas: ${tx.delivery_attempts}\n` +
      `🆔 TXID: \`${esc(tx.txid)}\``;

    const keyboard = {
      inline_keyboard: [[
        { text: '🔄 Tentar Novamente', callback_data: `retry_delivery:${tx.txid}` },
        { text: '✅ Marcar Entregue', callback_data: `force_delivered:${tx.txid}` }
      ]]
    };

    for (const admin of admins) {
      try {
        await botInstance.telegram.sendMessage(admin.telegram_id, message, {
          parse_mode: 'MarkdownV2',
          reply_markup: keyboard
        });
      } catch (e) {
        console.error(`❌ [RETRY-JOB] Erro ao notificar admin ${admin.telegram_id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('❌ [RETRY-JOB] Erro ao notificar admins:', err.message);
  }
}

/**
 * Inicia o job de reenvio automático a cada 20 minutos
 */
function startRetryJob(botInstance) {
  console.log('🚀 [RETRY-JOB] Job de reenvio iniciado — executará a cada 20 minutos');

  // Aguarda 2 minutos antes da primeira execução (deixar o bot estabilizar)
  setTimeout(() => {
    retryFailedDeliveries(botInstance);
    setInterval(() => retryFailedDeliveries(botInstance), 20 * 60 * 1000);
  }, 2 * 60 * 1000);
}

module.exports = { startRetryJob, retryFailedDeliveries, notifyAdmins };
