// src/jobs/sendPaymentReminders.js
// Job automático para enviar lembretes de pagamento dentro da janela de 30 minutos
// Envia 3 lembretes: aos 5, 15 e 27 minutos. O último (27 min) reenvia QR Code + Copia e Cola.

const db = require('../database');
const QRCode = require('qrcode');

// Checkpoints de lembrete: minuto alvo, janela mínima, janela máxima, marcador no banco,
// minutos restantes informados ao cliente, e se deve reenviar QR Code + Copia e Cola
const REMINDER_CHECKPOINTS = [
  { min: 4, max: 7, marker: '[REMINDER_SENT_5]', minutesLeftLabel: 25, resendPix: true, isFinal: false },
  { min: 13, max: 17, marker: '[REMINDER_SENT_15]', minutesLeftLabel: 15, resendPix: true, isFinal: false },
  { min: 25, max: 29, marker: '[REMINDER_SENT_27]', minutesLeftLabel: 3, resendPix: true, isFinal: true }
];

/**
 * Envia lembretes de pagamento para transações pendentes em até 3 momentos
 * dentro da janela de 30 minutos (5, 15 e 27 minutos de idade).
 * O lembrete de 27 minutos reenvia o QR Code e o Copia e Cola, já que é o último aviso
 * antes da expiração.
 * Rodado via Serverless Cron (ex: cron-job.org)
 */
