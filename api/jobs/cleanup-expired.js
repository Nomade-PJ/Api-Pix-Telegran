// api/jobs/cleanup-expired.js
// Script de limpeza única para processar usuários expirados acumulados
// USAR APENAS UMA VEZ para limpar o backlog

const { createBot } = require('../../src/bot');
const groupControl = require('../../src/groupControl');
const db = require('../../src/database');

/**
 * Handler de limpeza de usuários expirados acumulados
 * Este endpoint deve ser chamado APENAS UMA VEZ para processar o backlog
 * 
 * Segurança: Requer header x-admin-secret
 */
module.exports = async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // ===== SEGURANÇA: Validar secret de admin =====
    const secret = req.headers['x-admin-secret'];
    
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      console.error('❌ [CLEANUP] Tentativa de acesso não autorizada', {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      });
      
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing x-admin-secret header'
      });
    }
    
    console.log('🧹 [CLEANUP] Iniciando limpeza de usuários expirados acumulados', {
      timestamp: new Date().toISOString()
    });
    
    // ===== BUSCAR TODOS OS MEMBROS EXPIRADOS =====
    const { data: expiredMembers, error: fetchError } = await db.supabase
      .from('group_members')
      .select(`
        *,
        group:group_id(group_id, group_name, subscription_price, subscription_days)
      `)
      .eq('status', 'active')
      .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`📊 [CLEANUP] Encontrados ${expiredMembers?.length || 0} membros expirados`, {
      count: expiredMembers?.length || 0
    });
    
    if (!expiredMembers || expiredMembers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nenhum membro expirado encontrado',
        processed: 0
      });
    }
    
    // ===== PROCESSAR CADA MEMBRO =====
    const bot = createBot(process.env.TELEGRAM_BOT_TOKEN);
    const results = {
      total: expiredMembers.length,
      removed: 0,
      kept_pending_payment: 0,
      kept_already_renewed: 0,
      errors: 0,
      details: []
    };
    
    for (const member of expiredMembers) {
      const memberResult = {
        telegram_id: member.telegram_id,
        expires_at: member.expires_at,
        days_expired: Math.floor((Date.now() - new Date(member.expires_at)) / (1000 * 60 * 60 * 24)),
        action: null,
        error: null
      };
      
      try {
        console.log(`🔄 [CLEANUP] Processando ${member.telegram_id}`, {
          expires_at: member.expires_at,
          days_expired: memberResult.days_expired
        });
        
        // Verificar se há transação pendente/aprovada
        const { data: pendingTransactions } = await db.supabase
          .from('transactions')
          .select('*')
          .eq('telegram_id', member.telegram_id)
          .eq('group_id', member.group_id)
          .in('status', ['pending', 'proof_sent', 'validated', 'delivered'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        const hasPendingTransaction = pendingTransactions && pendingTransactions.length > 0;
        
        if (hasPendingTransaction) {
          const transaction = pendingTransactions[0];
          
          if (transaction.status === 'validated' || transaction.status === 'delivered') {
            // Já foi renovado - não remover
            console.log(`✅ [CLEANUP] ${member.telegram_id} - Renovação já aprovada, mantendo`);
            results.kept_already_renewed++;
            memberResult.action = 'kept_renewed';
            memberResult.transaction_status = transaction.status;
          } else {
            // Pagamento pendente - não remover ainda
            console.log(`⏳ [CLEANUP] ${member.telegram_id} - Pagamento pendente, mantendo temporariamente`);
            results.kept_pending_payment++;
            memberResult.action = 'kept_pending';
            memberResult.transaction_status = transaction.status;
          }
        } else {
          // Sem pagamento pendente - REMOVER
          console.log(`❌ [CLEANUP] ${member.telegram_id} - Removendo (${memberResult.days_expired} dias expirado)`);
          
          try {
            // Remover do grupo Telegram
            await bot.telegram.banChatMember(member.group.group_id, member.telegram_id);
            await bot.telegram.unbanChatMember(member.group.group_id, member.telegram_id, { only_if_banned: true });
            
            console.log(`✅ [CLEANUP] ${member.telegram_id} - Removido do Telegram`);
          } catch (removeErr) {
            console.warn(`⚠️ [CLEANUP] ${member.telegram_id} - Erro ao remover do Telegram: ${removeErr.message}`);
            // Continuar mesmo com erro (pode não ter permissão)
          }
          
          // Marcar como expirado no banco
          await db.expireMember(member.id);
          
          // Enviar QR Code de renovação
          try {
            const manualPix = require('../../src/pix/manual');
            const amount = parseFloat(member.group.subscription_price).toFixed(2);
            
            const charge = await manualPix.createManualCharge({
              amount,
              productId: `group_renewal_${member.group_id}`
            });
            
            const txid = charge.charge.txid;
            const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
            const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            
            // Salvar transação
            await db.createTransaction({
              txid,
              userId: member.user_id,
              telegramId: member.telegram_id,
              productId: null,
              amount,
              pixKey: charge.charge.key,
              pixPayload: charge.charge.copiaCola,
              mediaPackId: null,
              groupId: member.group_id
            });
            
            // Enviar mensagem com QR Code (SEM link do grupo)
            if (charge.charge.qrcodeBuffer) {
              await bot.telegram.sendPhoto(
                member.telegram_id,
                { source: charge.charge.qrcodeBuffer },
                {
                  caption: `🔄 *RENOVAÇÃO DE ASSINATURA*

❌ Sua assinatura expirou há ${memberResult.days_expired} dias e você foi removido do grupo.

👥 *Grupo:* ${member.group.group_name}
💰 *Valor:* R$ ${amount}
📅 *Duração:* 30 dias

🔑 *Chave PIX:* ${charge.charge.key}

📋 *Cópia & Cola:*
\`${charge.charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}

📸 *Após pagar, envie o comprovante aqui.*
✅ *Após a aprovação, você receberá o link do grupo automaticamente!*

🆔 TXID: ${txid}`,
                  parse_mode: 'Markdown'
                }
              );
            }
            
            console.log(`✅ [CLEANUP] ${member.telegram_id} - QR Code de renovação enviado`);
          } catch (qrErr) {
            console.warn(`⚠️ [CLEANUP] ${member.telegram_id} - Erro ao enviar QR Code: ${qrErr.message}`);
          }
          
          results.removed++;
          memberResult.action = 'removed';
        }
        
      } catch (err) {
        console.error(`❌ [CLEANUP] Erro ao processar ${member.telegram_id}:`, err.message);
        results.errors++;
        memberResult.action = 'error';
        memberResult.error = err.message;
      }
      
      results.details.push(memberResult);
    }
    
    const duration = Date.now() - startTime;
    
    console.log('✅ [CLEANUP] Limpeza concluída', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        total: results.total,
        removed: results.removed,
        kept_pending: results.kept_pending_payment,
        kept_renewed: results.kept_already_renewed,
        errors: results.errors
      }
    });
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      summary: {
        total_analyzed: results.total,
        removed_from_group: results.removed,
        kept_pending_payment: results.kept_pending_payment,
        kept_already_renewed: results.kept_already_renewed,
        errors: results.errors
      },
      details: results.details,
      message: `Processados ${results.total} membros. ${results.removed} removidos, ${results.kept_pending_payment} com pagamento pendente, ${results.kept_already_renewed} já renovados.`
    });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CLEANUP] Erro crítico:', {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
