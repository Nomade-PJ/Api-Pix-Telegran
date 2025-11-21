// src/bot.js
const { Telegraf, Markup } = require('telegraf');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');
const db = require('./database');
const admin = require('./admin');
const proofAnalyzer = require('./proofAnalyzer');

function createBot(token) {
  const bot = new Telegraf(token);

  // Registrar handler do /start PRIMEIRO (antes dos comandos admin)
  bot.start(async (ctx) => {
    try {
      // Paralelizar queries (OTIMIZAÇÃO #4)
      const [user, products, groups] = await Promise.all([
        db.getOrCreateUser(ctx.from),
        db.getAllProducts(),
        db.getAllGroups()
      ]);
      
      if (products.length === 0 && groups.length === 0) {
        return ctx.reply('🚧 Nenhum produto ou grupo disponível no momento. Volte mais tarde!');
      }
      
      // Gerar botões dinamicamente (sem logs pesados)
      const buttons = products.map(product => {
        const emoji = parseFloat(product.price) >= 50 ? '💎' : '🛍️';
        const buttonText = `${emoji} ${product.name} (R$${parseFloat(product.price).toFixed(2)})`;
        return [Markup.button.callback(buttonText, `buy:${product.product_id}`)];
      });
      
      // Adicionar botão de grupo se houver grupos ativos
      const activeGroups = groups.filter(g => g.is_active);
      if (activeGroups.length > 0) {
        const group = activeGroups[0]; // Usar o primeiro grupo ativo
        buttons.push([Markup.button.callback(`👥 Entrar no grupo (R$${parseFloat(group.subscription_price).toFixed(2)}/mês)`, `subscribe:${group.group_id}`)]);
      }
      
      const text = `👋 Olá! Bem-vindo ao Bot da Val 🌶️🔥\n\nEscolha uma opção abaixo:`;
      
      return await ctx.reply(text, Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('Erro no /start:', err.message);
      return ctx.reply('❌ Erro ao carregar menu. Tente novamente.');
    }
  });

  // Registrar comandos admin DEPOIS do /start
  admin.registerAdminCommands(bot);

  bot.action(/buy:(.+)/, async (ctx) => {
    try {
      const productId = ctx.match[1];
      
      // OTIMIZAÇÃO #1: Responder imediatamente ao clique (feedback visual instantâneo)
      await ctx.answerCbQuery('⏳ Gerando cobrança PIX...');
      
      // OTIMIZAÇÃO #4: Paralelizar busca de produto e usuário
      const [product, user] = await Promise.all([
        db.getProduct(productId),
        db.getOrCreateUser(ctx.from)
      ]);
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      const amount = product.price.toString();

      // Gerar cobrança PIX e salvar transação em paralelo
      const resp = await manualPix.createManualCharge({ amount, productId });
      const charge = resp.charge;
      const txid = charge.txid;
      
      // Salvar no banco (não precisa aguardar para enviar QR Code)
      db.createTransaction({
        txid,
        userId: user.id,
        telegramId: ctx.chat.id,
        productId,
        amount,
        pixKey: charge.key,
        pixPayload: charge.copiaCola
      }).catch(err => console.error('Erro ao salvar transação:', err));

      // Calcular tempo de expiração (30 minutos)
      const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
      const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      // Agendar lembretes de pagamento
      // Lembrete aos 15 minutos (15 minutos restantes)
      setTimeout(async () => {
        try {
          const trans = await db.getTransactionByTxid(txid);
          // Verificar se ainda está pendente e não paga
          if (trans && trans.status === 'pending') {
            await ctx.telegram.sendMessage(ctx.chat.id, `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Faltam 15 minutos* para expirar!

💰 Valor: R$ ${amount}
🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

⏰ *Expira às:* ${expirationStr}

📸 Após pagar, envie o comprovante.

🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
          }
        } catch (err) {
          console.error('Erro no lembrete 15 min:', err);
        }
      }, 15 * 60 * 1000); // 15 minutos
      
      // Aviso de expiração e cancelamento automático aos 30 minutos
      setTimeout(async () => {
        try {
          const trans = await db.getTransactionByTxid(txid);
          // Se ainda está pendente, cancelar
          if (trans && trans.status === 'pending') {
            await db.cancelTransaction(txid);
            
            await ctx.telegram.sendMessage(ctx.chat.id, `⏰ *TRANSAÇÃO EXPIRADA*

❌ O prazo de 30 minutos foi atingido.
Esta transação foi cancelada automaticamente.

🔄 *Para comprar novamente:*
1. Use o comando /start
2. Selecione o produto desejado
3. Realize o pagamento em até 30 minutos
4. Envie o comprovante

💰 Valor: R$ ${amount}
🆔 TXID cancelado: ${txid}`, { parse_mode: 'Markdown' });
          }
        } catch (err) {
          console.error('Erro no cancelamento automático:', err);
        }
      }, 30 * 60 * 1000); // 30 minutos
      
      // Enviar QR Code imediatamente
      if (charge.qrcodeBuffer) {
        return await ctx.replyWithPhoto(
          { source: charge.qrcodeBuffer },
          {
            caption: `💰 Pague R$ ${amount} usando PIX

🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento

📸 Após pagar, envie o comprovante (foto) aqui.

🆔 TXID: ${txid}`,
            parse_mode: 'Markdown'
          }
        );
      } else {
        return await ctx.reply(`💰 Pague R$ ${amount} usando PIX

🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento

📸 Envie o comprovante quando pagar.

🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Erro na compra:', err.message);
      await ctx.reply('❌ Erro ao gerar cobrança. Tente novamente.');
    }
  });

  // 🆕 DEBUG: Log TODOS os tipos de mensagem
  bot.use(async (ctx, next) => {
    if (ctx.message) {
      console.log('📨 [BOT-USE] Mensagem recebida:', {
        message_id: ctx.message.message_id,
        from: ctx.from.id,
        text: ctx.message.text?.substring(0, 50) || 'N/A',
        photo: !!ctx.message.photo,
        document: !!ctx.message.document,
        video: !!ctx.message.video,
        audio: !!ctx.message.audio
      });
    }
    return next();
  });

  // Receber comprovante (foto ou documento)
  bot.on(['photo', 'document'], async (ctx) => {
    try {
      // 🆕 LOG INICIAL - CRÍTICO PARA DEBUG
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 [HANDLER] COMPROVANTE RECEBIDO!');
      console.log(`📋 [HANDLER] Tipo: ${ctx.message.photo ? 'PHOTO' : 'DOCUMENT'}`);
      console.log(`👤 [HANDLER] User: ${ctx.from.id} (@${ctx.from.username || 'N/A'})`);
      console.log(`📅 [HANDLER] Timestamp: ${new Date().toISOString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const transaction = await db.getLastPendingTransaction(ctx.chat.id);
      
      if (!transaction) {
        console.warn('⚠️ [HANDLER] Nenhuma transação pendente encontrada');
        return ctx.reply('❌ Não localizei uma cobrança pendente.\n\nSe acabou de pagar, aguarde alguns segundos e tente novamente.');
      }
      
      console.log(`✅ [HANDLER] Transação encontrada: ${transaction.txid}`);

      // Verificar se a transação está expirada (30 minutos)
      const createdAt = new Date(transaction.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / (1000 * 60);
      
      if (diffMinutes > 30) {
        // Cancelar transação expirada
        await db.cancelTransaction(transaction.txid);
        
        return ctx.reply(`⏰ *Transação expirada!*

❌ Esta transação ultrapassou o prazo de 30 minutos para pagamento.

🔄 *Para comprar novamente:*
1. Use o comando /start
2. Selecione o produto desejado
3. Realize o pagamento em até 30 minutos
4. Envie o comprovante

🆔 Transação expirada: ${transaction.txid}`, {
          parse_mode: 'Markdown'
        });
      }

      const fileId = ctx.message.photo 
        ? ctx.message.photo.slice(-1)[0].file_id 
        : (ctx.message.document?.file_id || null);
      
      if (!fileId) {
        console.error('❌ [HANDLER] FileId não encontrado');
        return ctx.reply('❌ Erro ao processar comprovante. Envie uma foto ou documento válido.');
      }

      console.log(`📎 [HANDLER] FileId: ${fileId.substring(0, 30)}...`);

      // Calcular tempo restante
      const minutesElapsed = Math.floor(diffMinutes);
      const minutesRemaining = 30 - minutesElapsed;

      console.log(`⏰ [HANDLER] Tempo decorrido: ${minutesElapsed} minutos (${minutesRemaining} minutos restantes)`);

      // 🆕 OTIMIZAÇÃO CRÍTICA: SALVAR NO BANCO PRIMEIRO (NÃO BLOQUEAR)
      console.log(`💾 [HANDLER] Salvando comprovante no banco IMEDIATAMENTE...`);
      
      try {
        const saveResult = await db.updateTransactionProof(transaction.txid, fileId);
        console.log(`✅ [HANDLER] Comprovante salvo no banco: ${saveResult ? 'Sucesso' : 'Falha'}`);
      } catch (saveErr) {
        console.error(`❌ [HANDLER] Erro ao salvar comprovante:`, saveErr.message);
        // Continuar mesmo com erro - notificar admin é mais importante
      }
      
      // 🆕 RESPOSTA IMEDIATA AO USUÁRIO (NÃO ESPERAR ANÁLISE)
      console.log(`💬 [HANDLER] Enviando confirmação ao usuário...`);
      const userResponsePromise = ctx.reply('✅ *Comprovante recebido!*\n\n⏳ Um admin irá validar em breve.\n\n🆔 TXID: ' + transaction.txid, { 
        parse_mode: 'Markdown' 
      }).catch(err => console.error('❌ Erro ao enviar confirmação:', err.message));
      
      // 🆕 DETECÇÃO MELHORADA DE TIPO DE ARQUIVO (PDF vs Imagem)
      let fileUrl = null;
      let fileType = 'image'; // 'image' ou 'pdf'
      let fileExtension = '';
      
      try {
        const file = await ctx.telegram.getFile(fileId);
        fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        
        // Detectar tipo de arquivo (PDF ou imagem) - múltiplos critérios
        if (ctx.message.document) {
          const mimeType = (ctx.message.document.mime_type || '').toLowerCase();
          const fileName = (ctx.message.document.file_name || '').toLowerCase();
          const filePath = (file.file_path || '').toLowerCase();
          
          // Extrair extensão do arquivo
          if (fileName) {
            const parts = fileName.split('.');
            fileExtension = parts.length > 1 ? parts[parts.length - 1] : '';
          } else if (filePath) {
            const parts = filePath.split('.');
            fileExtension = parts.length > 1 ? parts[parts.length - 1] : '';
          }
          
          // 🔍 VERIFICAÇÃO ROBUSTA: Verificar se é PDF por múltiplos critérios
          const isPDF = (
            mimeType === 'application/pdf' ||
            mimeType.includes('pdf') ||
            fileName.endsWith('.pdf') ||
            filePath.includes('.pdf') ||
            fileExtension === 'pdf'
          );
          
          if (isPDF) {
            fileType = 'pdf';
            console.log('📄 PDF DETECTADO:', { 
              mimeType, 
              fileName, 
              filePath, 
              fileExtension,
              fileSize: ctx.message.document.file_size 
            });
          } else {
            // Se não é PDF, verificar se é imagem
            const isImage = (
              mimeType.startsWith('image/') ||
              ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)
            );
            
            if (isImage) {
              fileType = 'image';
              console.log('🖼️ IMAGEM DETECTADA (documento):', { 
                mimeType, 
                fileName, 
                fileExtension 
              });
            } else {
              console.warn('⚠️ TIPO DE ARQUIVO DESCONHECIDO:', { 
                mimeType, 
                fileName, 
                fileExtension 
              });
              // Assumir imagem como fallback
              fileType = 'image';
            }
          }
        } else if (ctx.message.photo) {
          // Se for foto (não documento), sempre é imagem
          fileType = 'image';
          console.log('📷 FOTO DETECTADA (photo)');
        }
        
        console.log(`✅ [HANDLER] Tipo de arquivo determinado: ${fileType.toUpperCase()}`);
      } catch (err) {
        console.error('❌ [HANDLER] Erro ao obter URL do arquivo:', err.message);
        console.error('Stack:', err.stack);
      }
      
      // 🆕 NOTIFICAR ADMIN IMEDIATAMENTE (ANTES DE QUALQUER ANÁLISE)
      // Isso garante que o admin SEMPRE receba o comprovante, mesmo se a análise falhar ou der timeout
      console.log(`📤 [HANDLER] NOTIFICANDO ADMIN IMEDIATAMENTE (sem esperar análise)...`);
      
      // 🆕 FUNÇÃO PARA NOTIFICAR ADMINS COM COMPROVANTE (suporta imagens e PDFs)
      // IMPORTANTE: Esta função DEVE ser chamada em TODOS os casos (aprovado, rejeitado, pendente, erro)
      const notifyAdmins = async (status, analysisData = null) => {
        try {
          console.log(`📤 [NOTIFY] Iniciando notificação - Status: ${status}, FileType: ${fileType}`);
          console.log(`📤 [NOTIFY] FileId: ${fileId?.substring(0, 30)}...`);
          console.log(`📤 [NOTIFY] TXID: ${transaction.txid}`);
          
          const admins = await db.getAllAdmins();
          console.log(`👥 [NOTIFY] Admins encontrados: ${admins.length}`);
          
          if (admins.length === 0) {
            console.warn('⚠️ [NOTIFY] Nenhum admin encontrado para notificar');
            return;
          }
          
          const product = await db.getProduct(transaction.product_id);
          const productName = product ? product.name : transaction.product_id;
          
          const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⚠️';
          const statusText = status === 'approved' ? 'APROVADO AUTOMATICAMENTE' : status === 'rejected' ? 'REJEITADO' : 'PENDENTE DE VALIDAÇÃO';
          
          // 🆕 INCLUIR TIPO DE ARQUIVO CLARAMENTE NA MENSAGEM
          const fileTypeEmoji = fileType === 'pdf' ? '📄' : '🖼️';
          const fileTypeText = fileType === 'pdf' ? 'PDF' : 'Imagem';
          
          const caption = `${statusEmoji} *COMPROVANTE RECEBIDO - ${statusText}*

${analysisData ? `🤖 Análise automática: ${analysisData.confidence}% de confiança\n` : ''}💰 Valor: R$ ${transaction.amount}
👤 Usuário: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})
🆔 ID Usuário: ${ctx.from.id}
📦 Produto: ${productName}
${fileTypeEmoji} Tipo: *${fileTypeText}*
📅 Enviado: ${new Date().toLocaleString('pt-BR')}

🆔 TXID: ${transaction.txid}`;
          
          // 🆕 BOTÕES PARA TODOS OS STATUS (pending e rejected) - admin pode revisar
          const replyMarkup = (status === 'pending' || status === 'rejected') ? {
            inline_keyboard: [
              [
                { text: '✅ Aprovar', callback_data: `approve_${transaction.txid}` },
                { text: '❌ Rejeitar', callback_data: `reject_${transaction.txid}` }
              ],
              [
                { text: '📋 Ver detalhes', callback_data: `details_${transaction.txid}` }
              ]
            ]
          } : undefined;
          
          console.log(`📋 [NOTIFY] Preparando envio: Tipo=${fileTypeText}, Botões=${replyMarkup ? 'Sim' : 'Não'}`);
          console.log(`📋 [NOTIFY] Caption (primeiros 100 chars): ${caption.substring(0, 100)}...`);
          
          let successCount = 0;
          let failureCount = 0;
          
          for (const admin of admins) {
            try {
              console.log(`📨 [NOTIFY] Enviando para admin ${admin.telegram_id} (${admin.first_name || admin.username || 'N/A'})...`);
              
              // 🆕 MÉTODO CORRETO: sendDocument para PDFs, sendPhoto para imagens
              if (fileType === 'pdf') {
                console.log(`📄 [NOTIFY] Usando sendDocument (PDF) para admin ${admin.telegram_id}`);
                await ctx.telegram.sendDocument(admin.telegram_id, fileId, {
                  caption: caption,
                  parse_mode: 'Markdown',
                  reply_markup: replyMarkup
                });
                console.log(`✅ [NOTIFY] PDF enviado com sucesso para admin ${admin.telegram_id}`);
              } else {
                console.log(`🖼️ [NOTIFY] Usando sendPhoto (Imagem) para admin ${admin.telegram_id}`);
                await ctx.telegram.sendPhoto(admin.telegram_id, fileId, {
                  caption: caption,
                  parse_mode: 'Markdown',
                  reply_markup: replyMarkup
                });
                console.log(`✅ [NOTIFY] Imagem enviada com sucesso para admin ${admin.telegram_id}`);
              }
              
              successCount++;
            } catch (err) {
              failureCount++;
              console.error(`❌ [NOTIFY] Erro ao notificar admin ${admin.telegram_id}:`, err.message);
              console.error(`❌ [NOTIFY] Erro completo:`, err);
              
              // 🆕 MÉTODO ALTERNATIVO: Enviar mensagem separada do arquivo
              try {
                console.log(`🔄 [NOTIFY] Tentando método alternativo (mensagem + arquivo séparados) para admin ${admin.telegram_id}...`);
                
                // Enviar mensagem com botões primeiro
                await ctx.telegram.sendMessage(admin.telegram_id, caption, {
                  parse_mode: 'Markdown',
                  reply_markup: replyMarkup
                });
                
                // Depois enviar arquivo separadamente
                if (fileType === 'pdf') {
                  await ctx.telegram.sendDocument(admin.telegram_id, fileId, {
                    caption: `📄 Comprovante em PDF - TXID: ${transaction.txid}`
                  });
                } else {
                  await ctx.telegram.sendPhoto(admin.telegram_id, fileId, {
                    caption: `🖼️ Comprovante em imagem - TXID: ${transaction.txid}`
                  });
                }
                
                console.log(`✅ [NOTIFY] Método alternativo funcionou para admin ${admin.telegram_id}`);
                successCount++;
                failureCount--;
              } catch (fallbackErr) {
                console.error(`❌ [NOTIFY] Erro no fallback para admin ${admin.telegram_id}:`, fallbackErr.message);
                console.error(`❌ [NOTIFY] Stack:`, fallbackErr.stack);
              }
            }
          }
          
          console.log(`✅ [NOTIFY] Notificação concluída: ${successCount} sucesso(s), ${failureCount} falha(s) de ${admins.length} admin(s)`);
        } catch (err) {
          console.error('❌ [NOTIFY] Erro crítico ao buscar admins:', err.message);
          console.error('Stack:', err.stack);
        }
      };
      
      // 🆕 CHAMAR NOTIFICAÇÃO IMEDIATAMENTE (SEM ESPERAR ANÁLISE)
      console.log(`📤 [HANDLER] Chamando notifyAdmins AGORA...`);
      
      try {
        await notifyAdmins('pending', null);
        console.log(`✅ [HANDLER] Admin notificado com sucesso!`);
      } catch (notifyErr) {
        console.error(`❌ [HANDLER] Erro ao notificar admin:`, notifyErr.message);
        console.error('Stack:', notifyErr.stack);
        
        // 🆕 MÉTODO ALTERNATIVO se falhar
        try {
          console.log(`🔄 [HANDLER] Tentando método alternativo...`);
          // Aguardar 1 segundo e tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000));
          await notifyAdmins('pending', null);
          console.log(`✅ [HANDLER] Admin notificado na segunda tentativa!`);
        } catch (retryErr) {
          console.error(`❌ [HANDLER] Erro na segunda tentativa:`, retryErr.message);
        }
      }
      
      console.log(`✅ [HANDLER] Processo concluído com sucesso!`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 🆕 REMOVER TODO O CÓDIGO DE ANÁLISE AUTOMÁTICA
      // Análise será feita manualmente pelo admin
      // O código abaixo NÃO será mais executado
      
      /*
      // =======================================================
      // 🔥 CÓDIGO ANTIGO DE ANÁLISE AUTOMÁTICA REMOVIDO
      // =======================================================
      // Agora o fluxo é mais simples e rápido:
      // 1. Salva no banco ✅
      // 2. Responde ao usuário ✅  
      // 3. Detecta tipo de arquivo ✅
      // 4. Notifica admin IMEDIATAMENTE ✅
      // 5. FIM! ✅
      // 
      // Admin faz validação manual clicando em Aprovar/Rejeitar
      // =======================================================
      
      if (analysis && analysis.isValid === true && analysis.confidence >= 80) {
        // ✅ APROVAÇÃO AUTOMÁTICA
        try {
          await db.validateTransaction(transaction.txid, transaction.user_id);
          
          // 🆕 NOTIFICAR ADMIN (mesmo sendo aprovado automaticamente)
          await notifyAdmins('approved', analysis);
          
          // Verificar se é assinatura de grupo
          if (transaction.product_id && transaction.product_id.startsWith('group_')) {
            const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
            const group = await db.getGroupById(groupTelegramId);
            
            if (group) {
              // Adicionar membro ao grupo (groupId é o UUID da tabela groups)
              await db.addGroupMember({
                telegramId: ctx.chat.id,
                userId: transaction.user_id,
                groupId: group.id, // UUID da tabela groups
                days: group.subscription_days
              });
              
              // Adicionar ao grupo do Telegram
              try {
                await ctx.telegram.unbanChatMember(group.group_id, ctx.chat.id, { only_if_banned: true });
                await ctx.telegram.sendMessage(ctx.chat.id, `✅ *ASSINATURA APROVADA AUTOMATICAMENTE!*

🤖 Análise de IA: ${analysis.confidence}% de confiança
💰 Valor confirmado: ${analysis.details.amount || transaction.amount}

👥 *Grupo:* ${group.group_name}
📅 *Acesso válido por:* ${group.subscription_days} dias
🔗 *Link:* ${group.group_link}

✅ Você foi adicionado ao grupo!

🆔 TXID: ${transaction.txid}`, {
                  parse_mode: 'Markdown'
                });
              } catch (err) {
                console.error('Erro ao adicionar ao grupo:', err);
                await ctx.reply(`✅ *PAGAMENTO APROVADO!*

⚠️ Erro ao adicionar ao grupo automaticamente.
Entre manualmente: ${group.group_link}

🆔 TXID: ${transaction.txid}`, {
                  parse_mode: 'Markdown'
                });
              }
              
              await db.markAsDelivered(transaction.txid);
              return;
            }
          }
          
          // Entregar produto normal
          const product = await db.getProduct(transaction.product_id);
          if (product && product.delivery_url) {
            await deliver.deliverByLink(ctx.chat.id, product.delivery_url, `✅ *Produto entregue!*\n\n${product.delivery_url}`);
          }
          
          await db.markAsDelivered(transaction.txid);
          
          return ctx.reply(`✅ *PAGAMENTO APROVADO AUTOMATICAMENTE!*

🤖 Análise de IA: ${analysis.confidence}% de confiança
💰 Valor confirmado: ${analysis.details.amount || transaction.amount}
✅ Produto entregue com sucesso!

🆔 TXID: ${transaction.txid}`, {
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Erro ao aprovar automaticamente:', err);
        }
      } else if (analysis && analysis.isValid === false) {
        // ❌ REJEIÇÃO AUTOMÁTICA
        console.log('❌ Comprovante rejeitado automaticamente');
        await db.cancelTransaction(transaction.txid);
        
        // 🆕 NOTIFICAR ADMIN (mesmo sendo rejeitado automaticamente)
        await notifyAdmins('rejected', analysis);
        
        return ctx.reply(`❌ *COMPROVANTE INVÁLIDO*

🤖 Análise automática detectou problemas:
${analysis.details.reason || 'Comprovante não corresponde ao pagamento esperado'}

🔄 *O que fazer:*
1. Verifique se pagou o valor correto (R$ ${transaction.amount})
2. Verifique se pagou para a chave correta
3. Tente enviar outro comprovante
4. Ou faça uma nova compra: /start

🆔 TXID: ${transaction.txid}`, {
          parse_mode: 'Markdown'
        });
      } else {
        // ⚠️ VALIDAÇÃO MANUAL NECESSÁRIA (análise não disponível, falhou, ou confiança baixa)
        console.log('⚠️ Comprovante enviado para validação manual');
        console.log('📊 Estado da análise:', { 
          hasAnalysis: !!analysis, 
          hasError: !!analysisError,
          isValid: analysis?.isValid,
          confidence: analysis?.confidence,
          method: analysis?.details?.method
        });
        
        // 🆕 GARANTIR QUE COMPROVANTE SEJA SALVO NO BANCO
        try {
          const updateResult = await db.updateTransactionProof(transaction.txid, fileId);
          console.log('✅ Comprovante salvo no banco:', transaction.txid, 'Resultado:', updateResult);
        } catch (updateErr) {
          console.error('❌ Erro ao salvar comprovante:', updateErr.message);
          console.error('Stack:', updateErr.stack);
          // Tentar novamente
          try {
            await db.updateTransactionProof(transaction.txid, fileId);
            console.log('✅ Comprovante salvo na segunda tentativa');
          } catch (retryErr) {
            console.error('❌ Erro ao salvar comprovante (retry):', retryErr.message);
          }
        }
        
        // 🆕 MENSAGEM PARA O USUÁRIO (com informação sobre tipo de arquivo)
        const fileTypeEmoji = fileType === 'pdf' ? '📄' : '🖼️';
        const fileTypeText = fileType === 'pdf' ? 'PDF' : 'Imagem';
        
        let userMessage = `${fileTypeEmoji} *Comprovante ${fileTypeText} recebido!*\n\n`;
        
        if (analysis) {
          userMessage += `🤖 A análise automática precisa de confirmação manual.\n📊 Confiança da IA: ${analysis.confidence || 0}%\n\n`;
          if (analysis.details?.method) {
            userMessage += `🔧 Método: ${analysis.details.method}\n\n`;
          }
          if (analysis.details?.error) {
            userMessage += `⚠️ Erro na análise: ${analysis.details.error}\n\n`;
          }
        } else if (analysisError) {
          userMessage += `🤖 Análise automática não pôde ser concluída.\n`;
          if (fileType === 'pdf') {
            userMessage += `📄 *PDFs* precisam de validação manual.\n`;
          }
          userMessage += `⚠️ Erro: ${analysisError.message}\n\n`;
          console.error('📋 Detalhes do erro de análise:', {
            message: analysisError.message,
            stack: analysisError.stack
          });
        } else {
          userMessage += `🤖 Análise automática não disponível ou falhou.\n`;
          if (fileType === 'pdf') {
            userMessage += `📄 *PDFs* serão validados manualmente pelo administrador.\n`;
          }
          userMessage += `\n`;
        }
        
        userMessage += `⏳ Um admin irá validar em breve.\n\n🆔 TXID: ${transaction.txid}`;
        
        try {
          await ctx.reply(userMessage, {
            parse_mode: 'Markdown'
          });
          console.log(`✅ Mensagem enviada ao usuário sobre status do comprovante ${fileTypeText}`);
        } catch (err) {
          console.error('❌ Erro ao enviar mensagem ao usuário:', err.message);
          console.error('Stack:', err.stack);
        }
        
        // 🆕 NOTIFICAR ADMIN (validação manual necessária) - SEMPRE notificar, mesmo sem análise
        // CRÍTICO: Esta notificação DEVE funcionar sempre, mesmo se tudo mais falhar
        console.log('📤 Notificando admins (CRÍTICO - deve sempre funcionar)...');
        
        let notificationSuccess = false;
        let lastError = null;
        
        // Tentar notificar até 3 vezes
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`🔄 Tentativa ${attempt}/3 de notificar admins...`);
            await notifyAdmins('pending', analysis);
            console.log(`✅ Admins notificados com sucesso na tentativa ${attempt}`);
            notificationSuccess = true;
            break;
          } catch (notifyErr) {
            lastError = notifyErr;
            console.error(`❌ Erro na tentativa ${attempt} de notificar admins:`, notifyErr.message);
            console.error('Stack:', notifyErr.stack);
            
            // Aguardar antes de tentar novamente (exceto na última tentativa)
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 1s, 2s
            }
          }
        }
        
        // 🆕 MÉTODO ALTERNATIVO MELHORADO - Se todas as tentativas falharam
        if (!notificationSuccess) {
          console.error('❌ [FALLBACK] Todas as tentativas de notificação falharam, tentando método alternativo...');
          try {
            const admins = await db.getAllAdmins();
            const product = await db.getProduct(transaction.product_id);
            const productName = product ? product.name : transaction.product_id;
            
            const fileTypeEmoji = fileType === 'pdf' ? '📄' : '🖼️';
            const fileTypeText = fileType === 'pdf' ? 'PDF' : 'Imagem';
            
            for (const admin of admins) {
              try {
                console.log(`🔄 [FALLBACK] Tentando método alternativo para admin ${admin.telegram_id}...`);
                
                // Enviar mensagem simples primeiro com botões
                await ctx.telegram.sendMessage(admin.telegram_id, 
                  `⚠️ *COMPROVANTE RECEBIDO - VALIDAÇÃO MANUAL NECESSÁRIA*

💰 Valor: R$ ${transaction.amount}
👤 Usuário: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})
🆔 ID Usuário: ${ctx.from.id}
📦 Produto: ${productName}
${fileTypeEmoji} Tipo: *${fileTypeText}*
📅 Enviado: ${new Date().toLocaleString('pt-BR')}

🆔 TXID: ${transaction.txid}

⚠️ *Arquivo sendo enviado separadamente...*`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: '✅ Aprovar', callback_data: `approve_${transaction.txid}` },
                          { text: '❌ Rejeitar', callback_data: `reject_${transaction.txid}` }
                        ],
                        [
                          { text: '📋 Ver detalhes', callback_data: `details_${transaction.txid}` }
                        ]
                      ]
                    }
                  });
                
                console.log(`✅ [FALLBACK] Mensagem enviada para admin ${admin.telegram_id}`);
                
                // Aguardar um pouco antes de enviar o arquivo
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Tentar enviar arquivo separadamente
                if (fileType === 'pdf') {
                  console.log(`📄 [FALLBACK] Enviando PDF para admin ${admin.telegram_id}...`);
                  await ctx.telegram.sendDocument(admin.telegram_id, fileId, {
                    caption: `📄 Comprovante PDF - TXID: ${transaction.txid}`
                  });
                  console.log(`✅ [FALLBACK] PDF enviado para admin ${admin.telegram_id}`);
                } else {
                  console.log(`🖼️ [FALLBACK] Enviando imagem para admin ${admin.telegram_id}...`);
                  await ctx.telegram.sendPhoto(admin.telegram_id, fileId, {
                    caption: `🖼️ Comprovante - TXID: ${transaction.txid}`
                  });
                  console.log(`✅ [FALLBACK] Imagem enviada para admin ${admin.telegram_id}`);
                }
                
                console.log(`✅ [FALLBACK] Método alternativo funcionou completamente para admin ${admin.telegram_id}`);
              } catch (altErr) {
                console.error(`❌ [FALLBACK] Erro no método alternativo para admin ${admin.telegram_id}:`, altErr.message);
                console.error(`❌ [FALLBACK] Stack:`, altErr.stack);
              }
            }
          } catch (altErr) {
            console.error('❌ [FALLBACK] Erro crítico no método alternativo:', altErr.message);
            console.error('Stack:', altErr.stack);
          }
        }
      }
      */
      // =======================================================
      // FIM DO CÓDIGO ANTIGO REMOVIDO
      // =======================================================
      
    } catch (err) {
      console.error('❌ [HANDLER] Erro crítico ao receber comprovante:', err.message);
      console.error('Stack:', err.stack);
      
      // 🆕 NOTIFICAÇÃO SIMPLES EM CASO DE ERRO
      try {
        await ctx.reply(`❌ *Erro ao processar comprovante*

Ocorreu um erro inesperado, mas seu comprovante foi salvo.
Um administrador irá validar manualmente.

🔄 Tente novamente ou aguarde a validação.`, {
          parse_mode: 'Markdown'
        });
      } catch (replyErr) {
        console.error('❌ [HANDLER] Erro ao enviar mensagem de erro:', replyErr.message);
      }
    }
  });

  // Endpoint auxiliar para trigger delivery via HTTP (usado por operador/n8n)
  // NOTA: a chamada para envio final será feita via api/trigger-delivery.js
  // ===== ASSINATURA DE GRUPO =====
  bot.action(/subscribe:(.+)/, async (ctx) => {
    try {
      const groupId = parseInt(ctx.match[1]);
      
      await ctx.answerCbQuery('⏳ Gerando cobrança PIX...');
      
      const group = await db.getGroupById(groupId);
      
      if (!group || !group.is_active) {
        return ctx.reply('❌ Grupo não encontrado ou inativo.');
      }
      
      // Verificar se já é membro ativo
      const existingMember = await db.getGroupMember(ctx.from.id, group.id);
      if (existingMember) {
        const expiresAt = new Date(existingMember.expires_at);
        const now = new Date();
        if (expiresAt > now) {
          return ctx.reply(`✅ *Você já é membro!*

👥 Grupo: ${group.group_name}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}

🔗 Acesse: ${group.group_link}`, {
            parse_mode: 'Markdown'
          });
        }
      }
      
      const [user] = await Promise.all([
        db.getOrCreateUser(ctx.from)
      ]);
      
      const amount = group.subscription_price.toString();
      const productId = `group_${group.group_id}`;
      
      // Gerar cobrança PIX
      const resp = await manualPix.createManualCharge({ amount, productId });
      const charge = resp.charge;
      const txid = charge.txid;
      
      // Salvar transação com referência ao grupo
      await db.createTransaction({
        txid,
        userId: user.id,
        telegramId: ctx.chat.id,
        productId,
        amount,
        pixKey: charge.key,
        pixPayload: charge.copiaCola
      }).catch(err => console.error('Erro ao salvar transação:', err));
      
      // Calcular tempo de expiração (30 minutos)
      const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
      const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      // Enviar QR Code
      if (charge.qrcodeBuffer) {
        return await ctx.replyWithPhoto(
          { source: charge.qrcodeBuffer },
          {
            caption: `👥 *ASSINATURA DE GRUPO*

💰 Pague R$ ${amount} para acessar o grupo

🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento
📅 *Duração:* ${group.subscription_days} dias de acesso

📸 Após pagar, envie o comprovante (foto) aqui.

🆔 TXID: ${txid}`,
            parse_mode: 'Markdown'
          }
        );
      }
    } catch (err) {
      console.error('Erro na assinatura:', err.message);
      await ctx.reply('❌ Erro ao gerar cobrança. Tente novamente.');
    }
  });

  // ===== RENOVAR ASSINATURA =====
  bot.command('renovar', async (ctx) => {
    try {
      const user = await db.getOrCreateUser(ctx.from);
      const groups = await db.getAllGroups();
      const activeGroups = groups.filter(g => g.is_active);
      
      if (activeGroups.length === 0) {
        return ctx.reply('📦 Nenhum grupo disponível para renovação.');
      }
      
      // Verificar se tem assinatura ativa
      let hasActiveSubscription = false;
      for (const group of activeGroups) {
        const member = await db.getGroupMember(ctx.chat.id, group.id);
        if (member) {
          const expiresAt = new Date(member.expires_at);
          const now = new Date();
          if (expiresAt > now) {
            hasActiveSubscription = true;
            const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            return ctx.reply(`✅ *Você já tem assinatura ativa!*

👥 Grupo: ${group.group_name}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}
⏰ Faltam: ${daysLeft} dias

🔗 Acesse: ${group.group_link}`, {
              parse_mode: 'Markdown'
            });
          }
        }
      }
      
      // Se não tem assinatura ativa, mostrar opção para renovar
      const group = activeGroups[0];
      return ctx.reply(`🔄 *RENOVAR ASSINATURA*

👥 Grupo: ${group.group_name}
💰 Preço: R$ ${group.subscription_price.toFixed(2)}/mês
📅 Duração: ${group.subscription_days} dias

Clique no botão abaixo para renovar:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `👥 Renovar Assinatura (R$${group.subscription_price.toFixed(2)})`, callback_data: `subscribe:${group.group_id}` }]
          ]
        }
      });
    } catch (err) {
      console.error('Erro no comando renovar:', err);
      return ctx.reply('❌ Erro ao processar renovação.');
    }
  });

  // Integrar controle de grupos
  const groupControl = require('./groupControl');
  groupControl.startGroupControl(bot);

  return bot;
}

module.exports = { createBot };

