// src/groupControl.js
const db = require('./database');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');

async function checkExpirations(bot) {
  try {
    console.log('🔍 [GROUP-CONTROL] Verificando expirações de assinaturas...');
    
    // 1. Enviar lembretes (3 dias antes)
    const expiring = await db.getExpiringMembers();
    
    for (const member of expiring) {
      try {
        const expiresAt = new Date(member.expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        
        await bot.telegram.sendMessage(member.telegram_id, `⏰ *LEMBRETE DE ASSINATURA*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 Grupo: ${member.group?.group_name || 'Grupo'}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}
💰 Renovar por: R$ ${member.group?.subscription_price || '30.00'}/mês

🔄 *Para renovar:*
Use o comando /renovar e faça o pagamento.

Não perca o acesso! 🚀`, {
          parse_mode: 'Markdown'
        });
        
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

// Executar a cada 1 hora
function startGroupControl(bot) {
  // Executar imediatamente
  checkExpirations(bot);
  
  // Repetir a cada hora
  setInterval(() => {
    checkExpirations(bot);
  }, 60 * 60 * 1000); // 1 hora
}

module.exports = { startGroupControl };

