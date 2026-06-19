// api/jobs/process-proofs.js
// Endpoint de cron job para análise OCR de comprovantes de pagamento pendentes
// Este endpoint deve ser chamado por um serviço externo de cron (ex: cron-job.org)

const { createBot } = require('../../src/bot');
const db = require('../../src/database');
const deliver = require('../../src/deliver');
const proofAnalyzer = require('../../src/proofAnalyzer');

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // ===== SEGURANÇA: Validar secret =====
    const secret = req.headers['x-cron-secret'];
    
    if (!secret || secret !== process.env.CRON_SECRET) {
      console.error('❌ [CRON-PROOFS] Tentativa de acesso não autorizada', {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        hasSecret: !!secret
      });
      
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing x-cron-secret header'
      });
    }
    
    console.log('🔄 [CRON-PROOFS] Job de processamento de comprovantes iniciado', {
      timestamp: new Date().toISOString(),
      source: 'cron-endpoint'
    });
    
    // ===== BUSCAR TRANSAÇÕES COM COMPROVANTE PENDENTE DE ANÁLISE =====
    // Transações no status 'proof_sent' com proof_file_id preenchido e ocr_analyzed_at nulo
    const { data: transactions, error: fetchError } = await db.supabase
      .from('transactions')
      .select('*')
      .eq('status', 'proof_sent')
      .is('ocr_analyzed_at', null)
      .not('proof_file_id', 'is', null);
      
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`📊 [CRON-PROOFS] Encontradas ${transactions?.length || 0} transações pendentes de OCR`);
    
    if (!transactions || transactions.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nenhum comprovante pendente de análise',
        processed: 0
      });
    }
    
    // Inicializar bot
    const bot = createBot(process.env.TELEGRAM_BOT_TOKEN);
    const telegram = bot.telegram;
    
    const results = {
      total: transactions.length,
      approved: 0,
      rejected: 0,
      manual_review: 0,
      errors: 0,
      details: []
    };
    
    // ===== PROCESSAR CADA COMPROVANTE =====
    for (const transaction of transactions) {
      const txid = transaction.txid;
      const chatId = transaction.telegram_id;
      const txResult = {
        txid,
        telegram_id: chatId,
        status: null,
        error: null
      };
      
      try {
        console.log(`🔄 [CRON-PROOFS] Processando TXID ${txid} para usuário ${chatId}...`);
        
        // 1. Obter detalhes do usuário (first_name, username) para a notificação
        const fromUser = await db.getUserByTelegramId(chatId) || {
          first_name: 'Usuário',
          username: 'N/A',
          id: chatId
        };
        
        // 2. Obter arquivo do Telegram
        console.log(`📥 [CRON-PROOFS] Obtendo arquivo Telegram para file_id ${transaction.proof_file_id.substring(0, 20)}...`);
        const file = await telegram.getFile(transaction.proof_file_id);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const fileType = file.file_path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
        
        console.log(`📎 [CRON-PROOFS] FileUrl: ${fileUrl.substring(0, 80)}... (Tipo: ${fileType.toUpperCase()})`);
        
        // 3. Verificar cache do OCR primeiro (com timeout de 5s)
        console.log(`🔍 [CRON-PROOFS] Verificando cache OCR...`);
        let analysis = null;
        
        try {
          const cachePromise = db.getOCRResult(txid);
          const cacheTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout cache (5s)')), 5000)
          );
          analysis = await Promise.race([cachePromise, cacheTimeout]);
        } catch (cacheErr) {
          console.warn(`⚠️ [CRON-PROOFS] Erro ou timeout na verificação de cache: ${cacheErr.message}`);
        }
        
        if (analysis) {
          console.log(`⚡ [CRON-PROOFS] Cache encontrado! (confiança: ${analysis.confidence}%)`);
        } else {
          console.log(`📊 [CRON-PROOFS] Cache não encontrado, iniciando análise OCR.space...`);
          
          // Salvar URL no banco
          await db.updateProofFileUrl(txid, fileUrl);
          
          // Análise OCR (com timeout de 3 minutos)
          const analysisPromise = proofAnalyzer.analyzeProof(
            fileUrl,
            transaction.amount,
            transaction.pix_key,
            fileType
          );
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout análise OCR (3 min)')), 180000)
          );
          
          analysis = await Promise.race([analysisPromise, timeoutPromise]);
          
          // Salvar resultado no cache
          if (analysis) {
            await db.saveOCRResult(txid, analysis);
          }
        }
        
        console.log(`📊 [CRON-PROOFS] Análise concluída:`, {
          isValid: analysis?.isValid,
          confidence: analysis?.confidence,
          reason: analysis?.details?.reason
        });
        
        // 4. Obter nome do produto
        let productName = 'Produto não encontrado';
        try {
          if (transaction.group_id) {
            const { data: groupData } = await db.supabase
              .from('groups')
              .select('group_name, group_id')
              .eq('id', transaction.group_id)
              .single();
            if (groupData) {
              productName = groupData.group_name || `Grupo ${groupData.group_id}`;
            }
          } else if (transaction.media_pack_id) {
            const pack = await db.getMediaPackById(transaction.media_pack_id);
            productName = pack ? pack.name : transaction.media_pack_id;
          } else if (transaction.product_id) {
            if (transaction.product_id.startsWith('group_')) {
              const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
              const group = await db.getGroupById(groupTelegramId);
              productName = group ? (group.group_name || `Grupo ${group.group_id}`) : transaction.product_id;
            } else {
              const product = await db.getProduct(transaction.product_id, true);
              productName = product ? product.name : transaction.product_id;
            }
          }
        } catch (err) {
          console.error('Erro ao buscar nome do produto:', err);
        }
        
        // 5. Ajustar threshold de aprovação inteligente
        const trustedUser = await db.getTrustedUser(chatId);
        let approvalThreshold = 70;
        let adjustedConfidence = analysis?.confidence || 0;
        
        if (trustedUser) {
          approvalThreshold = trustedUser.auto_approve_threshold || 60;
          const trustBonus = Math.min(15, (trustedUser.trust_score - 50) / 5);
          adjustedConfidence = Math.min(100, adjustedConfidence + trustBonus);
        }
        
        if (analysis?.details?.hasCorrectValue && analysis?.details?.hasPixKey) {
          const amountPattern = await db.updateProofPattern('amount', transaction.amount, true);
          const pixKeyPattern = await db.updateProofPattern('pix_key', transaction.pix_key, true);
          
          if (amountPattern && amountPattern.confidence_score > 80) adjustedConfidence = Math.min(100, adjustedConfidence + 5);
          if (pixKeyPattern && pixKeyPattern.confidence_score > 80) adjustedConfidence = Math.min(100, adjustedConfidence + 5);
        }
        
        // 6. Decisão
        const shouldAutoApprove = analysis && 
                                 analysis.isValid === true && 
                                 adjustedConfidence >= approvalThreshold;
                                 
        if (shouldAutoApprove) {
          console.log(`✅ [CRON-PROOFS] APROVAÇÃO AUTOMÁTICA para TXID ${txid} (confiança: ${adjustedConfidence}% >= ${approvalThreshold}%)`);
          
          // Notificar usuário (Pagamento Aprovado)
          try {
            await telegram.sendMessage(chatId, `✅ *Pagamento aprovado!*\n\n📦 *Entregando produto...*\n\n⏳ Preparando sua entrega.\n\n🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          } catch (notifyErr) {
            console.error('Erro ao notificar usuário:', notifyErr.message);
          }
          
          // Aprovar transação no banco
          await db.validateTransaction(txid, transaction.user_id);
          
          // Atualizar trust score
          if (transaction.user_id) {
            await db.updateTrustedUser(chatId, transaction.user_id, true);
          }
          
          // Notificar admins sobre aprovação automática
          const admins = await db.getAllAdmins();
          for (const admin of admins) {
            try {
              await telegram.sendMessage(admin.telegram_id, 
                `✅ *COMPROVANTE APROVADO AUTOMATICAMENTE (CRON)*
 
🤖 *Análise OCR:* ${analysis.confidence}% de confiança
💰 Valor confirmado: R$ ${analysis.details.amount || transaction.amount}
👤 Usuário: ${fromUser.first_name || 'Usuário'} (@${fromUser.username || 'N/A'})
🆔 ID: ${chatId}
📦 Produto: ${productName}
📅 ${new Date().toLocaleString('pt-BR')}
 
🆔 TXID: ${txid}
 
${fileType === 'pdf' ? '📄' : '🖼️'} Tipo: ${fileType === 'pdf' ? 'PDF' : 'Imagem'}
✅ Status: *ENTREGUE AUTOMATICAMENTE*`, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [[
                    { text: '❌ Cancelar entrega', callback_data: `reject_${txid}` }
                  ]]
                }
              });
            } catch (notifyErr) {
              console.error(`Erro ao notificar admin ${admin.telegram_id}:`, notifyErr.message);
            }
          }
          
          // Entregar produto
          const isGroupRenewal = transaction.group_id || 
                                (transaction.product_id && transaction.product_id.startsWith('group_'));
                                
          if (isGroupRenewal) {
            let group = null;
            if (transaction.group_id) {
              const { data: groupData } = await db.supabase
                .from('groups')
                .select('*')
                .eq('id', transaction.group_id)
                .single();
              group = groupData;
            }
            
            if (!group && transaction.product_id && transaction.product_id.startsWith('group_')) {
              const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
              group = await db.getGroupById(groupTelegramId);
            }
            
            if (group) {
              await db.addGroupMember({
                telegramId: chatId,
                userId: transaction.user_id,
                groupId: group.id,
                days: group.subscription_days
              });
              
              await deliver.addUserToGroup(telegram, chatId, group);
              
              try {
                const zwsp = '\u200B';
                const zwnj = '\u200C';
                await telegram.sendMessage(chatId, `✅ *ASSINATURA APROVADA!*
 
👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias
 
✅ *Seu acesso foi liberado!*
 
🔗 *Link direto para entrar:*
${group.group_link}
 
Clique no botão abaixo ou no link acima para entrar no grupo:
 
🆔 TXID: ${txid}
 
${zwsp}${zwnj}${zwsp}`, {
                  parse_mode: 'Markdown',
                  disable_web_page_preview: false
                });
              } catch (msgErr) {
                console.error('Erro ao enviar link ao usuário:', msgErr.message);
              }
              
              await db.markAsDelivered(txid);
            } else {
              console.error(`Grupo não encontrado para transação ${txid}`);
            }
          } else if (transaction.media_pack_id) {
            const packId = transaction.media_pack_id;
            try {
              const { data: transData } = await db.supabase
                .from('transactions')
                .select('id')
                .eq('txid', txid)
                .single();
                
              await deliver.deliverMediaPack(
                chatId,
                packId,
                transaction.user_id,
                transData.id,
                db
              );
              await db.markAsDelivered(txid);
            } catch (err) {
              console.error(`Erro ao entregar media pack:`, err.message);
              try {
                await telegram.sendMessage(chatId, `⚠️ *PAGAMENTO APROVADO AUTOMATICAMENTE!*
 
Seu pagamento foi confirmado, mas ocorreu um erro ao enviar as mídias. Entre em contato com o suporte.
 
🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
              } catch (_) {}
            }
          } else {
            // Produto digital via Storage
            let product = null;
            if (transaction.product_id) {
              product = await db.getProduct(transaction.product_id, true);
            }
            
            try {
              await deliver.deliverProductFromStorage(
                chatId,
                transaction.product_id,
                productName
              );
              await db.markAsDelivered(txid);
            } catch (deliverErr) {
              console.error(`Erro ao entregar produto via Storage:`, deliverErr.message);
              try {
                await telegram.sendMessage(chatId, `✅ *PAGAMENTO APROVADO!*\n\n📦 *${productName}*\n\nOcorreu um erro ao enviar automaticamente. Entre em contato com /suporte.\n\n🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
              } catch (_) {}
              await db.markAsDelivered(txid);
            }
          }
          
          results.approved++;
          txResult.status = 'approved';
          
        } else if (analysis && analysis.isValid === false && adjustedConfidence < 40) {
          // Baixa confiança - Decisão do admin manual
          console.log(`⚠️ [CRON-PROOFS] BAIXA CONFIANÇA para TXID ${txid} - Notificando cliente e admin`);
          
          // Enviar "Em análise" para o usuário
          try {
            await telegram.sendMessage(chatId, `⚠️ *COMPROVANTE EM ANÁLISE*
 
📸 Seu comprovante foi recebido e está sendo analisado.
 
⏳ *Um admin irá validar manualmente em breve.*
 
💡 *Dica:* Se o comprovante estiver com baixa qualidade, você pode enviar outro mais claro.
 
🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
          } catch (_) {}
          
          // Notificar admins
          const admins = await db.getAllAdmins();
          for (const admin of admins) {
            try {
              await telegram.sendMessage(admin.telegram_id, 
                `⚠️ *COMPROVANTE COM BAIXA CONFIANÇA - VALIDAÇÃO MANUAL NECESSÁRIA*
 
🤖 *Análise OCR:* ${analysis.confidence}% de confiança (< 40%)
⚠️ Motivo: ${analysis.details.reason || 'Comprovante não corresponde aos dados esperados'}
👤 Usuário: ${fromUser.first_name || 'Usuário'} (@${fromUser.username || 'N/A'})
🆔 ID: ${chatId}
📦 Produto: ${productName}
💰 Valor esperado: R$ ${transaction.amount}
📅 ${new Date().toLocaleString('pt-BR')}
 
🆔 TXID: ${txid}
 
⚠️ *Status:* PENDENTE DE VALIDAÇÃO MANUAL
👁️ *Revise o comprovante e decida:*`, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '✅ Aprovar', callback_data: `approve_${txid}` },
                      { text: '❌ Rejeitar', callback_data: `reject_${txid}` }
                    ],
                    [
                      { text: '📋 Ver detalhes', callback_data: `details_${txid}` }
                    ]
                  ]
                }
              });
            } catch (_) {}
          }
          
          results.manual_review++;
          txResult.status = 'manual_review_low_confidence';
          
        } else {
          // Inconclusiva
          console.log(`⚠️ [CRON-PROOFS] Análise inconclusiva para TXID ${txid} (confiança: ${adjustedConfidence}%)`);
          
          const admins = await db.getAllAdmins();
          for (const admin of admins) {
            try {
              await telegram.sendMessage(admin.telegram_id, 
                `⚠️ *COMPROVANTE EM ANÁLISE MANUAL (INCONCLUSIVO)*
 
🤖 *Análise OCR:* ${analysis?.confidence || 0}% de confiança
👤 Usuário: ${fromUser.first_name || 'Usuário'} (@${fromUser.username || 'N/A'})
🆔 ID: ${chatId}
📦 Produto: ${productName}
💰 Valor esperado: R$ ${transaction.amount}
📅 ${new Date().toLocaleString('pt-BR')}
 
🆔 TXID: ${txid}
 
👁️ *Revise o comprovante e decida:*`, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '✅ Aprovar', callback_data: `approve_${txid}` },
                      { text: '❌ Rejeitar', callback_data: `reject_${txid}` }
                    ],
                    [
                      { text: '📋 Ver detalhes', callback_data: `details_${txid}` }
                    ]
                  ]
                }
              });
            } catch (_) {}
          }
          
          results.manual_review++;
          txResult.status = 'manual_review_inconclusive';
        }
        
      } catch (err) {
        console.error(`❌ [CRON-PROOFS] Erro no processamento individual do TXID ${txid}:`, err.message);
        results.errors++;
        txResult.status = 'error';
        txResult.error = err.message;

        // ✅ CORREÇÃO ERRO 3: file_id expirado — marcar ocr_analyzed_at para parar o loop eterno
        const isExpiredFile = (
          err.message.includes('wrong file_id') ||
          err.message.includes('file is temporarily unavailable') ||
          err.message.includes('FILE_ID_INVALID')
        );

        if (isExpiredFile) {
          console.warn(`⚠️ [CRON-PROOFS] File_id EXPIRADO para TXID ${txid} — marcando ocr_analyzed_at para não reprocessar`);
          try {
            await db.supabase
              .from('transactions')
              .update({
                ocr_analyzed_at: new Date().toISOString(),
                ocr_result: JSON.stringify({
                  isValid: null,
                  confidence: 0,
                  details: { reason: 'Arquivo expirado no Telegram — revisão manual necessária', needsManualReview: true }
                }),
                updated_at: new Date().toISOString()
              })
              .eq('txid', txid);
          } catch (updateErr) {
            console.error(`❌ [CRON-PROOFS] Erro ao marcar ocr_analyzed_at:`, updateErr.message);
          }

          // Notificar admin que o arquivo expirou e precisa de revisão manual
          try {
            const admins = await db.getAllAdmins();
            for (const admin of admins) {
              try {
                await telegram.sendMessage(admin.telegram_id,
                  `⚠️ *COMPROVANTE EXPIRADO — REVISÃO MANUAL*\n\n` +
                  `📁 O arquivo do Telegram expirou e não pode mais ser analisado pelo OCR.\n\n` +
                  `👤 Usuário ID: ${chatId}\n` +
                  `💰 Valor: R$ ${transaction.amount}\n` +
                  `🆔 TXID: ${txid}\n\n` +
                  `👁️ *Revise manualmente e decida:*`, {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '✅ Aprovar', callback_data: `approve_${txid}` },
                      { text: '❌ Rejeitar', callback_data: `reject_${txid}` }
                    ]]
                  }
                });
              } catch (_) {}
            }
          } catch (_) {}

          txResult.status = 'expired_file';
          results.details.push(txResult);
          continue;
        }

        // Para outros erros: notificar admins normalmente
        try {
          const admins = await db.getAllAdmins();
          for (const admin of admins) {
            try {
              await telegram.sendMessage(admin.telegram_id,
                `⚠️ *COMPROVANTE AGUARDANDO REVISÃO MANUAL (ERRO OCR)*
 
🤖 OCR falhou — o comprovante precisa ser revisado manualmente.
 
👤 Usuário: ID ${chatId}
💰 Valor: R$ ${transaction.amount}
❌ Erro OCR: ${err.message}
🆔 TXID: ${txid}
 
👁️ *Revise o comprovante e decida:*`, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [[
                    { text: '✅ Aprovar', callback_data: `approve_${txid}` },
                    { text: '❌ Rejeitar', callback_data: `reject_${txid}` }
                  ]]
                }
              });
            } catch (_) {}
          }
        } catch (_) {}
      }
      
      results.details.push(txResult);
    }
    
    const duration = Date.now() - startTime;
    console.log('✅ [CRON-PROOFS] Execução concluída com sucesso', {
      duration_ms: duration,
      results
    });
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results
    });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('❌ [CRON-PROOFS] Erro crítico geral:', err.message, err.stack);
    
    return res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  }
};
