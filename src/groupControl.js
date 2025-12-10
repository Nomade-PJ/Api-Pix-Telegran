// src/groupControl.js
const db = require('./database');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');

async function checkExpirations(bot) {
  try {
    console.log('🔍 [GROUP-CONTROL] Verificando expirações de assinaturas...');
    
    // 1. Enviar lembretes COM QR CODE (3 dias antes)
    const expiring = await db.getExpiringMembers();
    
    for (const member of expiring) {
      try {
        const expiresAt = new Date(member.expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        
        const group = member.group;
        const amount = parseFloat(group?.subscription_price || 30.00).toFixed(2);
        
        console.log(`⏰ [GROUP-CONTROL] Enviando lembrete de 3 dias para ${member.telegram_id}`);
        
        // 🆕 GERAR QR CODE NO LEMBRETE DE 3 DIAS
        try {
          // Gerar cobrança PIX
          const charge = await manualPix.createManualCharge({
            amount,
            productId: `group_renewal_reminder_${group.id}`
          });
          
          const txid = charge.charge.txid;
          const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
          const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
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
⚠️ *Prazo:* 30 minutos para pagamento

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
⚠️ *Prazo:* 30 minutos para pagamento

📸 Após pagar, envie o comprovante aqui.

🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          }
          
          console.log(`✅ [GROUP-CONTROL] Lembrete com QR Code enviado para ${member.telegram_id}`);
        } catch (pixErr) {
          console.error(`❌ [GROUP-CONTROL] Erro ao gerar QR Code no lembrete:`, pixErr.message);
          
          // Fallback: enviar só mensagem
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
        }
        
        // Marcar como lembrado
        await db.markMemberReminded(member.id);
        
      } catch (err) {
        console.error(`❌ [GROUP-CONTROL] Erro ao enviar lembrete para ${member.telegram_id}:`, err.message);
      }
    }
    
    // 2. Remover membros expirados E enviar QR Code de renovação
    const expired = await db.getExpiredMembers();
    
    for (const member of expired) {
      try {
        console.log(`🔄 [GROUP-CONTROL] Processando membro expirado: ${member.telegram_id}`);
        
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
        
        // 🆕 NÃO TEM PAGAMENTO PENDENTE - REMOVER DO GRUPO
        console.log(`❌ [GROUP-CONTROL] Membro ${member.telegram_id} não tem pagamento pendente, removendo do grupo`);
        
        // Remover do grupo (ban + unban = remove sem bloquear)
        try {
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
        } catch (removeErr) {
          console.error(`⚠️ [GROUP-CONTROL] Erro ao remover do grupo (pode não ter permissão):`, removeErr.message);
        }
        
        // Atualizar status
        await db.expireMember(member.id);
        
        // 🆕 GERAR QR CODE DE RENOVAÇÃO AUTOMÁTICO
        try {
          const group = member.group;
          const amount = parseFloat(group.subscription_price).toFixed(2);
          
          console.log(`💰 [GROUP-CONTROL] Gerando QR Code de renovação: R$ ${amount}`);
          
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
          
          // Enviar QR Code
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

📸 Após pagar, envie o comprovante aqui.
Após aprovação, você será adicionado automaticamente ao grupo!

🆔 TXID: ${txid}`,
                parse_mode: 'Markdown'
              }
            );
          } else {
            // Fallback: enviar sem QR Code
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

📸 Após pagar, envie o comprovante aqui.
Após aprovação, você será adicionado automaticamente ao grupo!

🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          }
          
          console.log(`✅ [GROUP-CONTROL] QR Code de renovação enviado para ${member.telegram_id}`);
          
        } catch (pixErr) {
          console.error(`❌ [GROUP-CONTROL] Erro ao gerar QR Code de renovação:`, pixErr.message);
          
          // Enviar mensagem sem QR Code
          await bot.telegram.sendMessage(member.telegram_id, `❌ *ASSINATURA EXPIRADA*

Sua assinatura do grupo expirou e você foi removido.

🔄 *Para renovar:*
Use o comando /renovar e faça o pagamento.`, {
            parse_mode: 'Markdown'
          });
        }
        
      } catch (err) {
        console.error(`❌ [GROUP-CONTROL] Erro ao processar membro expirado ${member.telegram_id}:`, err.message);
      }
    }
    
    console.log(`✅ [GROUP-CONTROL] Verificação concluída: ${expiring.length} lembretes, ${expired.length} removidos`);
    
  } catch (err) {
    console.error('❌ [GROUP-CONTROL] Erro crítico:', err);
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

module.exports = { startGroupControl };

