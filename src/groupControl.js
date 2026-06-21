// src/groupControl.js
const db = require('./database');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');

async function checkExpirations(bot) {
  const startTime = Date.now();
  const stats = {
    reminders_3_days: 0,
    reminders_urgent: 0,
    removed: 0,
    errors: 0,
    skipped_locked: 0
  };
  
  try {
    console.log('🔍 [GROUP-CONTROL] Verificando expirações de assinaturas...', {
      timestamp: new Date().toISOString()
    });
    
    // 1. Enviar lembretes COM QR CODE (3 dias antes)
    const expiring = await db.getExpiringMembers();
    console.log(`📊 [GROUP-CONTROL] ${expiring.length} membro(s) expirando em 3 dias`, {
      timestamp: new Date().toISOString(),
      count: expiring.length
    });
    
    for (const member of expiring) {
      try {
        const expiresAt = new Date(member.expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        
        const group = member.group;
        const amount = parseFloat(group?.subscription_price || 30.00).toFixed(2);
        
        console.log(`⏰ [GROUP-CONTROL] Enviando lembrete de 3 dias`, {
          telegram_id: member.telegram_id,
          expires_at: member.expires_at,
          days_left: daysLeft,
          group_name: group?.group_name
        });
        
        // 🆕 GERAR QR CODE NO LEMBRETE DE 3 DIAS
        try {
          // 🆕 VERIFICAR SE JÁ EXISTE TRANSAÇÃO PENDENTE DE RENOVAÇÃO PARA ESTE GRUPO
          let existingTransaction = null;
          let retries = 3;
          
          while (retries > 0) {
            try {
              const { data: pendingRenewals, error: renewalError } = await db.supabase
                .from('transactions')
                .select('*')
                .eq('telegram_id', member.telegram_id)
                .eq('group_id', group.id)
                .in('status', ['pending', 'proof_sent'])
                .order('created_at', { ascending: false })
                .limit(1);
              
              if (renewalError) {
                const errorMessage = renewalError.message || '';
                const isConnectionError = (
                  errorMessage.includes('fetch failed') ||
                  errorMessage.includes('SocketError') ||
                  errorMessage.includes('ECONNRESET') ||
                  errorMessage.includes('ETIMEDOUT')
                );
                
                if (isConnectionError && retries > 1) {
                  retries--;
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                }
                throw renewalError;
              }
              
              existingTransaction = pendingRenewals && pendingRenewals.length > 0 ? pendingRenewals[0] : null;
              break;
            } catch (err) {
              const errorMessage = err.message || '';
              const isConnectionError = (
                errorMessage.includes('fetch failed') ||
                errorMessage.includes('SocketError') ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('ETIMEDOUT')
              );
              
              if (isConnectionError && retries > 1) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              throw err;
            }
          }
          
          // Se já existe transação pendente, usar ela em vez de criar nova
          if (existingTransaction) {
            console.log(`⏭️ [GROUP-CONTROL] Já existe transação pendente ${existingTransaction.txid} para renovação - reutilizando`);
            
            // Buscar dados da transação existente
            const charge = {
              charge: {
                txid: existingTransaction.txid,
                key: existingTransaction.pix_key,
                copiaCola: existingTransaction.pix_payload,
                qrcodeBuffer: null // Não temos o buffer, mas podemos gerar se necessário
              }
            };
            
            // Gerar QR Code se necessário
            if (!charge.charge.qrcodeBuffer) {
              try {
                const QRCode = require('qrcode');
                charge.charge.qrcodeBuffer = await QRCode.toBuffer(existingTransaction.pix_payload);
              } catch (qrErr) {
                console.warn('⚠️ [GROUP-CONTROL] Não foi possível gerar QR Code da transação existente');
              }
            }
            
            // Calcular expiração baseada na criação (7 dias para lembretes)
            const expirationTime = new Date(existingTransaction.created_at);
            expirationTime.setDate(expirationTime.getDate() + 7); // 7 dias para lembretes
            const expirationStr = expirationTime.toLocaleDateString('pt-BR', { 
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            
            // Enviar mensagem com transação existente
            try {
              if (charge.charge.qrcodeBuffer) {
                await bot.telegram.sendPhoto(
                  member.telegram_id,
                  { source: charge.charge.qrcodeBuffer },
                  {
                    caption: `⏰ *LEMBRETE DE RENOVAÇÃO - ${daysLeft} DIAS*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *Renove agora e mantenha seu acesso!*

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 7 dias para pagamento (lembrete antecipado)

📸 Após pagar, envie o comprovante aqui.
Após aprovação, sua assinatura será renovada automaticamente!

Não perca o acesso! 🚀

🆔 TXID: ${charge.charge.txid}`,
                    parse_mode: 'Markdown'
                  }
                );
              } else {
                await bot.telegram.sendMessage(member.telegram_id, `⏰ *LEMBRETE DE RENOVAÇÃO - ${daysLeft} DIAS*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *Renove agora e mantenha seu acesso!*

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 7 dias para pagamento (lembrete antecipado)

📸 Após pagar, envie o comprovante aqui.

🆔 TXID: ${charge.charge.txid}`, {
                  parse_mode: 'Markdown'
                });
              }

              console.log(`✅ [GROUP-CONTROL] Lembrete enviado reutilizando transação existente ${existingTransaction.txid}`);
            } catch (sendErr) {
              // Verificar se é erro esperado (bot bloqueado, usuário deletado, etc)
              const isExpectedError = (
                sendErr.message?.includes('bot was blocked') ||
                sendErr.message?.includes('bot was blocked by the user') ||
                sendErr.message?.includes('user is deactivated') ||
                sendErr.message?.includes('chat not found') ||
                sendErr.message?.includes('PEER_ID_INVALID') ||
                sendErr.message?.includes('USER_DEACTIVATED') ||
                sendErr.message?.includes('Forbidden') ||
                (sendErr.response && sendErr.response.error_code === 403)
              );

              if (isExpectedError) {
                console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível (bloqueou bot ou conta deletada)`, {
                  telegram_id: member.telegram_id,
                  reason: sendErr.message || sendErr.response?.description
                });
                throw sendErr; // Re-throw para ser tratado no catch externo
              }
              throw sendErr; // Re-throw outros erros
            }
          } else {
            // Não existe transação pendente - criar nova (mas sem expiração curta no lembrete)
            console.log(`➕ [GROUP-CONTROL] Criando nova transação de renovação para lembrete de 3 dias`);
            
            // Gerar cobrança PIX
            const charge = await manualPix.createManualCharge({
              amount,
              productId: `group_renewal_reminder_${group.id}`
            });
            
            const txid = charge.charge.txid;
            // 🆕 EXPIRAÇÃO MAIOR PARA LEMBRETE DE 3 DIAS (7 dias ao invés de 30 minutos)
            const expirationTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
            const expirationStr = expirationTime.toLocaleDateString('pt-BR', { 
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            
            // Salvar transação de renovação pendente
            await db.createTransaction({
              txid,
              userId: member.user_id,
              telegramId: member.telegram_id,
              productId: null,
              amount,
              pixKey: charge.charge.key,
              pixPayload: charge.charge.copiaCola,
              mediaPackId: null,
              groupId: group.id
            });
            
            // Enviar QR Code
            try {
              if (charge.charge.qrcodeBuffer) {
                await bot.telegram.sendPhoto(
                member.telegram_id,
                { source: charge.charge.qrcodeBuffer },
                {
                  caption: `⏰ *LEMBRETE DE RENOVAÇÃO - ${daysLeft} DIAS*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *Renove agora e mantenha seu acesso!*

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 7 dias para pagamento (lembrete antecipado)

📸 Após pagar, envie o comprovante aqui.
Após aprovação, sua assinatura será renovada automaticamente!

Não perca o acesso! 🚀

🆔 TXID: ${txid}`,
                  parse_mode: 'Markdown'
                }
              );
              } else {
                // Fallback sem QR Code
                await bot.telegram.sendMessage(member.telegram_id, `⏰ *LEMBRETE DE RENOVAÇÃO - ${daysLeft} DIAS*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *Renove agora e mantenha seu acesso!*

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 7 dias para pagamento (lembrete antecipado)

📸 Após pagar, envie o comprovante aqui.

🆔 TXID: ${txid}`, {
                  parse_mode: 'Markdown'
                });
              }
              
              console.log(`✅ [GROUP-CONTROL] Lembrete com QR Code enviado para ${member.telegram_id}`);
            } catch (sendErr) {
              // Verificar se é erro esperado (bot bloqueado, usuário deletado, etc)
              const isExpectedError = (
                sendErr.message?.includes('bot was blocked') ||
                sendErr.message?.includes('bot was blocked by the user') ||
                sendErr.message?.includes('user is deactivated') ||
                sendErr.message?.includes('chat not found') ||
                sendErr.message?.includes('PEER_ID_INVALID') ||
                sendErr.message?.includes('USER_DEACTIVATED') ||
                sendErr.message?.includes('Forbidden') ||
                (sendErr.response && sendErr.response.error_code === 403)
              );

              if (isExpectedError) {
                console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível (bloqueou bot ou conta deletada)`, {
                  telegram_id: member.telegram_id,
                  reason: sendErr.message || sendErr.response?.description
                });
                throw sendErr; // Re-throw para ser tratado no catch externo
              }
              throw sendErr; // Re-throw outros erros
            }
          }
        } catch (pixErr) {
          // Verificar se é erro esperado (bot bloqueado, usuário deletado, etc)
          const isExpectedError = (
            pixErr.message?.includes('bot was blocked') ||
            pixErr.message?.includes('bot was blocked by the user') ||
            pixErr.message?.includes('user is deactivated') ||
            pixErr.message?.includes('chat not found') ||
            pixErr.message?.includes('PEER_ID_INVALID') ||
            pixErr.message?.includes('USER_DEACTIVATED') ||
            pixErr.message?.includes('Forbidden') ||
            (pixErr.response && pixErr.response.error_code === 403)
          );

          if (isExpectedError) {
            console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível (bloqueou bot ou conta deletada)`, {
              telegram_id: member.telegram_id,
              reason: pixErr.message || pixErr.response?.description
            });
            throw pixErr; // Re-throw para ser tratado no catch externo
          }

          console.error(`❌ [GROUP-CONTROL] Erro ao gerar QR Code no lembrete:`, pixErr.message);
          
          // Fallback: enviar só mensagem (apenas se não for erro esperado)
          try {
            await bot.telegram.sendMessage(member.telegram_id, `⏰ *LEMBRETE DE ASSINATURA*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 Grupo: ${group?.group_name || 'Grupo'}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}
💰 Renovar por: R$ ${amount}/mês

🔄 *Para renovar:*
Use o comando /renovar e faça o pagamento.

Não perca o acesso! 🚀`, {
              parse_mode: 'Markdown'
            });
          } catch (fallbackErr) {
            // Se fallback também falhar, apenas logar e re-throw
            console.warn(`⚠️ [GROUP-CONTROL] Fallback também falhou:`, fallbackErr.message);
            throw pixErr; // Re-throw o erro original para ser tratado no catch externo
          }
        }
        
        // Marcar como lembrado
        await db.markMemberReminded(member.id);
        stats.reminders_3_days++;
        
        console.log(`✅ [GROUP-CONTROL] Lembrete de 3 dias enviado com sucesso`, {
          telegram_id: member.telegram_id,
          group_name: group?.group_name
        });
        
      } catch (err) {
        // Erros esperados que não devem ser contados (usuário bloqueou bot, conta deletada, etc)
        const isExpectedError = (
          err.message?.includes('bot was blocked') ||
          err.message?.includes('user is deactivated') ||
          err.message?.includes('chat not found') ||
          err.message?.includes('PEER_ID_INVALID') ||
          err.message?.includes('USER_DEACTIVATED')
        );
        
        if (!isExpectedError) {
          stats.errors++;
          console.error(`❌ [GROUP-CONTROL] Erro ao enviar lembrete`, {
            telegram_id: member.telegram_id,
            error: err.message,
            stack: err.stack
          });
        } else {
          console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível (bloqueou bot ou conta deletada)`, {
            telegram_id: member.telegram_id,
            reason: err.message
          });
        }
      }
    }
    
    // 🆕 2. Enviar lembretes URGENTES no dia do vencimento
    const expiringToday = await db.getExpiringToday();
    console.log(`🚨 [GROUP-CONTROL] ${expiringToday.length} membro(s) expirando HOJE - enviando lembrete urgente`, {
      timestamp: new Date().toISOString(),
      count: expiringToday.length
    });
    
    for (const member of expiringToday) {
      try {
        const expiresAt = new Date(member.expires_at);
        const now = new Date();
        const hoursLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60));
        
        const group = member.group;
        const amount = parseFloat(group?.subscription_price || 30.00).toFixed(2);
        
        console.log(`🚨 [GROUP-CONTROL] Enviando lembrete URGENTE para ${member.telegram_id} (expira em ${hoursLeft} horas)`);
        
        // Verificar se já existe transação pendente
        let existingTransaction = null;
        try {
          const { data: pendingRenewals, error: renewalError } = await db.supabase
            .from('transactions')
            .select('*')
            .eq('telegram_id', member.telegram_id)
            .eq('group_id', group.id)
            .in('status', ['pending', 'proof_sent'])
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!renewalError && pendingRenewals && pendingRenewals.length > 0) {
            existingTransaction = pendingRenewals[0];
          }
        } catch (err) {
          console.warn('⚠️ [GROUP-CONTROL] Erro ao verificar transação pendente:', err.message);
        }
        
        // Se já tem transação pendente, reutilizar
        if (existingTransaction) {
          console.log(`⏭️ [GROUP-CONTROL] Reutilizando transação existente ${existingTransaction.txid}`);
          
          let qrcodeBuffer = null;
          try {
            const QRCode = require('qrcode');
            qrcodeBuffer = await QRCode.toBuffer(existingTransaction.pix_payload);
          } catch (qrErr) {
            console.warn('⚠️ [GROUP-CONTROL] Não foi possível gerar QR Code');
          }
          
          const expirationTime = new Date(existingTransaction.created_at);
          expirationTime.setDate(expirationTime.getDate() + 7);
          const expirationStr = expirationTime.toLocaleDateString('pt-BR', { 
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
          
          if (qrcodeBuffer) {
            await bot.telegram.sendPhoto(
              member.telegram_id,
              { source: qrcodeBuffer },
              {
                caption: `🚨 *URGENTE: ASSINATURA EXPIRA HOJE!*

⚠️ *Sua assinatura expira em ${hoursLeft} horas!*

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')} às ${expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *RENOVE AGORA PARA NÃO PERDER O ACESSO!*

🔑 *Chave PIX:* ${existingTransaction.pix_key}

📋 *Cópia & Cola:*
\`${existingTransaction.pix_payload}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}

📸 Após pagar, envie o comprovante aqui.
Após aprovação, sua assinatura será renovada automaticamente!

⏰ *ÚLTIMA CHANCE!* 🚀

🆔 TXID: ${existingTransaction.txid}`,
                parse_mode: 'Markdown'
              }
            );
          } else {
            await bot.telegram.sendMessage(member.telegram_id, `🚨 *URGENTE: ASSINATURA EXPIRA HOJE!*

⚠️ *Sua assinatura expira em ${hoursLeft} horas!*

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')} às ${expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *RENOVE AGORA PARA NÃO PERDER O ACESSO!*

🔑 *Chave PIX:* ${existingTransaction.pix_key}

📋 *Cópia & Cola:*
\`${existingTransaction.pix_payload}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}

📸 Após pagar, envie o comprovante aqui.

⏰ *ÚLTIMA CHANCE!* 🚀

🆔 TXID: ${existingTransaction.txid}`, {
              parse_mode: 'Markdown'
            });
          }
        } else {
          // Criar nova transação urgente
          try {
            const charge = await manualPix.createManualCharge({
              amount,
              productId: `group_renewal_urgent_${group.id}`
            });
            
            const txid = charge.charge.txid;
            const expirationTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
            const expirationStr = expirationTime.toLocaleDateString('pt-BR', { 
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            
            await db.createTransaction({
              txid,
              userId: member.user_id,
              telegramId: member.telegram_id,
              productId: null,
              amount,
              pixKey: charge.charge.key,
              pixPayload: charge.charge.copiaCola,
              mediaPackId: null,
              groupId: group.id
            });
            
            if (charge.charge.qrcodeBuffer) {
              await bot.telegram.sendPhoto(
                member.telegram_id,
                { source: charge.charge.qrcodeBuffer },
                {
                  caption: `🚨 *URGENTE: ASSINATURA EXPIRA HOJE!*

⚠️ *Sua assinatura expira em ${hoursLeft} horas!*

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')} às ${expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *RENOVE AGORA PARA NÃO PERDER O ACESSO!*

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}

📸 Após pagar, envie o comprovante aqui.
Após aprovação, sua assinatura será renovada automaticamente!

⏰ *ÚLTIMA CHANCE!* 🚀

🆔 TXID: ${txid}`,
                  parse_mode: 'Markdown'
                }
              );
            } else {
              await bot.telegram.sendMessage(member.telegram_id, `🚨 *URGENTE: ASSINATURA EXPIRA HOJE!*

⚠️ *Sua assinatura expira em ${hoursLeft} horas!*

👥 *Grupo:* ${group?.group_name || 'Grupo'}
📅 *Expira em:* ${expiresAt.toLocaleDateString('pt-BR')} às ${expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💰 *Renovar por:* R$ ${amount}/mês

🔄 *RENOVE AGORA PARA NÃO PERDER O ACESSO!*

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}

📸 Após pagar, envie o comprovante aqui.

⏰ *ÚLTIMA CHANCE!* 🚀

🆔 TXID: ${txid}`, {
                parse_mode: 'Markdown'
              });
            }
            
            console.log(`✅ [GROUP-CONTROL] Lembrete urgente enviado para ${member.telegram_id}`);
          } catch (pixErr) {
            // Erros esperados que não devem ser logados como erro crítico
            const isExpectedError = (
              pixErr.message?.includes('bot was blocked') ||
              pixErr.message?.includes('bot was blocked by the user') ||
              pixErr.message?.includes('user is deactivated') ||
              pixErr.message?.includes('chat not found') ||
              pixErr.message?.includes('PEER_ID_INVALID') ||
              pixErr.message?.includes('USER_DEACTIVATED') ||
              pixErr.message?.includes('Forbidden') ||
              (pixErr.response && pixErr.response.error_code === 403)
            );

            if (isExpectedError) {
              console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível para lembrete urgente`, {
                telegram_id: member.telegram_id,
                reason: pixErr.message || pixErr.response?.description
              });
              // Não tenta fallback se usuário bloqueou
              throw pixErr; // Re-throw para ser tratado no catch externo
            }

            console.error(`❌ [GROUP-CONTROL] Erro ao gerar QR Code urgente:`, pixErr.message);
            
            // Fallback apenas se não for erro esperado
            try {
              await bot.telegram.sendMessage(member.telegram_id, `🚨 *URGENTE: ASSINATURA EXPIRA HOJE!*

⚠️ Sua assinatura expira em ${hoursLeft} horas!

👥 Grupo: ${group?.group_name || 'Grupo'}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}
💰 Renovar por: R$ ${amount}/mês

🔄 *Para renovar:*
Use o comando /renovar e faça o pagamento.

⏰ *ÚLTIMA CHANCE!* 🚀`, {
                parse_mode: 'Markdown'
              });
            } catch (fallbackErr) {
              // Se fallback também falhar, apenas logar
              console.warn(`⚠️ [GROUP-CONTROL] Fallback também falhou:`, fallbackErr.message);
              // Re-throw para ser tratado no catch externo
              throw pixErr;
            }
          }
        }
        
        // Marcar como lembrado hoje
        await db.markMemberReminded(member.id);
        stats.reminders_urgent++;
        
        console.log(`✅ [GROUP-CONTROL] Lembrete urgente enviado com sucesso`, {
          telegram_id: member.telegram_id,
          hours_left: hoursLeft
        });
        
      } catch (err) {
        // Erros esperados que não devem ser contados (usuário bloqueou bot, conta deletada, etc)
        const isExpectedError = (
          err.message?.includes('bot was blocked') ||
          err.message?.includes('user is deactivated') ||
          err.message?.includes('chat not found') ||
          err.message?.includes('PEER_ID_INVALID') ||
          err.message?.includes('USER_DEACTIVATED')
        );
        
        if (!isExpectedError) {
          stats.errors++;
          console.error(`❌ [GROUP-CONTROL] Erro ao enviar lembrete urgente`, {
            telegram_id: member.telegram_id,
            error: err.message,
            stack: err.stack
          });
        } else {
          console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível (bloqueou bot ou conta deletada)`, {
            telegram_id: member.telegram_id,
            reason: err.message
          });
        }
      }
    }
    
    // 3. Remover membros expirados há mais de 1 dia E enviar QR Code de renovação
    const expired = await db.getExpiredMembers();
    console.log(`❌ [GROUP-CONTROL] ${expired.length} membro(s) expirados há mais de 1 dia - iniciando remoção`, {
      timestamp: new Date().toISOString(),
      count: expired.length
    });
    
    for (const member of expired) {
      try {
        // 🆕 VERIFICAR PROCESSING LOCK (evitar duplicação)
        const lockAcquired = await acquireProcessingLock(member.id);
        
        if (!lockAcquired) {
          stats.skipped_locked++;
          console.log(`⏭️ [GROUP-CONTROL] Membro já sendo processado por outra instância`, {
            telegram_id: member.telegram_id,
            member_id: member.id
          });
          continue;
        }
        
        console.log(`🔄 [GROUP-CONTROL] Processando membro expirado`, {
          telegram_id: member.telegram_id,
          expires_at: member.expires_at,
          days_since_expiry: Math.floor((new Date() - new Date(member.expires_at)) / (1000 * 60 * 60 * 24))
        });
        
        // 🆕 VERIFICAR SE JÁ TEM TRANSAÇÃO PENDENTE/APROVADA DE RENOVAÇÃO
        let pendingRenewal = null;
        let retries = 3;
        
        while (retries > 0) {
          try {
            const { data: pendingRenewals, error: renewalError } = await db.supabase
              .from('transactions')
              .select('*')
              .eq('telegram_id', member.telegram_id)
              .eq('group_id', member.group_id)
              .in('status', ['pending', 'proof_sent', 'validated', 'delivered'])
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (renewalError) {
              const errorMessage = renewalError.message || '';
              const errorDetails = renewalError.details || '';
              const errorString = JSON.stringify(renewalError);
              
              const isConnectionError = (
                errorMessage.includes('fetch failed') ||
                errorMessage.includes('SocketError') ||
                errorMessage.includes('other side closed') ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('ETIMEDOUT') ||
                errorMessage.includes('UND_ERR_SOCKET') ||
                errorDetails.includes('UND_ERR_SOCKET') ||
                errorDetails.includes('other side closed') ||
                errorDetails.includes('SocketError') ||
                errorDetails.includes('ETIMEDOUT') ||
                errorString.includes('UND_ERR_SOCKET') ||
                errorString.includes('ETIMEDOUT')
              );
              
              if (isConnectionError && retries > 1) {
                retries--;
                console.warn(`⚠️ [GROUP-CONTROL] Erro de conexão ao buscar transação de renovação: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
                console.warn(`⚠️ [GROUP-CONTROL] Tentando novamente... (${retries} tentativas restantes)`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
                continue;
              } else {
                // Se não for erro de conexão ou última tentativa, tratar como sem renovação pendente
                console.warn(`⚠️ [GROUP-CONTROL] Erro ao buscar transação de renovação: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
                break;
              }
            }
            
            pendingRenewal = pendingRenewals && pendingRenewals.length > 0 ? pendingRenewals[0] : null;
            break; // Sucesso, sair do loop
            
          } catch (err) {
            const errorMessage = err.message || '';
            const errorDetails = err.details || '';
            const errorString = JSON.stringify(err);
            
            const isConnectionError = (
              errorMessage.includes('fetch failed') ||
              errorMessage.includes('SocketError') ||
              errorMessage.includes('other side closed') ||
              errorMessage.includes('ECONNRESET') ||
              errorMessage.includes('ETIMEDOUT') ||
              errorMessage.includes('UND_ERR_SOCKET') ||
              errorDetails.includes('UND_ERR_SOCKET') ||
              errorDetails.includes('other side closed') ||
              errorDetails.includes('SocketError') ||
              errorDetails.includes('ETIMEDOUT') ||
              errorString.includes('UND_ERR_SOCKET') ||
              errorString.includes('ETIMEDOUT')
            );
            
            if (isConnectionError && retries > 1) {
              retries--;
              console.warn(`⚠️ [GROUP-CONTROL] Erro de conexão ao buscar transação de renovação: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
              console.warn(`⚠️ [GROUP-CONTROL] Tentando novamente... (${retries} tentativas restantes)`);
              await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
              continue;
            } else {
              console.warn(`⚠️ [GROUP-CONTROL] Erro ao buscar transação de renovação: ${errorMessage || errorDetails || 'Erro desconhecido'}`);
              break;
            }
          }
        }
        
        // Se tem transação aprovada/entregue, NÃO REMOVER (já foi renovado)
        if (pendingRenewal && (pendingRenewal.status === 'validated' || pendingRenewal.status === 'delivered')) {
          console.log(`⏸️ [GROUP-CONTROL] Membro ${member.telegram_id} já tem renovação aprovada, pulando remoção`);
          
          // Verificar se precisa adicionar ao grupo novamente
          try {
            await bot.telegram.unbanChatMember(
              member.group.group_id,
              member.telegram_id,
              { only_if_banned: true }
            );
            console.log(`✅ [GROUP-CONTROL] Membro ${member.telegram_id} já tem renovação, garantindo acesso ao grupo`);
          } catch (unbanErr) {
            // Ignorar erro se já não está banido
          }
          
          continue; // Pular para próximo membro
        }
        
        // Se tem transação pendente, apenas avisar e não remover ainda
        if (pendingRenewal && (pendingRenewal.status === 'pending' || pendingRenewal.status === 'proof_sent')) {
          console.log(`⏳ [GROUP-CONTROL] Membro ${member.telegram_id} tem pagamento pendente, aguardando aprovação`);
          
          // Ainda não removido, apenas avisar
          try {
            await bot.telegram.sendMessage(member.telegram_id, `⏰ *ASSINATURA EXPIRANDO HOJE!*

⚠️ Sua assinatura expira hoje!

👥 *Grupo:* ${member.group?.group_name || 'Grupo'}

📸 Seu comprovante está em análise.
Após aprovação, sua assinatura será renovada automaticamente.

🔄 Enquanto isso, não perca o acesso!`, {
              parse_mode: 'Markdown'
            });
          } catch (msgErr) {
            console.error('Erro ao enviar aviso:', msgErr.message);
          }
          
          continue; // Pular remoção por enquanto
        }
        
        // 🆕 NÃO TEM PAGAMENTO PENDENTE - VERIFICAR UMA ÚLTIMA VEZ ANTES DE REMOVER
        // Esta verificação final evita race conditions onde uma aprovação pode ter acontecido
        // entre a verificação inicial e a remoção
        let finalPendingCheck = null;
        try {
          const { data: lastPendingCheck, error: finalCheckErr } = await db.supabase
            .from('transactions')
            .select('*')
            .eq('telegram_id', member.telegram_id)
            .eq('group_id', member.group_id)
            .in('status', ['pending', 'proof_sent', 'validated', 'delivered'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!finalCheckErr) {
            finalPendingCheck = lastPendingCheck;
          }
        } catch (finalCheckErr) {
          console.warn('⚠️ [GROUP-CONTROL] Erro na verificação final antes de remover:', finalCheckErr.message);
        }
        
        // Se encontrou transação aprovada/entregue na verificação final, não remover
        if (finalPendingCheck && (finalPendingCheck.status === 'validated' || finalPendingCheck.status === 'delivered')) {
          console.log(`✅ [GROUP-CONTROL] Verificação final: Membro ${member.telegram_id} tem renovação aprovada - NÃO REMOVER`);
          
          // Garantir acesso ao grupo
          try {
            await bot.telegram.unbanChatMember(
              member.group.group_id,
              member.telegram_id,
              { only_if_banned: true }
            );
          } catch (unbanErr) {
            // Ignorar erro
          }
          
          continue; // Pular remoção
        }
        
        // Se encontrou transação pendente na verificação final, não remover ainda
        if (finalPendingCheck && (finalPendingCheck.status === 'pending' || finalPendingCheck.status === 'proof_sent')) {
          console.log(`⏳ [GROUP-CONTROL] Verificação final: Membro ${member.telegram_id} tem pagamento pendente - AGUARDAR APROVAÇÃO`);
          
          // Avisar usuário
          try {
            await bot.telegram.sendMessage(member.telegram_id, `⏰ *ASSINATURA EXPIRANDO HOJE!*

⚠️ Sua assinatura expira hoje!

👥 *Grupo:* ${member.group?.group_name || 'Grupo'}

📸 Seu comprovante está em análise.
Após aprovação, sua assinatura será renovada automaticamente.

🔄 Enquanto isso, não perca o acesso!`, {
              parse_mode: 'Markdown'
            });
          } catch (msgErr) {
            console.error('Erro ao enviar aviso:', msgErr.message);
          }
          
          continue; // Pular remoção por enquanto
        }
        
        // 🆕 CONFIRMADO: NÃO TEM PAGAMENTO PENDENTE - REMOVER DO GRUPO
        console.log(`❌ [GROUP-CONTROL] Verificação final confirmada: Membro ${member.telegram_id} não tem pagamento pendente, removendo do grupo`);
        
        // 🆕 VERIFICAR PERMISSÕES DO BOT ANTES DE REMOVER
        let hasPermission = true;
        try {
          const chatMember = await bot.telegram.getChatMember(
            member.group.group_id,
            bot.botInfo.id || (await bot.telegram.getMe()).id
          );
          
          // Verificar se bot é admin e tem permissão de banir
          hasPermission = chatMember.status === 'administrator' && 
                         (chatMember.can_restrict_members || chatMember.can_ban_members);
          
          if (!hasPermission) {
            console.warn(`⚠️ [GROUP-CONTROL] Bot não tem permissão para remover membros do grupo ${member.group.group_id}`);
            console.warn(`⚠️ [GROUP-CONTROL] Status: ${chatMember.status}, can_restrict: ${chatMember.can_restrict_members}, can_ban: ${chatMember.can_ban_members}`);
          }
        } catch (permErr) {
          console.warn(`⚠️ [GROUP-CONTROL] Erro ao verificar permissões do bot:`, permErr.message);
          // Continuar tentando remover mesmo se não conseguir verificar permissões
        }
        
        // Remover do grupo (ban + unban = remove sem bloquear)
        try {
          if (hasPermission) {
            await bot.telegram.banChatMember(
              member.group.group_id,
              member.telegram_id
            );
            
            // Desbanir imediatamente (só remove, não bloqueia)
            await bot.telegram.unbanChatMember(
              member.group.group_id,
              member.telegram_id,
              { only_if_banned: true }
            );
            
            console.log(`✅ [GROUP-CONTROL] Membro ${member.telegram_id} removido do grupo ${member.group.group_id}`);
          } else {
            console.warn(`⚠️ [GROUP-CONTROL] Pulando remoção de ${member.telegram_id} - bot sem permissão`);
            // Ainda assim, marcar como expirado no banco
          }
        } catch (removeErr) {
          const errorMessage = removeErr.message || '';
          
          // Verificar se é erro de permissão
          if (errorMessage.includes('not enough rights') || 
              errorMessage.includes('can\'t restrict') ||
              errorMessage.includes('CHAT_ADMIN_REQUIRED')) {
            console.error(`❌ [GROUP-CONTROL] Bot não tem permissão para remover membros do grupo ${member.group.group_id}`);
            console.error(`❌ [GROUP-CONTROL] Erro: ${errorMessage}`);
            // Continuar e marcar como expirado no banco mesmo sem remover do grupo
          } else {
            console.error(`⚠️ [GROUP-CONTROL] Erro ao remover do grupo:`, removeErr.message);
          }
        }
        
        // Atualizar status
        await db.expireMember(member.id);
        
        // 🆕 LIBERAR LOCK
        await releaseProcessingLock(member.id);
        
        stats.removed++;
        console.log(`✅ [GROUP-CONTROL] Membro expirado removido com sucesso`, {
          telegram_id: member.telegram_id,
          group_id: member.group.group_id,
          group_name: member.group.group_name
        });
        
        // 🆕 GERAR QR CODE DE RENOVAÇÃO AUTOMÁTICO (apenas se não houver transação pendente)
        try {
          const group = member.group;
          const amount = parseFloat(group.subscription_price).toFixed(2);
          
          // 🆕 VERIFICAR NOVAMENTE SE NÃO FOI CRIADA TRANSAÇÃO ENTRE A VERIFICAÇÃO E AGORA
          let finalCheck = null;
          try {
            const { data: lastCheck, error: checkErr } = await db.supabase
              .from('transactions')
              .select('*')
              .eq('telegram_id', member.telegram_id)
              .eq('group_id', member.group_id)
              .in('status', ['pending', 'proof_sent'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (!checkErr) {
              finalCheck = lastCheck;
            }
          } catch (checkErr) {
            console.warn('⚠️ [GROUP-CONTROL] Erro na verificação final:', checkErr.message);
          }
          
          // Se encontrou transação pendente na verificação final, usar ela
          if (finalCheck) {
            console.log(`⏭️ [GROUP-CONTROL] Transação pendente encontrada na verificação final: ${finalCheck.txid} - reutilizando`);
            
            // Gerar QR Code da transação existente
            let qrcodeBuffer = null;
            try {
              const QRCode = require('qrcode');
              qrcodeBuffer = await QRCode.toBuffer(finalCheck.pix_payload);
            } catch (qrErr) {
              console.warn('⚠️ [GROUP-CONTROL] Não foi possível gerar QR Code da transação existente');
            }
            
            const expirationTime = new Date(finalCheck.created_at);
            expirationTime.setMinutes(expirationTime.getMinutes() + 30); // 30 minutos
            const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            
            // Enviar QR Code de renovação
            if (qrcodeBuffer) {
              await bot.telegram.sendPhoto(
                member.telegram_id,
                { source: qrcodeBuffer },
                {
                  caption: `🔄 *RENOVAÇÃO DE ASSINATURA*

❌ Sua assinatura expirou e você foi removido do grupo.

👥 *Grupo:* ${group.group_name}
💰 *Valor:* R$ ${amount}
📅 *Duração:* ${group.subscription_days} dias

🔑 *Chave PIX:* ${finalCheck.pix_key}

📋 *Cópia & Cola:*
\`${finalCheck.pix_payload}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento

📸 Após pagar, envie o comprovante aqui.
Após aprovação, você será adicionado automaticamente ao grupo!

🆔 TXID: ${finalCheck.txid}`,
                  parse_mode: 'Markdown'
                }
              );
            } else {
              await bot.telegram.sendMessage(member.telegram_id, `🔄 *RENOVAÇÃO DE ASSINATURA*

❌ Sua assinatura expirou e você foi removido do grupo.

👥 *Grupo:* ${group.group_name}
💰 *Valor:* R$ ${amount}
📅 *Duração:* ${group.subscription_days} dias

🔑 *Chave PIX:* ${finalCheck.pix_key}

📋 *Cópia & Cola:*
\`${finalCheck.pix_payload}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento

📸 *Após pagar, envie o comprovante aqui.*
✅ *Após a aprovação, você receberá o link do grupo automaticamente!*

🆔 TXID: ${finalCheck.txid}`, {
                parse_mode: 'Markdown'
              });
            }
            
            console.log(`✅ [GROUP-CONTROL] QR Code de renovação enviado reutilizando transação existente ${finalCheck.txid}`);
          } else {
            // Não há transação pendente - criar nova
            console.log(`💰 [GROUP-CONTROL] Gerando nova transação de renovação: R$ ${amount}`);
            
            // Gerar cobrança PIX
            const charge = await manualPix.createManualCharge({
              amount,
              productId: `group_renewal_${group.id}`
            });
            
            const txid = charge.charge.txid;
            const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
            const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            
            // Salvar transação de renovação
            await db.createTransaction({
              txid,
              userId: member.user_id,
              telegramId: member.telegram_id,
              productId: null, // Renovação não tem produto
              amount,
              pixKey: charge.charge.key,
              pixPayload: charge.charge.copiaCola,
              mediaPackId: null,
              groupId: group.id // 🆕 Marcar como renovação de grupo
            });
            
            // Enviar QR Code (SEM link do grupo)
            if (charge.charge.qrcodeBuffer) {
              await bot.telegram.sendPhoto(
                member.telegram_id,
                { source: charge.charge.qrcodeBuffer },
                {
                  caption: `🔄 *RENOVAÇÃO DE ASSINATURA*

❌ Sua assinatura expirou e você foi removido do grupo.

👥 *Grupo:* ${group.group_name}
💰 *Valor:* R$ ${amount}
📅 *Duração:* ${group.subscription_days} dias

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento

📸 *Após pagar, envie o comprovante aqui.*
✅ *Após a aprovação, você receberá o link do grupo automaticamente!*

🆔 TXID: ${txid}`,
                  parse_mode: 'Markdown'
                }
              );
            } else {
              // Fallback: enviar sem QR Code (SEM link do grupo)
              await bot.telegram.sendMessage(member.telegram_id, `🔄 *RENOVAÇÃO DE ASSINATURA*

❌ Sua assinatura expirou e você foi removido do grupo.

👥 *Grupo:* ${group.group_name}
💰 *Valor:* R$ ${amount}
📅 *Duração:* ${group.subscription_days} dias

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento

📸 *Após pagar, envie o comprovante aqui.*
✅ *Após a aprovação, você receberá o link do grupo automaticamente!*

🆔 TXID: ${txid}`, {
                parse_mode: 'Markdown'
              });
            }
            
            console.log(`✅ [GROUP-CONTROL] QR Code de renovação enviado para ${member.telegram_id}`);
          }
          
          console.log(`✅ [GROUP-CONTROL] QR Code de renovação enviado para ${member.telegram_id}`);
          
        } catch (pixErr) {
          // Verificar se é erro esperado (bot bloqueado, usuário deletado, etc)
          const isExpectedError = (
            pixErr.message?.includes('bot was blocked') ||
            pixErr.message?.includes('bot was blocked by the user') ||
            pixErr.message?.includes('user is deactivated') ||
            pixErr.message?.includes('chat not found') ||
            pixErr.message?.includes('PEER_ID_INVALID') ||
            pixErr.message?.includes('USER_DEACTIVATED') ||
            pixErr.message?.includes('Forbidden') ||
            (pixErr.response && pixErr.response.error_code === 403)
          );

          if (isExpectedError) {
            console.log(`ℹ️ [GROUP-CONTROL] Usuário não acessível (bloqueou bot ou conta deletada)`, {
              telegram_id: member.telegram_id,
              reason: pixErr.message || pixErr.response?.description
            });
            throw pixErr; // Re-throw para ser tratado no catch externo
          }

          console.error(`❌ [GROUP-CONTROL] Erro ao gerar QR Code de renovação:`, pixErr.message);
          
          // Enviar mensagem sem QR Code (apenas se não for erro esperado)
          try {
            await bot.telegram.sendMessage(member.telegram_id, `❌ *ASSINATURA EXPIRADA*

Sua assinatura do grupo expirou e você foi removido.

🔄 *Para renovar:*
Use o comando /renovar e faça o pagamento.`, {
              parse_mode: 'Markdown'
            });
          } catch (fallbackErr) {
            // Se fallback também falhar, apenas logar e re-throw
            console.warn(`⚠️ [GROUP-CONTROL] Fallback também falhou:`, fallbackErr.message);
            throw pixErr; // Re-throw o erro original
          }
        }
        
      } catch (err) {
        stats.errors++;
        
        // 🆕 LIBERAR LOCK EM CASO DE ERRO
        try {
          await releaseProcessingLock(member.id);
        } catch (unlockErr) {
          console.error(`❌ [GROUP-CONTROL] Erro ao liberar lock`, {
            member_id: member.id,
            error: unlockErr.message
          });
        }
        
        console.error(`❌ [GROUP-CONTROL] Erro ao processar membro expirado`, {
          telegram_id: member.telegram_id,
          error: err.message,
          stack: err.stack
        });
      }
    }
    
    // ===== ESTATÍSTICAS FINAIS =====
    const duration = Date.now() - startTime;
    console.log(`✅ [GROUP-CONTROL] Verificação concluída`, {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      stats: {
        reminders_3_days: stats.reminders_3_days,
        reminders_urgent: stats.reminders_urgent,
        removed: stats.removed,
        errors: stats.errors,
        skipped_locked: stats.skipped_locked
      },
      counts: {
        expiring_3_days: expiring.length,
        expiring_today: expiringToday.length,
        expired_processed: expired.length
      }
    });
    
    return stats;
    
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('❌ [GROUP-CONTROL] Erro crítico', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

// ===== FUNÇÕES AUXILIARES PARA LOCK DISTRIBUÍDO =====

/**
 * Adquire lock de processamento para um membro
 * Retorna true se conseguiu adquirir, false se já está locked
 */
async function acquireProcessingLock(memberId) {
  try {
    const lockTimeout = new Date(Date.now() + 5 * 60 * 1000); // Lock expira em 5 minutos
    const now = new Date().toISOString();
    
    // Primeiro, verificar se pode adquirir o lock (está null ou expirado)
    const { data: checkData, error: checkError } = await db.supabase
      .from('group_members')
      .select('id, processing_lock')
      .eq('id', memberId)
      .single();
    
    if (checkError) {
      // Se coluna não existe ou erro de query, tentar sem lock (continuar processamento)
      if (checkError.message?.includes('does not exist')) {
        console.warn(`⚠️ [LOCK] Coluna processing_lock não existe, continuando sem lock`);
        return true; // Permite processar sem lock
      }
      console.error(`❌ [LOCK] Erro ao verificar lock:`, checkError.message);
      return false;
    }
    
    // Se já tem lock ativo e não expirou, não pode adquirir
    if (checkData?.processing_lock && new Date(checkData.processing_lock) > new Date()) {
      return false; // Já está locked
    }
    
    // Tentar adquirir o lock
    const { data, error } = await db.supabase
      .from('group_members')
      .update({ 
        processing_lock: lockTimeout.toISOString(),
        updated_at: now
      })
      .eq('id', memberId)
      .is('processing_lock', null)
      .select('id');
    
    // Se não conseguiu (já foi adquirido por outro processo), tentar atualizar se expirou
    if (error || !data || data.length === 0) {
      // Verificar se lock expirou e tentar novamente
      const { data: retryData, error: retryError } = await db.supabase
        .from('group_members')
        .update({ 
          processing_lock: lockTimeout.toISOString(),
          updated_at: now
        })
        .eq('id', memberId)
        .lt('processing_lock', now) // Lock expirado
        .select('id');
      
      if (retryError) {
        console.error(`❌ [LOCK] Erro ao adquirir lock:`, retryError.message);
        return false;
      }
      
      return retryData && retryData.length > 0;
    }
    
    // Conseguiu adquirir o lock
    return true;
    
  } catch (err) {
    // Se erro é "coluna não existe", permitir processar sem lock
    if (err.message?.includes('does not exist')) {
      console.warn(`⚠️ [LOCK] Coluna processing_lock não existe, continuando sem lock`);
      return true;
    }
    console.error(`❌ [LOCK] Erro crítico ao adquirir lock:`, err.message);
    return false;
  }
}

/**
 * Libera lock de processamento para um membro
 */
async function releaseProcessingLock(memberId) {
  try {
    const { error } = await db.supabase
      .from('group_members')
      .update({ 
        processing_lock: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId);
    
    if (error) {
      console.error(`❌ [LOCK] Erro ao liberar lock:`, error.message);
    }
    
  } catch (err) {
    console.error(`❌ [LOCK] Erro crítico ao liberar lock:`, err.message);
  }
}

// Executar a cada 30 minutos (para garantir verificação precisa no dia do vencimento)
function startGroupControl(bot) {
  console.log('🚀 [GROUP-CONTROL] Sistema de controle de grupos iniciado - verificação a cada 30 minutos');
  
  // Executar imediatamente
  checkExpirations(bot);
  
  // Repetir a cada 30 minutos (mais frequente para garantir verificação no dia do vencimento)
  setInterval(() => {
    checkExpirations(bot);
  }, 30 * 60 * 1000); // 30 minutos
}

module.exports = { 
  startGroupControl,
  checkExpirations 
};
