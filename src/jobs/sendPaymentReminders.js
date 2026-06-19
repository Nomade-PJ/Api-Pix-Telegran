// src/jobs/sendPaymentReminders.js
// Job automático para enviar lembretes de pagamento aos 15 minutos (janela de 12 a 18 min)

const db = require('../database');
const QRCode = require('qrcode');

/**
 * Envia lembretes de pagamento para transações pendentes com cerca de 15 minutos
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
    
    // Retry logic para consultar o Supabase
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
          break; // Sucesso, sair do loop
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
        // 1. Ignorar se já tiver a marcação de lembrete enviado no campo notes
        if (transaction.notes && transaction.notes.includes('[REMINDER_SENT]')) {
          console.log(`⏭️ [REMINDER-JOB] Lembrete já enviado anteriormente para txid: ${transaction.txid}`);
          continue;
        }
        
        // 2. Calcular idade da transação em minutos
        const createdAt = new Date(transaction.created_at);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        
        // Janela de 12 a 18 minutos (garante envio se o cron rodar a cada 2 ou 5 min)
        if (diffMinutes >= 12 && diffMinutes <= 18) {
          console.log(`⏰ [REMINDER-JOB] Transação ${transaction.txid} na janela de envio (${Math.floor(diffMinutes)} minutos de idade)`);
          
          // Double check: verificar se a transação ainda está pendente no banco
          const freshTx = await db.getTransactionByTxid(transaction.txid);
          if (!freshTx || freshTx.status !== 'pending') {
            console.log(`⏭️ [REMINDER-JOB] Transação ${transaction.txid} já mudou de status (status atual: ${freshTx?.status || 'desconhecido'})`);
            continue;
          }
          
          // Formatar valor (ex: R$ 10,00)
          const amountFormatted = parseFloat(transaction.amount).toFixed(2).replace('.', ',');
          
          // Mensagem limpa: informando 15 minutos, omitindo a chave crua e mantendo instrução clara
          const reminderMessage = `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Seu prazo de pagamento expira em 15 minutos!*

💰 *Valor:* R$ ${amountFormatted}

📋 *Copia e Cola:*
\`${transaction.pix_payload || transaction.pixPayload || 'N/A'}\`

📸 *Escaneie o QR Code acima para pagar.*
Após realizar o pagamento, envie o comprovante por aqui.

🆔 *ID:* \`${transaction.txid}\``;
          
          // Gerar Buffer do QRCode
          let qrcodeBuffer = null;
          try {
            qrcodeBuffer = await QRCode.toBuffer(transaction.pix_payload || transaction.pixPayload);
          } catch (qrErr) {
            console.error(`❌ [REMINDER-JOB] Erro ao gerar QRCode para txid ${transaction.txid}:`, qrErr.message);
          }
          
          // Tentar enviar para o usuário via Telegram
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
              console.log(`✅ [REMINDER-JOB] Lembrete enviado com sucesso para usuário ${transaction.telegram_id} (txid: ${transaction.txid})`);
            } catch (sendErr) {
              // Tratar caso onde o bot foi bloqueado pelo usuário
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
          
          // Se o lembrete foi enviado com sucesso OU o usuário bloqueou o bot, marcamos no banco para não tentar de novo
          if (sentSuccessfully || userBlockedBot) {
            try {
              const currentNotes = transaction.notes || '';
              const newNotes = currentNotes ? `${currentNotes} | [REMINDER_SENT]` : '[REMINDER_SENT]';
              
              const { error: updateErr } = await db.supabase
                .from('transactions')
                .update({
                  notes: newNotes,
                  updated_at: new Date().toISOString()
                })
                .eq('txid', transaction.txid);
                
              if (updateErr) {
                console.error(`❌ [REMINDER-JOB] Erro ao salvar marcação [REMINDER_SENT] para ${transaction.txid}:`, updateErr.message);
              } else {
                console.log(`💾 [REMINDER-JOB] Marcação [REMINDER_SENT] salva no banco de dados para ${transaction.txid}`);
              }
            } catch (dbErr) {
              console.error(`❌ [REMINDER-JOB] Exceção ao salvar marcação no banco para ${transaction.txid}:`, dbErr.message);
            }
          }
        } else {
          // Apenas logs informativos de debug
          const diffStr = Math.floor(diffMinutes);
          if (diffMinutes < 12) {
            console.log(`⏳ [REMINDER-JOB] Transação ${transaction.txid} é muito recente (${diffStr} min de idade, aguardando 15 min)`);
          } else {
            console.log(`⏭️ [REMINDER-JOB] Transação ${transaction.txid} já passou da janela de 15 min (${diffStr} min de idade)`);
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
  
  console.log('🚀 [REMINDER-JOB] Job de lembretes iniciado localmente (setInterval de 2 min)');
  
  // Executar imediatamente
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