async function sendPaymentReminders(bot) {
  try {
    console.log('⏰ [REMINDER-JOB] Iniciando verificação de lembretes de pagamento...');

    // Buscar todas as transações pendentes criadas nos últimos 30 minutos
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    let transactions = [];
    let retries = 3;
    let lastError = null;

    while (retries > 0) {
      try {
        const result = await db.supabase
          .from('transactions')
          .select('*')
          .eq('status', 'pending')
          .gte('created_at', thirtyMinutesAgo.toISOString())
          .order('created_at', { ascending: true });

        if (result.error) {
          throw result.error;
        }

        if (result.data) {
          transactions = result.data;
          break;
        }

        throw new Error('Resposta sem dados do Supabase');
      } catch (err) {
        lastError = err;
        retries--;
        if (retries > 0) {
          console.warn(`⚠️ [REMINDER-JOB] Falha ao buscar transações, tentando novamente em 2s (${retries} restando)...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (lastError && transactions.length === 0) {
      console.error('❌ [REMINDER-JOB] Erro ao buscar transações do Supabase após retentativas:', lastError);
      return { sent: 0, error: lastError.message };
    }

    if (transactions.length === 0) {
      console.log('✅ [REMINDER-JOB] Nenhuma transação pendente recente encontrada');
      return { sent: 0 };
    }

    console.log(`📊 [REMINDER-JOB] ${transactions.length} transações pendentes recentes para analisar`);

    const now = new Date();
    let sentCount = 0;

    for (const transaction of transactions) {
      try {
        const createdAt = new Date(transaction.created_at);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        const notes = transaction.notes || '';

        const checkpoint = REMINDER_CHECKPOINTS.find(
          cp => diffMinutes >= cp.min && diffMinutes <= cp.max
        );

        if (!checkpoint) {
          const diffStr = Math.floor(diffMinutes);
          console.log(`⏳ [REMINDER-JOB] Transação ${transaction.txid} fora de janela de lembrete (${diffStr} min de idade)`);
          continue;
        }

        if (notes.includes(checkpoint.marker)) {
          console.log(`⏭️ [REMINDER-JOB] Lembrete ${checkpoint.marker} já enviado para txid: ${transaction.txid}`);
          continue;
        }

        console.log(`⏰ [REMINDER-JOB] Transação ${transaction.txid} na janela ${checkpoint.marker} (${Math.floor(diffMinutes)} minutos de idade)`);

        const freshTx = await db.getTransactionByTxid(transaction.txid);
        if (!freshTx || freshTx.status !== 'pending') {
          console.log(`⏭️ [REMINDER-JOB] Transação ${transaction.txid} já mudou de status (status atual: ${freshTx?.status || 'desconhecido'})`);
          continue;
        }

        const amountFormatted = parseFloat(transaction.amount).toFixed(2).replace('.', ',');
        const pixPayload = transaction.pix_payload || transaction.pixPayload || 'N/A';

        // Mensagem varia o tom: 5 e 15 min usam aviso normal; 27 min usa tom de "último aviso".
        // Em todos os casos agora reenviamos QR Code + Copia e Cola, pra evitar o cliente perder a transação de vista.
        let reminderMessage;
        if (checkpoint.isFinal) {
          reminderMessage = `⏰ *ÚLTIMO AVISO DE PAGAMENTO*

🚨 *Faltam apenas ${checkpoint.minutesLeftLabel} minutos para expirar!*

💰 *Valor:* R$ ${amountFormatted}

📋 *Copia e Cola:*
\`${pixPayload}\`

📸 *Escaneie o QR Code acima para pagar.*
Após realizar o pagamento, envie o comprovante por aqui.

🆔 *ID:* \`${transaction.txid}\``;
        } else {
          reminderMessage = `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Faltam ${checkpoint.minutesLeftLabel} minutos para expirar.*

💰 *Valor:* R$ ${amountFormatted}

📋 *Copia e Cola:*
\`${pixPayload}\`

📸 *Escaneie o QR Code acima para pagar.*
Após realizar o pagamento, envie o comprovante por aqui.

🆔 *ID:* \`${transaction.txid}\``;
        }

        // Gerar QR Code em todos os lembretes agora (5, 15 e 27 min)
        let qrcodeBuffer = null;
        if (checkpoint.resendPix) {
          try {
            qrcodeBuffer = await QRCode.toBuffer(pixPayload);
          } catch (qrErr) {
            console.error(`❌ [REMINDER-JOB] Erro ao gerar QRCode para txid ${transaction.txid}:`, qrErr.message);
          }
        }

        let sentSuccessfully = false;
        let sendRetries = 3;
        let userBlockedBot = false;

        while (sendRetries > 0 && !sentSuccessfully && !userBlockedBot) {
          try {
            if (qrcodeBuffer) {
              await bot.telegram.sendPhoto(transaction.telegram_id, { source: qrcodeBuffer }, {
                caption: reminderMessage,
                parse_mode: 'Markdown'
              });
            } else {
              await bot.telegram.sendMessage(transaction.telegram_id, reminderMessage, {
                parse_mode: 'Markdown'
              });
            }
            sentSuccessfully = true;
            sentCount++;
            console.log(`✅ [REMINDER-JOB] Lembrete ${checkpoint.marker} enviado com sucesso para usuário ${transaction.telegram_id} (txid: ${transaction.txid})`);
          } catch (sendErr) {
            if (sendErr.response && (sendErr.response.error_code === 403 || sendErr.response.error_code === 400)) {
              console.log(`ℹ️ [REMINDER-JOB] Bot bloqueado ou chat inválido para usuário ${transaction.telegram_id} — pulando retentativas`);
              userBlockedBot = true;
              break;
            }

            sendRetries--;
            if (sendRetries > 0) {
              console.warn(`⚠️ [REMINDER-JOB] Falha ao enviar mensagem para ${transaction.telegram_id}, tentando novamente em 2s...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              console.error(`❌ [REMINDER-JOB] Falha ao enviar lembrete após 3 tentativas para ${transaction.txid}:`, sendErr.message);
            }
          }
        }

        if (sentSuccessfully || userBlockedBot) {
          try {
            const newNotes = notes ? `${notes} | ${checkpoint.marker}` : checkpoint.marker;

            const { error: updateErr } = await db.supabase
              .from('transactions')
              .update({
                notes: newNotes,
                updated_at: new Date().toISOString()
              })
              .eq('txid', transaction.txid);

            if (updateErr) {
              console.error(`❌ [REMINDER-JOB] Erro ao salvar marcação ${checkpoint.marker} para ${transaction.txid}:`, updateErr.message);
            } else {
              console.log(`💾 [REMINDER-JOB] Marcação ${checkpoint.marker} salva no banco de dados para ${transaction.txid}`);
            }
          } catch (dbErr) {
            console.error(`❌ [REMINDER-JOB] Exceção ao salvar marcação no banco para ${transaction.txid}:`, dbErr.message);
          }
        }
      } catch (txErr) {
        console.error(`❌ [REMINDER-JOB] Erro ao processar transação individual ${transaction.txid}:`, txErr);
      }
    }

    return { sent: sentCount, total: transactions.length };
  } catch (err) {
    console.error('❌ [REMINDER-JOB] Erro geral na execução do job:', err);
    return { sent: 0, error: err.message };
  }
}

/**
 * Inicia o job de lembretes de pagamento (Compatibilidade local)
 */
function startReminderJob(bot) {
  if (!bot) {
    console.error('❌ [REMINDER-JOB] Bot não fornecido — job local não iniciado');
    return null;
  }

  console.log('🚀 [REMINDER-JOB] Job de lembretes iniciado localmente (setInterval de 2 min, 3 checkpoints: 5/15/27 min)');

  sendPaymentReminders(bot);

  const interval = setInterval(() => {
    sendPaymentReminders(bot);
  }, 2 * 60 * 1000);

  return interval;
}

module.exports = {
  sendPaymentReminders,
  startReminderJob
};
