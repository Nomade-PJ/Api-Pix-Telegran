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

  // Receber comprovante (foto ou documento)
  bot.on(['photo', 'document'], async (ctx) => {
    try {
      const transaction = await db.getLastPendingTransaction(ctx.chat.id);
      
      if (!transaction) {
        return ctx.reply('❌ Não localizei uma cobrança pendente.\n\nSe acabou de pagar, aguarde alguns segundos e tente novamente.');
      }

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
        return ctx.reply('❌ Erro ao processar comprovante. Envie uma foto ou documento válido.');
      }

      // Calcular tempo restante
      const minutesElapsed = Math.floor(diffMinutes);
      const minutesRemaining = 30 - minutesElapsed;

      // 🆕 ANÁLISE AUTOMÁTICA DE COMPROVANTE
      console.log(`📥 Comprovante recebido - Tipo: ${ctx.message.document ? 'documento' : 'foto'}, TXID: ${transaction.txid}`);
      await ctx.reply('🔍 *Analisando comprovante automaticamente...*', { parse_mode: 'Markdown' });
      
      // Salvar comprovante primeiro
      await db.updateTransactionProof(transaction.txid, fileId);
      
      // Obter URL do arquivo para análise (suporta imagens e PDFs)
      let fileUrl = null;
      let fileType = 'image'; // 'image' ou 'pdf'
      try {
        const file = await ctx.telegram.getFile(fileId);
        fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        
        // Detectar tipo de arquivo (PDF ou imagem)
        if (ctx.message.document) {
          const mimeType = (ctx.message.document.mime_type || '').toLowerCase();
          const fileName = (ctx.message.document.file_name || '').toLowerCase();
          const filePath = (file.file_path || '').toLowerCase();
          
          // Verificar se é PDF por múltiplos critérios
          if (mimeType.includes('pdf') || 
              fileName.endsWith('.pdf') || 
              filePath.includes('.pdf') ||
              mimeType === 'application/pdf') {
            fileType = 'pdf';
            console.log('📄 PDF detectado:', { mimeType, fileName, filePath });
          } else {
            console.log('🖼️ Imagem detectada:', { mimeType, fileName, filePath });
          }
        } else if (ctx.message.photo) {
          // Se for foto, já sabemos que é imagem
          fileType = 'image';
          console.log('📷 Foto detectada');
        }
      } catch (err) {
        console.error('Erro ao obter URL do arquivo:', err);
      }
      
      // Analisar com IA (se URL disponível) - suporta imagens e PDFs
      let analysis = null;
      let analysisError = null;
      
      if (fileUrl) {
        try {
          console.log(`🔍 Iniciando análise de ${fileType === 'pdf' ? 'PDF' : 'imagem'}...`);
          console.log(`📎 URL: ${fileUrl.substring(0, 100)}...`);
          
          // Timeout de 90 segundos para análise (PDFs podem demorar)
          const analysisPromise = proofAnalyzer.analyzeProof(
            fileUrl,
            transaction.amount,
            transaction.pix_key,
            fileType
          );
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na análise (90s)')), 90000)
          );
          
          analysis = await Promise.race([analysisPromise, timeoutPromise]);
          
          console.log(`📊 Análise concluída:`, {
            isValid: analysis?.isValid,
            confidence: analysis?.confidence,
            method: analysis?.details?.method
          });
        } catch (err) {
          analysisError = err;
          console.error('❌ Erro na análise automática:', err.message);
          console.error('Stack:', err.stack);
          // Continuar mesmo com erro - enviar para validação manual
        }
      } else {
        console.warn('⚠️ URL do arquivo não disponível para análise');
        analysisError = new Error('URL do arquivo não disponível');
      }
      
      // 🆕 FUNÇÃO PARA NOTIFICAR ADMINS COM COMPROVANTE (suporta imagens e PDFs)
      // IMPORTANTE: Esta função DEVE ser chamada em TODOS os casos (aprovado, rejeitado, pendente, erro)
      const notifyAdmins = async (status, analysisData = null) => {
        try {
          console.log(`📤 notifyAdmins chamado - Status: ${status}, FileType: ${fileType}, FileId: ${fileId?.substring(0, 20)}...`);
          
          const admins = await db.getAllAdmins();
          console.log(`👥 Admins encontrados: ${admins.length}`);
          
          if (admins.length === 0) {
            console.warn('⚠️ Nenhum admin encontrado para notificar');
            return;
          }
          
          const product = await db.getProduct(transaction.product_id);
          const productName = product ? product.name : transaction.product_id;
          
          const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⚠️';
          const statusText = status === 'approved' ? 'APROVADO AUTOMATICAMENTE' : status === 'rejected' ? 'REJEITADO' : 'PENDENTE DE VALIDAÇÃO';
          
          const caption = `${statusEmoji} *COMPROVANTE RECEBIDO - ${statusText}*

${analysisData ? `🤖 Análise automática: ${analysisData.confidence}% de confiança\n` : ''}💰 Valor: R$ ${transaction.amount}
👤 Usuário: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})
🆔 ID Usuário: ${ctx.from.id}
📦 Produto: ${productName}
📅 Enviado: ${new Date().toLocaleString('pt-BR')}
${fileType === 'pdf' ? '📄 Tipo: PDF\n' : '🖼️ Tipo: Imagem\n'}

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
          
          console.log(`📋 Preparando envio para ${admins.length} admin(s) - Tipo: ${fileType}, Botões: ${replyMarkup ? 'Sim' : 'Não'}`);
          
          for (const admin of admins) {
            try {
              console.log(`📨 Enviando para admin ${admin.telegram_id} (${admin.first_name || admin.username || 'N/A'})...`);
              
              // 🆕 USAR sendDocument PARA PDFs E sendPhoto PARA IMAGENS
              if (fileType === 'pdf') {
                console.log(`📄 Enviando PDF para admin ${admin.telegram_id}...`);
                await ctx.telegram.sendDocument(admin.telegram_id, fileId, {
                  caption: caption,
                  parse_mode: 'Markdown',
                  reply_markup: replyMarkup
                });
                console.log(`✅ PDF enviado para admin ${admin.telegram_id} - Status: ${status}`);
              } else {
                console.log(`🖼️ Enviando imagem para admin ${admin.telegram_id}...`);
                await ctx.telegram.sendPhoto(admin.telegram_id, fileId, {
                  caption: caption,
                  parse_mode: 'Markdown',
                  reply_markup: replyMarkup
                });
                console.log(`✅ Imagem enviada para admin ${admin.telegram_id} - Status: ${status}`);
              }
            } catch (err) {
              console.error(`❌ Erro ao notificar admin ${admin.telegram_id}:`, err.message);
              console.error('Stack:', err.stack);
              // Tentar método alternativo em caso de erro
              try {
                console.log(`🔄 Tentando método alternativo para admin ${admin.telegram_id}...`);
                if (fileType === 'pdf') {
                  await ctx.telegram.sendMessage(admin.telegram_id, `${caption}\n\n📄 *Arquivo PDF anexado*`, {
                    parse_mode: 'Markdown',
                    reply_markup: replyMarkup
                  });
                  await ctx.telegram.sendDocument(admin.telegram_id, fileId);
                  console.log(`✅ Método alternativo funcionou para admin ${admin.telegram_id}`);
                } else {
                  await ctx.telegram.sendMessage(admin.telegram_id, `${caption}\n\n🖼️ *Imagem anexada*`, {
                    parse_mode: 'Markdown',
                    reply_markup: replyMarkup
                  });
                  await ctx.telegram.sendPhoto(admin.telegram_id, fileId);
                  console.log(`✅ Método alternativo funcionou para admin ${admin.telegram_id}`);
                }
              } catch (fallbackErr) {
                console.error(`❌ Erro no fallback para admin ${admin.telegram_id}:`, fallbackErr.message);
                console.error('Stack:', fallbackErr.stack);
              }
            }
          }
          
          console.log(`✅ Processo de notificação concluído para ${admins.length} admin(s)`);
        } catch (err) {
          console.error('❌ Erro ao buscar admins:', err.message);
          console.error('Stack:', err.stack);
        }
      };
      
      // Processar resultado da análise
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
          confidence: analysis?.confidence 
        });
        
        // Atualizar status para proof_sent (se ainda não foi atualizado)
        try {
          await db.updateTransactionProof(transaction.txid, fileId);
          console.log('✅ Comprovante salvo no banco:', transaction.txid);
        } catch (updateErr) {
          console.error('❌ Erro ao salvar comprovante:', updateErr.message);
        }
        
        // Mensagem para o usuário
        let userMessage = `⚠️ *Comprovante recebido!*\n\n`;
        
        if (analysis) {
          userMessage += `🤖 A análise automática precisa de confirmação manual.\n📊 Confiança da IA: ${analysis.confidence || 0}%\n\n`;
          if (analysis.details?.method) {
            userMessage += `🔧 Método: ${analysis.details.method}\n\n`;
          }
        } else if (analysisError) {
          userMessage += `🤖 Análise automática não pôde ser concluída.\n⚠️ Erro: ${analysisError.message}\n\n`;
        } else {
          userMessage += `🤖 Análise automática não disponível ou falhou.\n\n`;
        }
        
        userMessage += `⏳ Um admin irá validar em breve.\n\n🆔 TXID: ${transaction.txid}`;
        
        try {
          await ctx.reply(userMessage, {
            parse_mode: 'Markdown'
          });
          console.log('✅ Mensagem enviada ao usuário');
        } catch (err) {
          console.error('❌ Erro ao enviar mensagem ao usuário:', err.message);
        }
        
        // 🆕 NOTIFICAR ADMIN (validação manual necessária) - SEMPRE notificar, mesmo sem análise
        console.log('📤 Notificando admins...');
        try {
          await notifyAdmins('pending', analysis);
          console.log('✅ Admins notificados com sucesso');
        } catch (notifyErr) {
          console.error('❌ Erro ao notificar admins:', notifyErr.message);
          console.error('Stack:', notifyErr.stack);
          // Tentar novamente sem análise
          try {
            console.log('🔄 Tentando notificar novamente sem dados de análise...');
            await notifyAdmins('pending', null);
            console.log('✅ Notificação de retry enviada');
          } catch (retryErr) {
            console.error('❌ Erro ao notificar admins (retry):', retryErr.message);
            console.error('Stack:', retryErr.stack);
          }
        }
      }
    } catch (err) {
      console.error('❌ Erro ao receber comprovante:', err.message);
      console.error('Stack:', err.stack);
      
      // Tentar notificar admin mesmo em caso de erro crítico
      try {
        const transaction = await db.getLastPendingTransaction(ctx.chat.id);
        if (transaction) {
          const fileId = ctx.message.photo 
            ? ctx.message.photo.slice(-1)[0].file_id 
            : (ctx.message.document?.file_id || null);
          
          if (fileId) {
            const notifyAdmins = async (status, analysisData = null) => {
              try {
                const admins = await db.getAllAdmins();
                const product = await db.getProduct(transaction.product_id);
                const productName = product ? product.name : transaction.product_id;
                
                const fileType = ctx.message.document ? 'pdf' : 'image';
                const caption = `⚠️ *ERRO NO PROCESSAMENTO - COMPROVANTE RECEBIDO*

❌ Erro: ${err.message}
💰 Valor: R$ ${transaction.amount}
👤 Usuário: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})
🆔 ID Usuário: ${ctx.from.id}
📦 Produto: ${productName}
📅 Enviado: ${new Date().toLocaleString('pt-BR')}
${fileType === 'pdf' ? '📄 Tipo: PDF\n' : '🖼️ Tipo: Imagem\n'}

🆔 TXID: ${transaction.txid}`;
                
                const replyMarkup = {
                  inline_keyboard: [
                    [
                      { text: '✅ Aprovar', callback_data: `approve_${transaction.txid}` },
                      { text: '❌ Rejeitar', callback_data: `reject_${transaction.txid}` }
                    ],
                    [
                      { text: '📋 Ver detalhes', callback_data: `details_${transaction.txid}` }
                    ]
                  ]
                };
                
                for (const admin of admins) {
                  try {
                    if (fileType === 'pdf') {
                      await ctx.telegram.sendDocument(admin.telegram_id, fileId, {
                        caption: caption,
                        parse_mode: 'Markdown',
                        reply_markup: replyMarkup
                      });
                    } else {
                      await ctx.telegram.sendPhoto(admin.telegram_id, fileId, {
                        caption: caption,
                        parse_mode: 'Markdown',
                        reply_markup: replyMarkup
                      });
                    }
                  } catch (notifyErr) {
                    console.error(`❌ Erro ao notificar admin ${admin.telegram_id}:`, notifyErr.message);
                  }
                }
              } catch (notifyErr) {
                console.error('❌ Erro ao buscar admins:', notifyErr.message);
              }
            };
            
            await notifyAdmins('pending', null);
          }
        }
      } catch (notifyErr) {
        console.error('❌ Erro ao tentar notificar admin em caso de erro:', notifyErr.message);
      }
      
      try {
        await ctx.reply(`❌ *Erro ao processar comprovante*

Ocorreu um erro inesperado.
O comprovante foi enviado para validação manual.
Aguarde a aprovação do administrador.

🔄 Tente novamente ou entre em contato com o suporte.`, {
          parse_mode: 'Markdown'
        });
      } catch (replyErr) {
        console.error('❌ Erro ao enviar mensagem de erro:', replyErr.message);
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

