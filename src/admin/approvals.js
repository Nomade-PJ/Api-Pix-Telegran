// src/admin/approvals.js
// Aprovar/rejeitar, falhas, retry, navegação
const { Markup } = require('telegraf');
const db = require('../database');
const deliver = require('../deliver');

function registerApprovalHandlers(bot) {
  // ===== FUNÇÃO PARA PROCESSAR ENTREGA POR TXID =====
  async function processarEntregaPorTxid(ctx, txid) {
    try {
      await ctx.reply('⏳ Buscando transação e preparando entrega...');
      
      // Buscar transação
      const transaction = await db.getTransactionByTxid(txid);
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.\n\nVerifique se o TXID está correto.', {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
            ]]
          }
        });
      }
      
      // Validar transação (deve estar validada para entregar)
      if (!['validated', 'delivered'].includes(transaction.status)) {
        // Se não está validada, validar primeiro
        if (transaction.status !== 'validated') {
          await db.validateTransaction(txid, transaction.user_id || ctx.from.id);
        }
      }
      
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      const userName = user ? `${user.first_name} (@${user?.username || 'N/A'})` : 'N/A';
      
      // Verificar tipo de entrega e processar
      let entregaRealizada = false;
      let mensagemEntrega = '';
      
      // 1. MEDIA PACK
      if (transaction.media_pack_id) {
        const packId = transaction.media_pack_id;
        
        try {
          // Buscar o internal ID da transação
          const { data: transData, error: transError } = await db.supabase
            .from('transactions')
            .select('id')
            .eq('txid', txid)
            .single();
          
          if (transError) throw transError;
          
          await ctx.reply('📸 Entregando media pack...');
          
          // Entregar media pack
          await deliver.deliverMediaPack(
            transaction.telegram_id,
            packId,
            transaction.user_id,
            transData.id,
            db
          );
          
          await db.markAsDelivered(txid);
          entregaRealizada = true;
          mensagemEntrega = `📸 Media Pack entregue com sucesso!`;
          
        } catch (err) {
          console.error('Erro ao entregar media pack:', err);
          return ctx.reply(`❌ *Erro ao entregar Media Pack*\n\nErro: ${err.message}\n\nVerifique os logs para mais detalhes.`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
              ]]
            }
          });
        }
      }
      // 2. PRODUTO
      else if (transaction.product_id) {
        try {
          await ctx.reply('📦 Entregando produto...');
          
          const product = await db.getProduct(transaction.product_id, true);
          if (!product) {
            throw new Error(`Produto "${transaction.product_id}" não encontrado`);
          }
          
          await deliver.deliverProductFromStorage(transaction.telegram_id, transaction.product_id, product.name);
          await db.markAsDelivered(txid);
          entregaRealizada = true;
          mensagemEntrega = `📦 Produto "${product.name}" entregue com sucesso!`;
          
        } catch (err) {
          console.error('Erro ao entregar produto:', err);
          return ctx.reply(`❌ *Erro ao entregar Produto*\n\nErro: ${err.message}\n\nVerifique os logs para mais detalhes.`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
              ]]
            }
          });
        }
      }
      // 3. GRUPO
      else if (transaction.group_id || (transaction.product_id && transaction.product_id.startsWith('group_'))) {
        let group = null;
        
        // Método novo: usar group_id direto
        if (transaction.group_id) {
          const { data: groupData, error: groupError } = await db.supabase
            .from('groups')
            .select('*')
            .eq('id', transaction.group_id)
            .single();
          
          if (!groupError && groupData) {
            group = groupData;
          }
        }
        
        // Método antigo: usar product_id (compatibilidade)
        if (!group && transaction.product_id && transaction.product_id.startsWith('group_')) {
          const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
          group = await db.getGroupById(groupTelegramId);
        }
        
        if (group) {
          try {
            await ctx.reply('👥 Adicionando ao grupo...');
            
            // Adicionar ou renovar assinatura no banco
            await db.addGroupMember({
              telegramId: transaction.telegram_id,
              userId: transaction.user_id,
              groupId: group.id,
              days: group.subscription_days
            });
            
            // Tentar adicionar usuário diretamente ao grupo
            await deliver.addUserToGroup(ctx.telegram, transaction.telegram_id, group);
            
            // Calcular data de expiração
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
            
            // Notificar usuário
            await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *ASSINATURA APROVADA!*

👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias
🕐 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}

${group.group_link ? `🔗 Link: ${group.group_link}` : ''}

Obrigado pela preferência! 💚`, {
              parse_mode: 'Markdown'
            });
            
            await db.markAsDelivered(txid);
            entregaRealizada = true;
            mensagemEntrega = `👥 Usuário adicionado ao grupo "${group.group_name}"!`;
            
          } catch (err) {
            console.error('Erro ao adicionar ao grupo:', err);
            return ctx.reply(`❌ *Erro ao adicionar ao grupo*\n\nErro: ${err.message}\n\nVerifique os logs para mais detalhes.`, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
                ]]
              }
            });
          }
        } else {
          return ctx.reply('❌ Grupo não encontrado para esta transação.', {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
              ]]
            }
          });
        }
      } else {
        return ctx.reply('⚠️ *Tipo de transação não identificado*\n\nEsta transação não possui produto, media pack ou grupo associado.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
            ]]
          }
        });
      }
      
      // Mensagem de sucesso
      if (entregaRealizada) {
        return ctx.reply(`✅ *ENTREGA REALIZADA COM SUCESSO!*

🆔 TXID: \`${txid}\`
👤 Usuário: ${userName}
💰 Valor: R$ ${transaction.amount}
📦 Tipo: ${transaction.media_pack_id ? 'Media Pack' : transaction.product_id ? 'Produto' : 'Grupo'}

${mensagemEntrega}

✅ Status: Entregue
📅 Data: ${new Date().toLocaleString('pt-BR')}`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 Ver Detalhes', callback_data: `details_${txid}` },
              { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
            ]]
          }
        });
      }
      
    } catch (err) {
      console.error('Erro ao processar entrega por TXID:', err);
      return ctx.reply(`❌ *Erro ao processar entrega*\n\nErro: ${err.message}\n\nVerifique os logs para mais detalhes.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
    }
  }

  // ===== APROVAR/REJEITAR TRANSAÇÕES VIA BOTÕES =====
  
  bot.action(/^approve_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('✅ Aprovando...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      // Permitir aprovação de transações com comprovante (proof_sent) ou expiradas (expired)
      // Se já foi validada/entregue/cancelada, não permitir
      if (!['proof_sent', 'expired', 'pending'].includes(transaction.status)) {
        return ctx.reply(`⚠️ Esta transação já foi processada.\n\nStatus: ${transaction.status}`);
      }
      
      // Se não tem comprovante, avisar admin
      if (!transaction.proof_file_id && transaction.status === 'pending') {
        return ctx.reply(`⚠️ *Atenção!*\n\nEsta transação não tem comprovante enviado.\n\n🆔 TXID: ${txid}\nStatus: ${transaction.status}\n\n❓ Tem certeza que deseja aprovar mesmo assim?\n\n_Responda com:_ /force_approve_${txid}`, {
          parse_mode: 'Markdown'
        });
      }
      
      // Validar transação
      await db.validateTransaction(txid, transaction.user_id);
      
      // 🆕 Atualizar trust score do usuário (aprovado)
      if (transaction.user_id && transaction.telegram_id) {
        try {
          await db.updateTrustedUser(transaction.telegram_id, transaction.user_id, true);
          console.log(`⭐ [TRUST] Trust score atualizado para usuário ${transaction.telegram_id}`);
        } catch (err) {
          console.error('Erro ao atualizar trust score:', err);
        }
      }
      
      // Verificar se é media pack (fotos/vídeos aleatórios)
      if (transaction.media_pack_id) {
        const packId = transaction.media_pack_id;
        
        try {
          // Buscar o internal ID da transação
          const { data: transData, error: transError } = await db.supabase
            .from('transactions')
            .select('id')
            .eq('txid', txid)
            .single();
          
          if (transError) throw transError;
          
          // Entregar media pack (fotos/vídeos aleatórios)
          await deliver.deliverMediaPack(
            transaction.telegram_id,
            packId,
            transaction.user_id,
            transData.id,
            db
          );
          
          // Marcar como entregue após entrega bem-sucedida
          await db.markAsDelivered(txid);
          
          console.log(`✅ Media pack ${packId} entregue com sucesso e marcado como entregue`);
        } catch (err) {
          console.error('Erro ao entregar media pack:', err);
          
          // Notificar usuário sobre erro
          try {
            await ctx.telegram.sendMessage(transaction.telegram_id, `⚠️ *PAGAMENTO APROVADO!*

Seu pagamento foi confirmado, mas ocorreu um erro ao enviar as mídias.

Entre em contato com o suporte.

🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          } catch (notifyErr) {
            console.error('Erro ao notificar usuário:', notifyErr);
          }
        }
      }
      // 🆕 Verificar se é assinatura/renovação de grupo (via group_id OU product_id antigo)
      const isGroupRenewal = transaction.group_id || 
                            (transaction.product_id && transaction.product_id.startsWith('group_'));
      
      if (isGroupRenewal) {
        let group = null;
        
        // Método novo: usar group_id direto
        if (transaction.group_id) {
          const { data: groupData, error: groupError } = await db.supabase
            .from('groups')
            .select('*')
            .eq('id', transaction.group_id)
            .single();
          
          if (!groupError && groupData) {
            group = groupData;
          }
        }
        
        // Método antigo: usar product_id (compatibilidade)
        if (!group && transaction.product_id && transaction.product_id.startsWith('group_')) {
          const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
          group = await db.getGroupById(groupTelegramId);
        }
        
        if (group) {
          console.log(`👥 [ADMIN] Adicionando usuário ${transaction.telegram_id} ao grupo ${group.group_name}`);
          
          // Adicionar ou renovar assinatura no banco (monitoramento de dias)
          await db.addGroupMember({
            telegramId: transaction.telegram_id,
            userId: transaction.user_id,
            groupId: group.id,
            days: group.subscription_days
          });
          
          // Tentar adicionar usuário diretamente ao grupo
          const addedToGroup = await deliver.addUserToGroup(ctx.telegram, transaction.telegram_id, group);
          
          // Notificar usuário - mensagem diferente se foi adicionado automaticamente
          try {
            const { Markup } = require('telegraf');
            
            // Calcular data de expiração
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
            
            // Mensagem única seguindo estrutura da imagem
            const zwsp = '\u200B'; // Zero-width space
            const zwnj = '\u200C'; // Zero-width non-joiner
            await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *ASSINATURA APROVADA!*

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
            
            console.log(`✅ [ADMIN] Mensagem com link enviada ao usuário ${transaction.telegram_id}`);
          } catch (err) {
            console.error('❌ [ADMIN] Erro ao notificar usuário:', err);
            
            // Tentar enviar mensagem simples como fallback
            try {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
              
              // Mensagem única seguindo estrutura da imagem
              const zwsp = '\u200B'; // Zero-width space
              const zwnj = '\u200C'; // Zero-width non-joiner
              await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *ASSINATURA APROVADA!*

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
            } catch (fallbackErr) {
              console.error('❌ [ADMIN] Erro no fallback:', fallbackErr.message);
            }
          }
        } else {
          console.error(`❌ [ADMIN] Grupo não encontrado para transação ${txid}`);
        }
      } else if (transaction.product_id) {
        // 🆕 Entregar produto via Supabase Storage (pastas por produto)
        const product = await db.getProduct(transaction.product_id, true);
        const pName = product ? product.name : transaction.product_id;
        try {
          console.log(`📨 [ADMIN-APPROVE] Entregando "${pName}" via Storage para ${transaction.telegram_id}`);
          const storageResult = await deliver.deliverProductFromStorage(
            transaction.telegram_id,
            transaction.product_id,
            pName
          );
          console.log(`✅ [ADMIN-APPROVE] Storage entregue: ${JSON.stringify(storageResult)}`);
        } catch (deliverErr) {
          const errorType = deliver.classifyDeliveryError(deliverErr);
          console.error(`❌ [ADMIN-APPROVE] Erro na entrega via Storage (${errorType}):`, deliverErr.message);
          // Avisar usuário sobre erro
          try {
            await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *PAGAMENTO APROVADO!*\n\n📦 *${pName}*\n\nOcorreu um erro ao enviar automaticamente. Entre em contato com /suporte.\n\n🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
          } catch (_) {}
        }
      }

      await db.markAsDelivered(txid);

      await ctx.editMessageReplyMarkup({
        inline_keyboard: [[{ text: '✅ Aprovado', callback_data: 'approved' }]]
      });

      return ctx.reply(`✅ *Transação aprovada com sucesso!*\n\n🆔 TXID: ${txid}\n👤 Usuário notificado\n📦 Produto/Grupo entregue`, {
        parse_mode: 'Markdown'
      });

    } catch (err) {
      console.error('Erro ao aprovar transação:', err);
      return ctx.reply('❌ Erro ao aprovar transação.');
    }
  });

  // ===== HELPER: Notifica admins sobre falha na entrega =====
  async function notifyDeliveryFailure(ctx, transaction, txid, errorMessage, errorType) {
    const esc = (s) => String(s || '').replace(/([_*`[\]])/g, '\\$1');
    const typeLabel = {
      blocked: '🚫 Usuário bloqueou o bot',
      temporary: '⏱️ Erro temporário de rede',
      unknown: '❓ Erro desconhecido'
    }[errorType] || errorType;

    const msg =
      `⚠️ *FALHA NA ENTREGA*\n\n` +
      `👤 ${esc(transaction.user?.first_name || 'N/A')}\n` +
      `🔢 ID: \`${transaction.telegram_id}\`\n` +
      `💵 Valor: R$ ${transaction.amount}\n` +
      `❌ Motivo: ${typeLabel}\n` +
      `🆔 TXID: \`${esc(txid)}\``;

    const keyboard = {
      inline_keyboard: [[
        { text: '🔄 Tentar Novamente', callback_data: `retry_delivery:${txid}` },
        { text: '✅ Marcar Entregue', callback_data: `force_delivered:${txid}` }
      ]]
    };

    try {
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch (e) {
      console.error('Erro ao enviar alerta de falha:', e.message);
    }
  }

  // ===== RETRY MANUAL DA ENTREGA =====
  bot.action(/^retry_delivery:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('🔄 Tentando reenviar...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;

    const txid = ctx.match[1];
    const transaction = await db.getTransactionByTxid(txid);
    if (!transaction) return ctx.reply('❌ Transação não encontrada.');

    try {
      if (transaction.product_id && !transaction.product_id.startsWith('group_')) {
        const product = await db.getProduct(transaction.product_id, true);
        if (!product) throw new Error('Produto não encontrado');
        await deliver.deliverProductFromStorage(transaction.telegram_id, transaction.product_id, product.name);
      } else if (transaction.media_pack_id) {
        const { data: transData } = await db.supabase.from('transactions').select('id').eq('txid', txid).single();
        await deliver.deliverMediaPack(transaction.telegram_id, transaction.media_pack_id, transaction.user_id, transData.id, db);
      } else if (transaction.group_id) {
        const { data: group } = await db.supabase.from('groups').select('*').eq('id', transaction.group_id).single();
        if (group) {
          await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *SEU ACESSO FOI LIBERADO!*\n\n👥 ${group.group_name}\n🔗 ${group.group_link}`, { parse_mode: 'Markdown' });
        }
      }

      await db.markAsDelivered(txid);
      await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✅ Entregue com sucesso', callback_data: 'done' }]] });
      return ctx.reply(`✅ Reenvio bem-sucedido!\n\n🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });

    } catch (err) {
      const errorType = deliver.classifyDeliveryError(err);
      await db.markDeliveryFailed(txid, err.message, errorType);
      return ctx.reply(`❌ Reenvio falhou novamente.\n\nMotivo: ${err.message}\nTipo: ${errorType}`, { parse_mode: 'Markdown' });
    }
  });

  // ===== FORÇAR MARCAÇÃO COMO ENTREGUE (sem reenvio) =====
  bot.action(/^force_delivered:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('✅ Marcando como entregue...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;

    const txid = ctx.match[1];
    await db.markAsDelivered(txid);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✅ Marcado como entregue manualmente', callback_data: 'done' }]] });
    return ctx.reply(`✅ TXID \`${txid}\` marcado como entregue manualmente.`, { parse_mode: 'Markdown' });
  });

  // ===== PAINEL: VER FALHAS DE ENTREGA =====
  bot.action('admin_delivery_failures', async (ctx) => {
    await ctx.answerCbQuery('⚠️ Carregando falhas...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;

    const failures = await db.getAllDeliveryFailures(15);

    if (failures.length === 0) {
      return ctx.reply('✅ Nenhuma falha de entrega registrada!', {
        ...require('telegraf').Markup.inlineKeyboard([[require('telegraf').Markup.button.callback('🔙 Voltar', 'admin_refresh')]])
      });
    }

    const esc = (s) => String(s || '').replace(/([_*`[\]])/g, '\\$1');
    const typeLabel = { blocked: '🚫 Bloqueado', temporary: '⏱️ Temporário', unknown: '❓ Desconhecido' };

    let msg = `⚠️ *FALHAS DE ENTREGA* (${failures.length})

`;
    const buttons = [];

    for (const f of failures.slice(0, 10)) {
      const nome = esc(f.user?.first_name || 'N/A');
      const tipo = typeLabel[f.delivery_error_type] || f.delivery_error_type;
      msg += `👤 ${nome} | 💵 R$ ${f.amount}
`;
      msg += `❌ ${tipo} | 🔁 ${f.delivery_attempts}x
`;
      msg += `🆔 \`${esc(f.txid?.substring(0, 12))}...\`
──────────
`;
      if (f.delivery_error_type !== 'blocked') {
        buttons.push([
          { text: `🔄 ${f.txid.substring(0, 8)}`, callback_data: `retry_delivery:${f.txid}` },
          { text: '✅ Manual', callback_data: `force_delivered:${f.txid}` }
        ]);
      } else {
        buttons.push([{ text: `✅ Marcar entregue: ${f.txid.substring(0, 8)}`, callback_data: `force_delivered:${f.txid}` }]);
      }
    }

    buttons.push([{ text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }]);

    return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
  });

  bot.action(/^reject_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('❌ Rejeitando...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      // Permitir rejeição de transações com comprovante (proof_sent), expiradas (expired) ou pendentes
      // Se já foi validada/entregue/cancelada, não permitir
      if (!['proof_sent', 'expired', 'pending'].includes(transaction.status)) {
        return ctx.reply(`⚠️ Esta transação já foi processada.\n\nStatus: ${transaction.status}`);
      }
      
      // Cancelar transação
      await db.cancelTransaction(txid);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(transaction.telegram_id, `❌ *COMPROVANTE REJEITADO*

Seu comprovante foi analisado e não foi aprovado.

🔄 *O que fazer:*
1. Verifique se pagou o valor correto (R$ ${transaction.amount})
2. Verifique se pagou para a chave correta
3. Tente enviar outro comprovante
4. Ou faça uma nova compra: /start

🆔 TXID: ${txid}`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      // Atualizar mensagem do botão
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: '❌ Rejeitado', callback_data: 'rejected' }]
        ]
      });
      
      return ctx.reply(`❌ *Transação rejeitada!*

🆔 TXID: ${txid}
👤 Usuário notificado`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao rejeitar transação:', err);
      return ctx.reply('❌ Erro ao rejeitar transação.');
    }
  });

  bot.action(/^details_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('📋 Carregando detalhes...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      // 🔧 Buscar usuário por UUID, não por telegram_id
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      
      // Buscar produto OU media pack
      let productName = 'N/A';
      try {
        if (transaction.group_id) {
          // É uma transação de grupo
          const { data: groupData } = await db.supabase
            .from('groups')
            .select('group_name')
            .eq('id', transaction.group_id)
            .single();
          productName = groupData?.group_name || 'Grupo';
        } else if (transaction.media_pack_id) {
          // É um media pack
        const pack = await db.getMediaPackById(transaction.media_pack_id);
          productName = pack ? pack.name : transaction.media_pack_id || 'Media Pack';
        } else if (transaction.product_id) {
          // É um produto normal - buscar incluindo inativos (transação antiga pode ter produto desativado)
          const product = await db.getProduct(transaction.product_id, true);
          productName = product ? product.name : transaction.product_id || 'Produto';
        }
      } catch (err) {
        console.error('Erro ao buscar produto/pack:', err);
        productName = transaction.media_pack_id || transaction.product_id || 'N/A';
      }
      
      // Garantir que productName nunca seja null ou undefined
      if (!productName || productName === 'null' || productName === 'undefined') {
        productName = transaction.media_pack_id || transaction.product_id || 'N/A';
      }
      
      // Construir mensagem - usar Markdown simples para evitar problemas de escape
      let message = `📋 *DETALHES DA TRANSAÇÃO*\n\n`;
      message += `🆔 TXID: \`${txid}\`\n`;
      message += `💰 Valor: R$ ${transaction.amount}\n`;
      message += `📦 Produto: ${productName}\n`;
      message += `👤 Usuário: ${user ? user.first_name : 'N/A'} (@${user?.username || 'N/A'})\n`;
      message += `🆔 ID Usuário: ${user ? user.telegram_id : 'N/A'}\n`;
      message += `🔑 Chave PIX: \`${transaction.pix_key}\`\n`;
      message += `📊 Status: ${transaction.status}\n`;
      message += `📅 Criada: ${new Date(transaction.created_at).toLocaleString('pt-BR')}\n`;
      
      if (transaction.proof_received_at) {
        message += `📸 Comprovante recebido: ${new Date(transaction.proof_received_at).toLocaleString('pt-BR')}\n`;
      }
      
      if (transaction.validated_at) {
        message += `✅ Validado em: ${new Date(transaction.validated_at).toLocaleString('pt-BR')}\n`;
      }
      
      if (transaction.delivered_at) {
        message += `📦 Entregue em: ${new Date(transaction.delivered_at).toLocaleString('pt-BR')}\n`;
      }
      
      // 🆕 Verificar se tem comprovante e tentar recuperar
      const hasProof = transaction.proof_file_id || transaction.proof_file_url;
      const keyboard = [];
      
      if (hasProof) {
        keyboard.push([
          { text: '📸 Ver Comprovante', callback_data: `get_proof_${txid}` }
        ]);
      }
      
      if (transaction.status === 'proof_sent' || transaction.status === 'pending' || transaction.status === 'expired') {
        keyboard.push([
          { text: '✅ Aprovar', callback_data: `approve_${txid}` },
          { text: '❌ Rejeitar', callback_data: `reject_${txid}` }
        ]);
      }
      
      // 🆕 Botão para reverter transação entregue ou validada
      if (transaction.status === 'delivered' || transaction.status === 'validated') {
        keyboard.push([
          { text: '🔄 Reverter Transação', callback_data: `reverse_${txid}` }
        ]);
      }
      
      message += `\n*Ações:*\n`;
      if (transaction.status === 'proof_sent' || transaction.status === 'pending' || transaction.status === 'expired') {
        message += `✅ /validar${txid} - Aprovar\n`;
        message += `❌ /rejeitar${txid} - Rejeitar`;
      } else if (transaction.status === 'delivered' || transaction.status === 'validated') {
        message += `🔄 Reverter transação (cancela e remove acesso)`;
      }
      
      return ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
      });
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      return ctx.reply('❌ Erro ao buscar detalhes.');
    }
  });

  // 🆕 Handler para reverter transação entregue
  bot.action(/^reverse_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Revertendo transação...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (!['validated', 'delivered'].includes(transaction.status)) {
        return ctx.reply(`⚠️ Esta transação não pode ser revertida.\n\nStatus atual: ${transaction.status}\n\nApenas transações validadas ou entregues podem ser revertidas.`);
      }
      
      // Confirmar reversão
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      const userName = user ? `${user.first_name} (@${user?.username || 'N/A'})` : 'N/A';
      
      // Atualizar mensagem com confirmação
      await ctx.editMessageText(`⚠️ *CONFIRMAR REVERSÃO DE TRANSAÇÃO*

🆔 TXID: \`${txid}\`
👤 Usuário: ${userName}
💰 Valor: R$ ${transaction.amount}
📦 Produto: ${transaction.product_id || transaction.media_pack_id || 'N/A'}

⚠️ *ATENÇÃO:*
• A transação será cancelada
• Entregas de mídia serão deletadas (se houver)
• O usuário perderá acesso ao produto/grupo
• Esta ação não pode ser desfeita

Deseja continuar?`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirmar Reversão', callback_data: `confirm_reverse_${txid}` },
              { text: '❌ Cancelar', callback_data: `details_${txid}` }
            ]
          ]
        }
      });
      
    } catch (err) {
      console.error('Erro ao iniciar reversão:', err);
      return ctx.reply('❌ Erro ao iniciar reversão.');
    }
  });

  // Handler para confirmar reversão
  bot.action(/^confirm_reverse_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Revertendo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const txid = ctx.match[1];
      
      // Reverter transação
      const result = await db.reverseTransaction(txid, 'Transação revertida manualmente pelo admin - comprovante incorreto');
      
      if (!result.success) {
        return ctx.reply(`❌ Erro ao reverter transação:\n\n${result.error}`);
      }
      
      const transaction = result.transaction;
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(transaction.telegram_id, `⚠️ *TRANSAÇÃO CANCELADA*

Sua transação foi cancelada pelo administrador.

🆔 TXID: \`${txid}\`
💰 Valor: R$ ${transaction.amount}
📅 Cancelada em: ${new Date().toLocaleString('pt-BR')}

Se você acredita que isso foi um erro, entre em contato com o suporte: /suporte`, {
          parse_mode: 'Markdown'
        });
      } catch (notifyErr) {
        console.error('Erro ao notificar usuário:', notifyErr);
      }
      
      // Se for grupo, tentar remover do grupo via Telegram
      if (transaction.group_id) {
        try {
          const group = await db.getGroupById(transaction.group_id);
          if (group && group.group_id) {
            // Tentar banir e desbanir para remover
            try {
              await ctx.telegram.banChatMember(group.group_id, transaction.telegram_id);
              await ctx.telegram.unbanChatMember(group.group_id, transaction.telegram_id, { only_if_banned: true });
              console.log(`✅ [REVERSE] Usuário removido do grupo via Telegram: ${transaction.telegram_id}`);
            } catch (groupErr) {
              console.error('⚠️ [REVERSE] Erro ao remover do grupo via Telegram:', groupErr.message);
            }
          }
        } catch (groupErr) {
          console.error('⚠️ [REVERSE] Erro ao buscar grupo:', groupErr.message);
        }
      }
      
      return ctx.editMessageText(`✅ *TRANSAÇÃO REVERTIDA COM SUCESSO*

🆔 TXID: \`${txid}\`
👤 Usuário: ${user ? `${user.first_name} (@${user?.username || 'N/A'})` : 'N/A'}
💰 Valor: R$ ${transaction.amount}

✅ Transação cancelada
✅ Acesso removido
✅ Usuário notificado

📋 Use /admin para voltar ao painel.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Ver Detalhes', callback_data: `details_${txid}` },
              { text: '🔙 Voltar ao Painel', callback_data: 'admin_refresh' }
            ]
          ]
        }
      });
      
    } catch (err) {
      console.error('Erro ao reverter transação:', err);
      return ctx.reply(`❌ Erro ao reverter transação:\n\n${err.message}`);
    }
  });

  // 🆕 HANDLER PARA RECUPERAR COMPROVANTE
  bot.action(/^get_proof_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('📸 Tentando recuperar comprovante...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (!transaction.proof_file_id && !transaction.proof_file_url) {
        return ctx.reply('❌ Comprovante não encontrado no banco de dados.');
      }
      
      // Tentar recuperar usando File ID primeiro (mais confiável)
      if (transaction.proof_file_id) {
        try {
          console.log(`📸 [GET-PROOF] Tentando recuperar comprovante via File ID: ${transaction.proof_file_id.substring(0, 30)}...`);
          
          // Tentar obter informações do arquivo
          const file = await ctx.telegram.getFile(transaction.proof_file_id);
          
          if (file && file.file_path) {
            // Construir URL temporária
            const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            
            // Detectar se é PDF ou imagem
            const isPDF = file.file_path.toLowerCase().endsWith('.pdf') || 
                         (transaction.proof_file_url && transaction.proof_file_url.toLowerCase().includes('.pdf'));
            
            // Tentar enviar o arquivo
            if (isPDF) {
              await ctx.reply('📄 *Comprovante em PDF:*', { parse_mode: 'Markdown' });
              await ctx.telegram.sendDocument(ctx.from.id, transaction.proof_file_id, {
                caption: `📄 Comprovante - TXID: ${txid}\n📅 Recebido em: ${transaction.proof_received_at ? new Date(transaction.proof_received_at).toLocaleString('pt-BR') : 'N/A'}`
              });
            } else {
              await ctx.reply('🖼️ *Comprovante em imagem:*', { parse_mode: 'Markdown' });
              await ctx.telegram.sendPhoto(ctx.from.id, transaction.proof_file_id, {
                caption: `🖼️ Comprovante - TXID: ${txid}\n📅 Recebido em: ${transaction.proof_received_at ? new Date(transaction.proof_received_at).toLocaleString('pt-BR') : 'N/A'}`
              });
            }
            
            return ctx.reply(`✅ *Comprovante recuperado com sucesso!*\n\n🆔 TXID: \`${txid}\`\n📎 File ID: \`${transaction.proof_file_id.substring(0, 30)}...\``, { parse_mode: 'Markdown' });
          }
        } catch (fileErr) {
          console.error('❌ [GET-PROOF] Erro ao recuperar via File ID:', fileErr.message);
          
          // Se File ID não funcionar, tentar URL (pode estar expirada)
          if (transaction.proof_file_url) {
            return ctx.reply(`⚠️ *File ID expirado ou inválido*\n\n📎 URL salva: ${transaction.proof_file_url}\n\n❌ URLs do Telegram expiram após algum tempo. O comprovante pode não estar mais acessível.\n\n💡 *Solução:* Implementar salvamento permanente de comprovantes (Supabase Storage) para evitar perda de arquivos.`, { parse_mode: 'Markdown' });
          }
          
          return ctx.reply(`❌ *Não foi possível recuperar o comprovante*\n\n📎 File ID: \`${transaction.proof_file_id.substring(0, 30)}...\`\n\n⚠️ O arquivo pode ter expirado no Telegram (arquivos ficam disponíveis por tempo limitado).\n\n💡 *Recomendação:* Solicitar ao cliente que reenvie o comprovante se necessário.`, { parse_mode: 'Markdown' });
        }
      }
      
      // Se não tem File ID, tentar URL (provavelmente expirada)
      if (transaction.proof_file_url) {
        return ctx.reply(`⚠️ *Comprovante encontrado, mas URL pode estar expirada*\n\n📎 URL: ${transaction.proof_file_url}\n\n❌ URLs do Telegram expiram após algum tempo.\n\n💡 *Solução:* Implementar salvamento permanente de comprovantes.`, { parse_mode: 'Markdown' });
      }
      
      return ctx.reply('❌ Comprovante não encontrado.');
    } catch (err) {
      console.error('❌ [GET-PROOF] Erro ao recuperar comprovante:', err);
      return ctx.reply('❌ Erro ao recuperar comprovante. Verifique os logs.');
    }
  });

  // ===== HANDLERS DE NAVEGAÇÃO PARA CRIAR PRODUTO =====
  
  bot.action('cancel_create_product', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    return ctx.reply('❌ Operação cancelada.');
  });

  bot.action('product_back_name', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.step = 'name';
    return ctx.reply(`🎯 *CRIAR NOVO PRODUTO*

*Passo 1/4:* Digite o *nome* do produto:
Exemplo: Pack Premium, Curso Avançado, etc.`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
        ]]
      }
    });
  });

  bot.action('product_back_price', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.step = 'price';
    return ctx.reply(`✅ Nome: *${session.data.name}*

*Passo 2/4:* Digite o *preço* (apenas números):
Exemplo: 30.00 ou 50`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'product_back_name' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]
        ]
      }
    });
  });

  bot.action('product_back_description', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.step = 'description';
    return ctx.reply(`✅ Preço: *R$ ${session.data.price.toFixed(2)}*

*Passo 3/4:* Digite uma *descrição*:
Exemplo: Acesso completo ao conteúdo premium`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏭️ Pular', callback_data: 'product_skip_description' }
          ],
          [
            { text: '⬅️ Voltar', callback_data: 'product_back_price' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]
        ]
      }
    });
  });

  bot.action('product_skip_description', async (ctx) => {
    await ctx.answerCbQuery('⏭️ Pulando descrição...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.data.description = null;
    session.step = 'url';
    
    return ctx.reply(`⏭️ *Descrição pulada!*

*Passo 4/4:* Envie a *URL de entrega* ou envie um *arquivo*:

📎 *Arquivo:* Envie um arquivo (ZIP, PDF, etc.)
🔗 *Link:* Digite a URL (Google Drive, Mega, etc.)`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏭️ Pular', callback_data: 'product_skip_url' }
          ],
          [
            { text: '⬅️ Voltar', callback_data: 'product_back_description' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]
        ]
      }
    });
  });

  bot.action('product_skip_url', async (ctx) => {
    await ctx.answerCbQuery('⏭️ Finalizando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.data.deliveryUrl = null;
    session.data.deliveryType = 'link';
    
    // Gerar ID do produto
    const productId = session.data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    
    session.data.productId = productId;
    
    // Criar produto
    try {
      await db.createProduct({
        productId: session.data.productId,
        name: session.data.name,
        description: session.data.description || null,
        price: session.data.price,
        deliveryType: session.data.deliveryType,
        deliveryUrl: session.data.deliveryUrl || null
      });
      
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.reply(`🎉 *PRODUTO CRIADO COM SUCESSO!*

🛍️ *Nome:* ${session.data.name}
🆔 *ID:* ${session.data.productId}
💰 *Preço:* R$ ${session.data.price.toFixed(2)}
📝 *Descrição:* ${session.data.description || 'Nenhuma'}
🔗 *URL:* Não configurada

⚠️ *Lembre-se de configurar a URL de entrega depois!*

O produto já está disponível no menu de compras!
Use /produtos para ver todos.`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      delete global._SESSIONS[ctx.from.id];
      console.error('Erro ao criar produto:', err);
      return ctx.reply('❌ Erro ao criar produto. Tente novamente.');
    }
  });

  // ===== HANDLERS DE NAVEGAÇÃO PARA CRIAR GRUPO =====
  
  bot.action('cancel_create_group', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    return ctx.reply('❌ Operação cancelada.');
  });

  bot.action('group_back_id', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'group_id';
    return ctx.reply(`➕ *CADASTRAR NOVO GRUPO*

*Passo 1/5:* Envie o *ID do grupo*

📝 *Como obter o ID:*
1. Adicione o bot @userinfobot ao grupo
2. Copie o ID que aparece (ex: -1001234567890)
3. Cole aqui`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
        ]]
      }
    });
  });

  bot.action('group_back_name', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'group_name';
    return ctx.reply(`✅ ID: *${session.data.groupId}*

*Passo 2/5:* Digite o *nome do grupo*:

Exemplo: Grupo Premium VIP`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'group_back_id' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
          ]
        ]
      }
    });
  });

  bot.action('group_back_link', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'group_link';
    return ctx.reply(`✅ Nome: *${session.data.groupName}*

*Passo 3/5:* Envie o *link do grupo*:

Exemplo: https://t.me/seugrupo`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'group_back_name' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
          ]
        ]
      }
    });
  });

  bot.action('group_back_price', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'price';
    return ctx.reply(`✅ Link: *${session.data.groupLink}*

*Passo 4/5:* Digite o *preço da assinatura* (mensal):

Exemplo: 30.00 ou 50`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'group_back_link' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
          ]
        ]
      }
    });
  });

}

module.exports = { registerApprovalHandlers };
