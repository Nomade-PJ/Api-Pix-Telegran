// src/jobs/sendPaymentReminders.js
// Job automático para enviar lembretes de pagamento aos 15 minutos

const db = require('../database');

/**
 * Envia lembretes de pagamento para transações pendentes com 15 minutos
 * Roda automaticamente a cada 2 minutos
 */
async function sendPaymentReminders(bot) {
  try {
    console.log('⏰ [REMINDER-JOB] Iniciando verificação de lembretes de pagamento...');
    
    // Buscar todas as transações pendentes criadas nos últimos 20 minutos
    const twentyMinutesAgo = new Date();
    twentyMinutesAgo.setMinutes(twentyMinutesAgo.getMinutes() - 20);
    
    const { data: transactions, error } = await db.supabase
      .from('transactions')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', twentyMinutesAgo.toISOString())
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ [REMINDER-JOB] Erro ao buscar transações:', error);
      return { sent: 0, error: error.message };
    }
    
    if (!transactions || transactions.length === 0) {
      console.log('✅ [REMINDER-JOB] Nenhuma transação pendente encontrada');
      return { sent: 0 };
    }
    
    console.log(`📊 [REMINDER-JOB] ${transactions.length} transações pendentes encontradas`);
    
    const now = new Date();
    let sentCount = 0;
    const reminderSent = new Set(); // Para evitar duplicatas na mesma execução
    
    for (const transaction of transactions) {
      try {
        const createdAt = new Date(transaction.created_at);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        
        // Verificar se tem entre 14 e 16 minutos (janela maior para garantir envio)
        // Isso garante que o lembrete seja enviado mesmo se o job rodar um pouco antes ou depois
        if (diffMinutes >= 14 && diffMinutes <= 16) {
          // Verificar se já foi enviado nesta execução (usar txid como chave única)
          if (reminderSent.has(transaction.txid)) {
            console.log(`⏭️ [REMINDER-JOB] Lembrete já enviado nesta execução para ${transaction.txid}`);
            continue;
          }
          
          // Verificar se a transação ainda está pendente (sem buscar novamente se já temos os dados)
          if (transaction.status !== 'pending') {
            console.log(`⏭️ [REMINDER-JOB] Transação ${transaction.txid} não está mais pendente (status: ${transaction.status})`);
            continue;
          }
          
          console.log(`⏰ [REMINDER-JOB] Enviando lembrete para transação ${transaction.txid} (${Math.floor(diffMinutes)} minutos)`);
          
          // Verificar novamente se ainda está pendente (double-check)
          const fullTransaction = await db.getTransactionByTxid(transaction.txid);
          if (!fullTransaction || fullTransaction.status !== 'pending') {
            console.log(`⏭️ [REMINDER-JOB] Transação ${transaction.txid} não está mais pendente (verificação final)`);
            continue;
          }
          
          // Calcular tempo de expiração
          const expirationTime = new Date(createdAt.getTime() + 30 * 60 * 1000);
          const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
          
          // Preparar mensagem de lembrete
          const reminderMessage = `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Faltam 15 minutos* para expirar!

💰 Valor: R$ ${transaction.amount}
🔑 Chave: ${transaction.pix_key}

📋 Cópia & Cola:
\`${transaction.pix_payload || transaction.pixPayload || 'N/A'}\`

⏰ *Expira às:* ${expirationStr}

📸 Após pagar, envie o comprovante.

🆔 TXID: ${transaction.txid}`;
          
          // Enviar lembrete com retry para erros de conexão
          let sentSuccessfully = false;
          let retries = 3;
          let lastError = null;
          
          while (retries > 0 && !sentSuccessfully) {
            try {
              await bot.telegram.sendMessage(transaction.telegram_id, reminderMessage, { 
                parse_mode: 'Markdown' 
              });
              
              reminderSent.add(transaction.txid);
              sentCount++;
              sentSuccessfully = true;
              console.log(`✅ [REMINDER-JOB] Lembrete enviado para ${transaction.txid}`);
            } catch (sendErr) {
              lastError = sendErr;
              
              // Tratar especificamente quando o bot foi bloqueado pelo usuário (não tentar retry)
              if (sendErr.response && sendErr.response.error_code === 403) {
                console.log(`ℹ️ [REMINDER-JOB] Bot bloqueado pelo usuário ${transaction.telegram_id} - lembrete não enviado`);
                break; // Não tentar retry para usuário bloqueado
              }
              
              // Verificar se é erro de conexão (socket hang up, timeout, etc)
              const isConnectionError = sendErr.message && (
                sendErr.message.includes('socket hang up') ||
                sendErr.message.includes('fetch failed') ||
                sendErr.message.includes('SocketError') ||
                sendErr.message.includes('other side closed') ||
                sendErr.message.includes('ECONNRESET') ||
                sendErr.message.includes('ETIMEDOUT') ||
                sendErr.message.includes('ECONNREFUSED') ||
                sendErr.code === 'ECONNRESET' ||
                sendErr.code === 'ETIMEDOUT' ||
                sendErr.code === 'ECONNREFUSED'
              );
              
              if (!isConnectionError) {
                // Não é erro de conexão, não tentar retry
                console.error(`❌ [REMINDER-JOB] Erro ao enviar lembrete para ${transaction.txid} (não é erro de conexão):`, sendErr.message);
                break; // Sair do loop de retry
              }
              
              // É erro de conexão, tentar retry
              retries--;
              if (retries > 0) {
                console.warn(`⚠️ [REMINDER-JOB] Erro de conexão ao enviar lembrete para ${transaction.txid}: ${sendErr.message}`);
                console.warn(`⚠️ [REMINDER-JOB] Tentando novamente... (${retries} tentativas restantes)`);
                // Aguardar 2 segundos antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                console.error(`❌ [REMINDER-JOB] Erro ao enviar lembrete para ${transaction.txid} após 3 tentativas:`, sendErr.message);
              }
            }
          }
          
          // Se não conseguiu enviar após todas as tentativas e foi erro de conexão, não marcar como enviado
          // Isso permite que o job tente novamente no próximo ciclo
          if (!sentSuccessfully && lastError) {
            const isConnectionError = lastError.message && (
              lastError.message.includes('socket hang up') ||
              lastError.message.includes('fetch failed') ||
              lastError.message.includes('SocketError') ||
              lastError.message.includes('ECONNRESET') ||
              lastError.message.includes('ETIMEDOUT')
            );
            
            if (isConnectionError) {
              console.warn(`⚠️ [REMINDER-JOB] Lembrete para ${transaction.txid} não foi enviado por erro de conexão - será tentado novamente no próximo ciclo`);
            }
          }
        } else {
          const minutesLeft = Math.floor(30 - diffMinutes);
          if (diffMinutes < 14.5) {
            console.log(`⏳ [REMINDER-JOB] Transação ${transaction.txid} ainda não chegou aos 15 minutos (${minutesLeft} minutos restantes)`);
          } else if (diffMinutes > 15.5) {
            console.log(`⏭️ [REMINDER-JOB] Transação ${transaction.txid} já passou dos 15 minutos (${minutesLeft} minutos restantes)`);
          }
        }
      } catch (err) {
        console.error(`❌ [REMINDER-JOB] Erro ao processar transação ${transaction.txid}:`, err.message);
      }
    }
    
    if (sentCount > 0) {
      console.log(`✅ [REMINDER-JOB] ${sentCount} lembrete(s) enviado(s)`);
    } else {
      console.log('✅ [REMINDER-JOB] Nenhum lembrete enviado neste ciclo');
    }
    
    return { sent: sentCount, total: transactions.length };
    
  } catch (err) {
    console.error('❌ [REMINDER-JOB] Erro crítico:', err);
    return { sent: 0, error: err.message };
  }
}

/**
 * Inicia o job de lembretes de pagamento
 * Executa a cada 2 minutos
 */
function startReminderJob(bot) {
  if (!bot) {
    console.error('❌ [REMINDER-JOB] Bot não fornecido - job não iniciado');
    return null;
  }
  
  console.log('🚀 [REMINDER-JOB] Job de lembretes iniciado - executará a cada 2 minutos');
  
  // Executar imediatamente na inicialização
  sendPaymentReminders(bot);
  
  // Executar a cada 2 minutos (120.000ms)
  const interval = setInterval(() => {
    sendPaymentReminders(bot);
  }, 2 * 60 * 1000); // 2 minutos
  
  // Retornar interval para poder cancelar se necessário
  return interval;
}

module.exports = {
  sendPaymentReminders,
  startReminderJob
};

