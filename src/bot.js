// src/bot.js
const { Telegraf, Markup } = require('telegraf');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');
const db = require('./database');
const admin = require('./admin');
const creator = require('./creator');
const proofAnalyzer = require('./proofAnalyzer');
const { startExpirationJob } = require('./jobs/expireTransactions');
const { startBotDescriptionJob } = require('./jobs/updateBotDescription');
const { startReminderJob } = require('./jobs/sendPaymentReminders');

function createBot(token) {
  const bot = new Telegraf(token);
  
  // Iniciar job de expiração automática de transações
  startExpirationJob();
  console.log('✅ [BOT-INIT] Job de expiração de transações iniciado');
  
  // Iniciar job de atualização automática da descrição do bot
  startBotDescriptionJob();
  console.log('✅ [BOT-INIT] Job de atualização de descrição do bot iniciado');
  
  // Iniciar job de lembretes de pagamento (15 minutos)
  startReminderJob(bot);
  console.log('✅ [BOT-INIT] Job de lembretes de pagamento iniciado');
  
  // 🆕 REGISTRAR COMANDO /criador PRIMEIRO (antes de tudo, para garantir prioridade)
  creator.registerCreatorCommands(bot);
  console.log('✅ [BOT-INIT] Comando /criador registrado PRIMEIRO');
  
  // Configurar usuário criador automaticamente (se ainda não estiver configurado)
  const CREATOR_TELEGRAM_ID = 7147424680; // ID do primeiro criador (vê painel no /start)
  const SECOND_CREATOR_ID = 6668959779; // ID do segundo criador (menu normal, acesso via /criador)
  (async () => {
    try {
      const { data: creatorUser } = await db.supabase
        .from('users')
        .select('is_creator')
        .eq('telegram_id', CREATOR_TELEGRAM_ID)
        .single();
      
      if (creatorUser && !creatorUser.is_creator) {
        await db.setUserAsCreator(CREATOR_TELEGRAM_ID);
        console.log(`✅ [BOT-INIT] Usuário ${CREATOR_TELEGRAM_ID} configurado como criador`);
      } else if (!creatorUser) {
        console.log(`ℹ️ [BOT-INIT] Usuário ${CREATOR_TELEGRAM_ID} ainda não existe - será configurado quando usar o bot`);
      } else {
        console.log(`✅ [BOT-INIT] Usuário ${CREATOR_TELEGRAM_ID} já é criador`);
      }
    } catch (err) {
      console.log(`ℹ️ [BOT-INIT] Criador será configurado quando usar o bot pela primeira vez`);
    }
  })();
  

  // Registrar handler do /start PRIMEIRO (antes de tudo)
  bot.start(async (ctx) => {
    try {
      console.log('🎯 [START] Comando /start recebido de:', ctx.from.id);
      
      // 🚫 VERIFICAÇÃO DE BLOQUEIO POR DDD (DISCRETA)
      // Primeiro, verificar se o usuário já existe no banco
      console.log('🔍 [START] Verificando usuário no banco...');
      const { data: existingUser, error: userError } = await db.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', ctx.from.id)
        .single();
      
      // Se usuário não existe E tem telefone no Telegram, verificar DDD
      if (userError && userError.code === 'PGRST116') {
        console.log('👤 [START] Usuário novo detectado');
        // Usuário novo - verificar se compartilhou contato
        if (!ctx.from.phone_number && !ctx.message?.contact) {
          console.log('📱 [START] Usuário novo sem telefone - solicitando contato');
          // Solicitar telefone
          try {
            await ctx.telegram.sendMessage(
              ctx.chat.id,
            '📱 *Bem-vindo!*\n\n' +
            'Para acessar nossos produtos, precisamos verificar sua conta.\n\n' +
            'Por favor, compartilhe seu número de telefone usando o botão abaixo:',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [[{
                  text: '📱 Compartilhar Telefone',
                  request_contact: true
                }]],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            }
          );
            console.log('📱 [START] Mensagem de solicitação de telefone enviada');
            return;
          } catch (err) {
            console.error('❌ [START] Erro ao enviar mensagem com botão de contato:', err);
            return ctx.reply('📱 *Bem-vindo!*\n\nPara acessar nossos produtos, precisamos verificar sua conta.\n\nPor favor, compartilhe seu número de telefone usando o botão abaixo:', { parse_mode: 'Markdown' });
          }
        } else {
          console.log('✅ [START] Usuário novo com telefone ou contato compartilhado');
        }
        
        // Verificar DDD do telefone compartilhado
        const phoneNumber = ctx.from.phone_number || ctx.message?.contact?.phone_number;
        if (phoneNumber) {
          const areaCode = db.extractAreaCode(phoneNumber);
          console.log(`🔍 [DDD-CHECK] Novo usuário - DDD: ${areaCode}, Telefone: ${phoneNumber}`);
          
          if (areaCode) {
            // Verificar se é admin, criador ou foi liberado manualmente
            // Primeiro verificar admin/criador
            const [isAdmin, isCreator] = await Promise.all([
              db.isUserAdmin(ctx.from.id),
              db.isUserCreator(ctx.from.id)
            ]);
            
            // Se não for admin/criador, verificar se foi liberado manualmente
            let isManuallyUnblocked = false;
            if (!isAdmin && !isCreator) {
              try {
                // Tentar buscar usuário existente através da função do database
                const existingUser = await db.getUserByTelegramId(ctx.from.id);
                // Se encontrou e não está bloqueado, está liberado manualmente
                if (existingUser && existingUser.is_blocked === false) {
                  isManuallyUnblocked = true;
                }
              } catch (err) {
                // Se não encontrou usuário, não está liberado
                isManuallyUnblocked = false;
              }
            }
            
            // Se for admin, criador ou liberado manualmente, pular verificação de DDD
            if (isAdmin || isCreator || isManuallyUnblocked) {
              const reason = isAdmin ? 'admin' : isCreator ? 'criador' : 'liberado manualmente';
              console.log(`✅ [DDD-BYPASS] Usuário ${ctx.from.id} é ${reason} - ignorando bloqueio de DDD`);
            } else {
              // Apenas verificar bloqueio se não for admin/criador/liberado
              const isBlocked = await db.isAreaCodeBlocked(areaCode);
              
              if (isBlocked) {
                console.log(`🚫 [DDD-BLOCKED] DDD ${areaCode} bloqueado - Usuário: ${ctx.from.id}`);
                return ctx.reply(
                  '⚠️ *Serviço Temporariamente Indisponível*\n\n' +
                  'No momento, não conseguimos processar seu acesso.\n\n' +
                  'Estamos trabalhando para expandir nosso atendimento em breve!',
                  { 
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                  }
                );
              }
            }
          }
        }
      }
      
      // Verificar se é o primeiro criador - mostrar painel direto apenas para ele
      const user = await db.getOrCreateUser(ctx.from);
      const isCreator = await db.isUserCreator(ctx.from.id);
      
      // Apenas o primeiro criador vê o painel direto no /start
      if (isCreator && ctx.from.id === CREATOR_TELEGRAM_ID) {
        console.log(`👑 [START] Primeiro criador detectado (${ctx.from.id}) - mostrando painel do criador`);
        
        // Buscar estatísticas em tempo real (apenas transações aprovadas para criadores)
        const stats = await db.getCreatorStats();
        const pendingTxs = await db.getPendingTransactions();
        const pendingCount = pendingTxs.length;
        
        const message = `👑 *PAINEL DO CRIADOR*

📊 *ESTATÍSTICAS EM TEMPO REAL*

💳 *Transações Aprovadas:* ${stats.totalTransactions}
⏳ *Pendentes:* ${pendingCount}
💰 *Vendas:* R$ ${parseFloat(stats.totalSales || 0).toFixed(2)}

📅 *Hoje:*
💰 Vendas: R$ ${parseFloat(stats.todaySales || 0).toFixed(2)}
📦 Transações: ${stats.todayTransactions || 0}

━━━━━━━━━━━━━━━━━━━━━━━━

Selecione uma opção abaixo:`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📊 Estatísticas', 'creator_stats')],
          [Markup.button.callback('👤 Usuários', 'creator_users')],
          [Markup.button.callback('📢 Broadcast', 'creator_broadcast')],
          [Markup.button.callback('⏳ Pendentes', 'creator_pending')],
          [Markup.button.callback('🔄 Atualizar', 'creator_refresh')]
        ]);
        
        return ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
      
      // Se não for criador, mostrar menu normal
      // Paralelizar queries (OTIMIZAÇÃO #4)
      console.log('📦 [START] Buscando produtos, grupos e media packs...');
      const [products, groups, mediaPacks, supportLink] = await Promise.all([
        db.getAllProducts(),
        db.getAllGroups(),
        db.getAllMediaPacks(),
        db.getSetting('support_link')
      ]);
      
      console.log(`📊 [START] Produtos: ${products.length}, Grupos: ${groups.length}, Media Packs: ${mediaPacks.length}`);
      
      if (products.length === 0 && groups.length === 0 && mediaPacks.length === 0) {
        console.log('⚠️ [START] Nenhum produto/grupo/pack disponível');
        return ctx.reply('🚧 Nenhum produto ou grupo disponível no momento. Volte mais tarde!');
      }
      
      // Gerar botões dinamicamente (sem logs pesados)
      const buttons = products.map(product => {
        const emoji = parseFloat(product.price) >= 50 ? '💎' : '🛍️';
        const buttonText = `${emoji} ${product.name} (R$${parseFloat(product.price).toFixed(2)})`;
        return [Markup.button.callback(buttonText, `buy:${product.product_id}`)];
      });
      
      // Adicionar botões de media packs (fotos/vídeos aleatórios)
      const activeMediaPacks = mediaPacks.filter(p => p.is_active);
      for (const pack of activeMediaPacks) {
        // Não mostrar preço no botão (será aleatório a cada clique)
        buttons.push([Markup.button.callback(pack.name, `buy_media:${pack.pack_id}`)]);
      }
      
      // Adicionar botões de grupos ativos (um botão por grupo, usando o nome cadastrado)
      const activeGroups = groups.filter(g => g.is_active);
      for (const group of activeGroups) {
        // Usar o nome do grupo cadastrado no admin, ou um padrão se não tiver nome
        const groupButtonText = group.group_name || `👥 Grupo (R$${parseFloat(group.subscription_price).toFixed(2)}/mês)`;
        buttons.push([Markup.button.callback(groupButtonText, `subscribe:${group.group_id}`)]);
      }
      
      // Botão de suporte fixo (sempre aparece) - callback interno
      buttons.push([Markup.button.callback('💬 Suporte On-line', 'support_menu')]);
      
      const text = `👋 Olá! Bem-vindo ao Bot da Val 🌶️🔥\n\nEscolha uma opção abaixo:`;
      
      console.log(`✅ [START] Enviando menu com ${buttons.length} botões`);
      const result = await ctx.reply(text, Markup.inlineKeyboard(buttons));
      console.log('✅ [START] Menu enviado com sucesso!');
      return result;
    } catch (err) {
      console.error('❌ [START] Erro no /start:', err.message);
      console.error('❌ [START] Stack:', err.stack);
      return ctx.reply('❌ Erro ao carregar menu. Tente novamente.');
    }
  });

  // 🆕 REGISTRAR HANDLER DE COMPROVANTES ANTES DO ADMIN (CRÍTICO!)
  // Isso garante que comprovantes sejam processados antes de qualquer handler do admin
  console.log('🔧 [BOT-INIT] Registrando handler de comprovantes...');
  
  // 🆕 DEBUG: Log TODOS os tipos de mensagem
  bot.use(async (ctx, next) => {
    try {
      // Apenas logar mensagens, não callback_query
      if (ctx.message && ctx.from && ctx.from.id) {
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
    } catch (err) {
      // Ignorar erros no middleware para não quebrar o fluxo
      console.error('⚠️ [BOT-USE] Erro no middleware:', err.message);
      return next();
    }
  });

  // Handler para contato compartilhado (verificação de DDD)
  bot.on('contact', async (ctx) => {
    try {
      const contact = ctx.message.contact;
      
      // Verificar se é o próprio contato do usuário
      if (contact.user_id !== ctx.from.id) {
        return ctx.reply('❌ Por favor, compartilhe SEU próprio número de telefone.');
      }
      
      const phoneNumber = contact.phone_number;
      const areaCode = db.extractAreaCode(phoneNumber);
      
      console.log(`📞 [CONTACT] Contato recebido - User: ${ctx.from.id}, Phone: ${phoneNumber}, DDD: ${areaCode}`);
      
      if (!areaCode) {
        return ctx.reply('❌ Não foi possível identificar seu número de telefone. Tente novamente.', {
          reply_markup: { remove_keyboard: true }
        });
      }
      
      // Verificar se é admin, criador ou foi liberado manualmente
      // Primeiro verificar admin/criador
      const [isAdmin, isCreator] = await Promise.all([
        db.isUserAdmin(ctx.from.id),
        db.isUserCreator(ctx.from.id)
      ]);
      
      // Se não for admin/criador, verificar se foi liberado manualmente
      let isManuallyUnblocked = false;
      if (!isAdmin && !isCreator) {
        try {
          // Tentar buscar usuário existente através da função do database
          const existingUser = await db.getUserByTelegramId(ctx.from.id);
          // Se encontrou e não está bloqueado, está liberado manualmente
          if (existingUser && existingUser.is_blocked === false) {
            isManuallyUnblocked = true;
          }
        } catch (err) {
          // Se não encontrou usuário, não está liberado
          isManuallyUnblocked = false;
        }
      }
      
      // Se for admin, criador ou liberado manualmente, pular verificação de DDD
      if (isAdmin || isCreator || isManuallyUnblocked) {
        const reason = isAdmin ? 'admin' : isCreator ? 'criador' : 'liberado manualmente';
        console.log(`✅ [DDD-BYPASS] Usuário ${ctx.from.id} é ${reason} - ignorando bloqueio de DDD ${areaCode}`);
      } else {
        // Verificar se o DDD está bloqueado apenas se não for admin/criador/liberado
        const isBlocked = await db.isAreaCodeBlocked(areaCode);
        
        if (isBlocked) {
          console.log(`🚫 [DDD-BLOCKED] DDD ${areaCode} bloqueado - Usuário: ${ctx.from.id}`);
          return ctx.reply(
            '⚠️ *Serviço Temporariamente Indisponível*\n\n' +
            'No momento, não conseguimos processar seu acesso.\n\n' +
            'Estamos trabalhando para expandir nosso atendimento em breve!',
            { 
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            }
          );
        }
      }
      
      // DDD permitido - criar usuário e salvar telefone
      const user = await db.getOrCreateUser(ctx.from);
      await db.updateUserPhone(ctx.from.id, phoneNumber);
      
      console.log(`✅ [DDD-ALLOWED] DDD ${areaCode} permitido - Usuário: ${ctx.from.id} criado`);
      
      return ctx.reply(
        '✅ *Verificação Concluída\\!*\n\n' +
        'Seu acesso foi liberado\\! Use /start para ver nossos produtos\\.',
        { 
          parse_mode: 'MarkdownV2',
          reply_markup: { remove_keyboard: true }
        }
      );
      
    } catch (err) {
      console.error('❌ [CONTACT] Erro ao processar contato:', err);
      return ctx.reply('❌ Erro ao processar seu contato. Tente novamente.');
    }
  });

  // 🆕 REGISTRAR HANDLER DE COMPROVANTES ANTES DO ADMIN (CRÍTICO!)
  // Isso garante que comprovantes sejam processados antes de qualquer handler do admin
  console.log('🔧 [BOT-INIT] Registrando handler de comprovantes ANTES do admin...');
  
  // 🆕 DEBUG: Log TODOS os tipos de mensagem
  bot.use(async (ctx, next) => {
    try {
      // Apenas logar mensagens, não callback_query
      if (ctx.message && ctx.from && ctx.from.id) {
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
    } catch (err) {
      // Ignorar erros no middleware para não quebrar o fluxo
      console.error('⚠️ [BOT-USE] Erro no middleware:', err.message);
      return next();
    }
  });

  // Receber comprovante (foto ou documento)
  bot.on(['photo', 'document'], async (ctx, next) => {
    try {
      // 🆕 PRIORIDADE: Verificar se usuário está em sessão de admin PRIMEIRO
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      if (session && (session.type === 'create_product' || session.type === 'edit_product')) {
        console.log('⏭️ [HANDLER-BOT] Sessão de admin detectada, passando para handler do admin.js');
        return next(); // ✅ Passar para próximo handler (admin.js)
      }
      
      // 🆕 LOG INICIAL - CRÍTICO PARA DEBUG
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 [HANDLER] COMPROVANTE RECEBIDO!');
      console.log(`📋 [HANDLER] Tipo: ${ctx.message.photo ? 'PHOTO' : 'DOCUMENT'}`);
      
      // 🆕 LOG DETALHADO PARA PDFs
      if (ctx.message.document) {
        console.log(`📄 [HANDLER] Documento detectado:`, {
          file_name: ctx.message.document.file_name,
          mime_type: ctx.message.document.mime_type,
          file_size: ctx.message.document.file_size,
          file_id: ctx.message.document.file_id?.substring(0, 30)
        });
      }
      
      console.log(`👤 [HANDLER] User: ${ctx.from.id} (@${ctx.from.username || 'N/A'})`);
      console.log(`📅 [HANDLER] Timestamp: ${new Date().toISOString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('🔍 [HANDLER] Buscando transação pendente...');
      const transaction = await db.getLastPendingTransaction(ctx.chat.id);
      
      if (!transaction) {
        console.warn('⚠️ [HANDLER] Nenhuma transação pendente encontrada');
        // Não há transação pendente, então não processar como comprovante
        return;
      }
      
      console.log(`✅ [HANDLER] Transação encontrada: ${transaction.txid}`);
      console.log(`📋 [HANDLER] Detalhes da transação:`, {
        txid: transaction.txid,
        product_id: transaction.product_id,
        media_pack_id: transaction.media_pack_id,
        group_id: transaction.group_id, // 🆕 Log do group_id
        amount: transaction.amount
      });

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
      try {
        await ctx.reply('✅ *Comprovante recebido!*\n\n⏳ Um admin irá validar em breve.\n\n🆔 TXID: ' + transaction.txid, { 
          parse_mode: 'Markdown' 
        });
        console.log(`✅ [HANDLER] Confirmação enviada ao usuário com sucesso`);
      } catch (err) {
        console.error('❌ [HANDLER] Erro ao enviar confirmação:', err.message);
        // Tentar novamente
        try {
          await ctx.telegram.sendMessage(ctx.chat.id, '✅ *Comprovante recebido!*\n\n⏳ Um admin irá validar em breve.\n\n🆔 TXID: ' + transaction.txid, { 
            parse_mode: 'Markdown' 
          });
          console.log(`✅ [HANDLER] Confirmação enviada na segunda tentativa`);
        } catch (retryErr) {
          console.error('❌ [HANDLER] Erro na segunda tentativa:', retryErr.message);
        }
      }
      
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
            console.log('📄 [HANDLER] PDF DETECTADO:', { 
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
              console.log('🖼️ [HANDLER] IMAGEM DETECTADA (documento):', { 
                mimeType, 
                fileName, 
                fileExtension 
              });
            } else {
              console.warn('⚠️ [HANDLER] TIPO DE ARQUIVO DESCONHECIDO:', { 
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
          console.log('📷 [HANDLER] FOTO DETECTADA (photo)');
        }
        
        console.log(`✅ [HANDLER] Tipo de arquivo determinado: ${fileType.toUpperCase()}`);
      } catch (err) {
        console.error('❌ [HANDLER] Erro ao obter URL do arquivo:', err.message);
        console.error('Stack:', err.stack);
      }
      
      // 🆕 NOTIFICAR ADMIN IMEDIATAMENTE (ANTES DE QUALQUER ANÁLISE)
      // Isso garante que o admin SEMPRE receba o comprovante, mesmo se a análise falhar ou der timeout
      console.log(`📤 [HANDLER] NOTIFICANDO ADMIN IMEDIATAMENTE (sem esperar análise)...`);
      console.log(`📤 [HANDLER] FileType detectado: ${fileType}, FileId: ${fileId?.substring(0, 30)}...`);
      
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
          
          // 🆕 Verificar se é grupo, media pack ou produto normal
          let productName = 'Produto não encontrado';
          try {
            // 🆕 PRIMEIRO: Verificar se é grupo (prioridade)
            if (transaction.group_id) {
              console.log(`👥 [NOTIFY] Transação é de grupo (group_id: ${transaction.group_id})`);
              try {
                const { data: groupData, error: groupError } = await db.supabase
                  .from('groups')
                  .select('group_name, group_id')
                  .eq('id', transaction.group_id)
                  .single();
                
                if (!groupError && groupData) {
                  productName = groupData.group_name || `Grupo ${groupData.group_id}` || 'Grupo';
                  console.log(`✅ [NOTIFY] Grupo encontrado: ${productName}`);
                } else {
                  // Fallback: tentar buscar pelo product_id se começar com "group_"
                  if (transaction.product_id && transaction.product_id.startsWith('group_')) {
                    const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
                    const group = await db.getGroupById(groupTelegramId);
                    productName = group ? (group.group_name || `Grupo ${group.group_id}`) : transaction.product_id || 'Grupo';
                  } else {
                    productName = 'Grupo (não encontrado)';
                  }
                }
              } catch (groupErr) {
                console.error('Erro ao buscar grupo:', groupErr);
                productName = 'Grupo (erro ao buscar)';
              }
            } else if (transaction.media_pack_id) {
              // É um media pack
              const pack = await db.getMediaPackById(transaction.media_pack_id);
              productName = pack ? pack.name : transaction.media_pack_id || 'Media Pack';
            } else if (transaction.product_id) {
              // É um produto normal - verificar se não é grupo antigo
              if (transaction.product_id.startsWith('group_')) {
                // Formato antigo de grupo - tentar buscar
                const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
                const group = await db.getGroupById(groupTelegramId);
                productName = group ? (group.group_name || `Grupo ${group.group_id}`) : transaction.product_id || 'Grupo';
              } else {
                // Produto normal - buscar incluindo inativos (transação antiga pode ter produto desativado)
          const product = await db.getProduct(transaction.product_id, true);
              productName = product ? product.name : transaction.product_id || 'Produto';
              }
            }
          } catch (err) {
            console.error('Erro ao buscar produto/pack/grupo:', err);
            // Usar fallback baseado no que temos
            productName = transaction.group_id 
              ? 'Grupo' 
              : (transaction.media_pack_id || transaction.product_id || 'Produto não encontrado');
          }
          
          // Garantir que productName nunca seja null ou undefined
          if (!productName || productName === 'null' || productName === 'undefined') {
            productName = transaction.group_id 
              ? 'Grupo' 
              : (transaction.media_pack_id || transaction.product_id || 'Produto não encontrado');
          }
          
          const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⚠️';
          const statusText = status === 'approved' ? 'APROVADO AUTOMATICAMENTE' : status === 'rejected' ? 'REJEITADO' : 'PENDENTE DE VALIDAÇÃO';
          
          // 🆕 INCLUIR TIPO DE ARQUIVO CLARAMENTE NA MENSAGEM
          const fileTypeEmoji = fileType === 'pdf' ? '📄' : '🖼️';
          const fileTypeText = fileType === 'pdf' ? 'PDF' : 'Imagem';
          
          // 🆕 Detectar se é grupo para mensagem especial
          const isGroupTransaction = transaction.group_id || (transaction.product_id && transaction.product_id.startsWith('group_'));
          const productLabel = isGroupTransaction ? '👥 Grupo' : '📦 Produto';
          
          const caption = `${statusEmoji} *COMPROVANTE RECEBIDO - ${statusText}*

${analysisData ? `🤖 Análise automática: ${analysisData.confidence}% de confiança\n` : ''}💰 Valor: R$ ${transaction.amount}
👤 Usuário: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})
🆔 ID Usuário: ${ctx.from.id}
${productLabel}: ${productName}
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
      
      // 🆕 ANÁLISE AUTOMÁTICA OCR EM BACKGROUND
      // Executar análise de forma assíncrona (não bloqueia webhook)
      // Capturar variáveis necessárias ANTES do setImmediate para evitar problemas de contexto
      const telegram = ctx.telegram;
      const chatId = ctx.chat.id;
      const fromUser = {
        id: ctx.from.id,
        first_name: ctx.from.first_name,
        username: ctx.from.username
      };
      const transactionData = {
        txid: transaction.txid,
        amount: transaction.amount,
        pix_key: transaction.pix_key,
        pix_payload: transaction.pix_payload || transaction.pixPayload, // Código PIX (copia e cola)
        product_id: transaction.product_id,
        media_pack_id: transaction.media_pack_id,
        group_id: transaction.group_id, // 🆕 Incluir group_id no transactionData
        user_id: transaction.user_id
      };
      
      setImmediate(async () => {
        try {
          if (!fileUrl) {
            console.warn('⚠️ [AUTO-ANALYSIS] URL do arquivo não disponível, pulando análise');
            return;
          }
          
          console.log(`🔍 [AUTO-ANALYSIS] Iniciando análise OCR de ${fileType}...`);
          console.log(`📎 [AUTO-ANALYSIS] URL: ${fileUrl.substring(0, 80)}...`);
          console.log(`💰 [AUTO-ANALYSIS] Valor esperado: R$ ${transactionData.amount}`);
          console.log(`🔑 [AUTO-ANALYSIS] Chave PIX: ${transactionData.pix_key}`);
          console.log(`🆔 [AUTO-ANALYSIS] TXID: ${transactionData.txid}`);
          console.log(`⏰ [AUTO-ANALYSIS] Tempo início: ${new Date().toISOString()}`);
          
          // 🚀 OTIMIZAÇÃO: Verificar cache do OCR primeiro (com timeout de 5s)
          console.log(`🔍 [AUTO-ANALYSIS] Verificando cache OCR...`);
          let analysis = null;
          
          try {
            const cachePromise = db.getOCRResult(transactionData.txid);
            const cacheTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout na verificação de cache (5s)')), 5000)
            );
            
            analysis = await Promise.race([cachePromise, cacheTimeout]);
            console.log(`✅ [AUTO-ANALYSIS] Verificação de cache concluída`);
          } catch (cacheErr) {
            console.warn(`⚠️ [AUTO-ANALYSIS] Erro ou timeout na verificação de cache: ${cacheErr.message}`);
            console.log(`📊 [AUTO-ANALYSIS] Continuando com análise OCR...`);
            analysis = null;
          }
          
          if (analysis) {
            console.log(`⚡ [AUTO-ANALYSIS] Cache encontrado! Usando resultado em cache (confiança: ${analysis.confidence}%)`);
            console.log(`⏰ [AUTO-ANALYSIS] Tempo fim: ${new Date().toISOString()} (cache)`);
          } else {
            console.log(`📊 [AUTO-ANALYSIS] Cache não encontrado, iniciando análise OCR...`);
            
            // Salvar URL do arquivo no banco (para uso futuro)
            await db.updateProofFileUrl(transactionData.txid, fileUrl);
            
            // Timeout de 3 minutos (180s) para análise completa
            // Download: até 90s (com retry) + OCR: até 90s = máximo 180s
            const analysisPromise = proofAnalyzer.analyzeProof(
              fileUrl,
              transactionData.amount,
              transactionData.pix_key,
              fileType
            );
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout na análise OCR (3 minutos)')), 180000)
            );
            
            console.log(`⏳ [AUTO-ANALYSIS] Aguardando resultado da análise...`);
            analysis = await Promise.race([analysisPromise, timeoutPromise]);
            console.log(`⏰ [AUTO-ANALYSIS] Tempo fim: ${new Date().toISOString()}`);
            
            // 🚀 OTIMIZAÇÃO: Salvar resultado no cache
            if (analysis) {
              await db.saveOCRResult(transactionData.txid, analysis);
              console.log(`💾 [AUTO-ANALYSIS] Resultado salvo no cache para uso futuro`);
            }
          }
          
          console.log(`📊 [AUTO-ANALYSIS] Análise concluída:`, {
            isValid: analysis?.isValid,
            confidence: analysis?.confidence,
            method: analysis?.details?.method,
            reason: analysis?.details?.reason,
            hasCorrectValue: analysis?.details?.hasCorrectValue,
            hasPixKey: analysis?.details?.hasPixKey,
            foundValues: analysis?.details?.foundValues
          });
          
          // Log detalhado da decisão
          if (analysis?.isValid === true && analysis?.confidence >= 70) {
            console.log(`✅ [AUTO-ANALYSIS] DECISÃO: APROVAR AUTOMATICAMENTE (confiança ${analysis.confidence}% >= 70%)`);
          } else if (analysis?.isValid === false && analysis?.confidence < 40) {
            console.log(`❌ [AUTO-ANALYSIS] DECISÃO: REJEITAR AUTOMATICAMENTE (confiança ${analysis.confidence}% < 40%)`);
          } else {
            console.log(`⚠️ [AUTO-ANALYSIS] DECISÃO: VALIDAÇÃO MANUAL (confiança ${analysis?.confidence}% entre 40% e 70%)`);
          }
          
          // 🆕 Verificar se é grupo, media pack ou produto normal
          let productName = 'Produto não encontrado';
          if (transactionData.group_id) {
            // 🆕 É uma transação de grupo
            try {
              const { data: groupData, error: groupError } = await db.supabase
                .from('groups')
                .select('group_name, group_id')
                .eq('id', transactionData.group_id)
                .single();
              
              if (!groupError && groupData) {
                productName = groupData.group_name || `Grupo ${groupData.group_id}` || 'Grupo';
              } else {
                productName = 'Grupo (não encontrado)';
              }
            } catch (err) {
              console.error('Erro ao buscar grupo:', err);
              productName = 'Grupo (erro ao buscar)';
            }
          } else if (transactionData.media_pack_id) {
            // É um media pack
            try {
              const pack = await db.getMediaPackById(transactionData.media_pack_id);
              productName = pack ? pack.name : transactionData.media_pack_id;
            } catch (err) {
              console.error('Erro ao buscar media pack:', err);
              productName = transactionData.media_pack_id || 'Media Pack';
            }
          } else if (transactionData.product_id) {
            // É um produto normal - verificar se não é grupo antigo
            try {
              if (transactionData.product_id.startsWith('group_')) {
                // Formato antigo de grupo
                const groupTelegramId = parseInt(transactionData.product_id.replace('group_', ''));
                const group = await db.getGroupById(groupTelegramId);
                productName = group ? (group.group_name || `Grupo ${group.group_id}`) : transactionData.product_id || 'Grupo';
              } else {
                // Produto normal - buscar incluindo inativos (transação antiga pode ter produto desativado)
          const product = await db.getProduct(transactionData.product_id, true);
              productName = product ? product.name : transactionData.product_id;
              }
            } catch (err) {
              console.error('Erro ao buscar produto:', err);
              productName = transactionData.product_id || 'Produto';
            }
          }
          
          // ✅ APROVAÇÃO AUTOMÁTICA (confidence >= 70 e isValid = true)
          if (analysis && analysis.isValid === true && analysis.confidence >= 70) {
            console.log(`✅ [AUTO-ANALYSIS] APROVAÇÃO AUTOMÁTICA para TXID ${transactionData.txid}`);
            
            try {
              // Aprovar transação no banco
              await db.validateTransaction(transactionData.txid, transactionData.user_id);
              console.log(`✅ [AUTO-ANALYSIS] Transação validada no banco`);
              
              // Notificar ADMIN sobre aprovação automática
              const admins = await db.getAllAdmins();
              for (const admin of admins) {
                try {
                  await telegram.sendMessage(admin.telegram_id, 
                    `✅ *COMPROVANTE APROVADO AUTOMATICAMENTE*

🤖 *Análise OCR:* ${analysis.confidence}% de confiança
💰 Valor confirmado: R$ ${analysis.details.amount || transactionData.amount}
👤 Usuário: ${fromUser.first_name} (@${fromUser.username || 'N/A'})
🆔 ID: ${fromUser.id}
📦 Produto: ${productName}
📅 ${new Date().toLocaleString('pt-BR')}

🆔 TXID: ${transactionData.txid}

${fileType === 'pdf' ? '📄' : '🖼️'} Tipo: ${fileType === 'pdf' ? 'PDF' : 'Imagem'}
✅ Status: *ENTREGUE AUTOMATICAMENTE*`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                      inline_keyboard: [[
                        { text: '❌ Cancelar entrega', callback_data: `reject_${transactionData.txid}` }
                      ]]
                    }
                  });
                  console.log(`✅ [AUTO-ANALYSIS] Admin ${admin.telegram_id} notificado sobre aprovação automática`);
                } catch (notifyErr) {
                  console.error(`❌ [AUTO-ANALYSIS] Erro ao notificar admin:`, notifyErr.message);
                }
              }
              
              // Entregar produto ao usuário
              // 🆕 Verificar se é renovação de grupo (via group_id OU product_id antigo)
              const isGroupRenewal = transactionData.group_id || 
                                    (transactionData.product_id && transactionData.product_id.startsWith('group_'));
              
              if (isGroupRenewal) {
                // Assinatura/Renovação de grupo
                let group = null;
                
                // Método novo: usar group_id direto
                if (transactionData.group_id) {
                  const { data: groupData, error: groupError } = await db.supabase
                    .from('groups')
                    .select('*')
                    .eq('id', transactionData.group_id)
                    .single();
                  
                  if (!groupError && groupData) {
                    group = groupData;
                  }
                }
                
                // Método antigo: usar product_id (compatibilidade)
                if (!group && transactionData.product_id && transactionData.product_id.startsWith('group_')) {
                  const groupTelegramId = parseInt(transactionData.product_id.replace('group_', ''));
                  group = await db.getGroupById(groupTelegramId);
                }
                
                if (group) {
                  console.log(`👥 [AUTO-ANALYSIS] Adicionando usuário ${chatId} ao grupo ${group.group_name}`);
                  
                  // Adicionar ou renovar assinatura no banco (monitoramento de dias)
                  await db.addGroupMember({
                    telegramId: chatId,
                    userId: transactionData.user_id,
                    groupId: group.id,
                    days: group.subscription_days
                  });
                  
                  // Tentar adicionar usuário diretamente ao grupo
                  const addedToGroup = await deliver.addUserToGroup(telegram, chatId, group);
                  
                  // Enviar mensagem de confirmação ao usuário
                  try {
                    const { Markup } = require('telegraf');
                    
                    // Calcular data de expiração
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
                    
                    // Mensagem única seguindo estrutura da imagem
                    const zwsp = '\u200B'; // Zero-width space
                    const zwnj = '\u200C'; // Zero-width non-joiner
                    await telegram.sendMessage(chatId, `✅ *ASSINATURA APROVADA!*

👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias

✅ *Seu acesso foi liberado!*

🔗 *Link direto para entrar:*
${group.group_link}

Clique no botão abaixo ou no link acima para entrar no grupo:

🆔 TXID: ${transactionData.txid}

${zwsp}${zwnj}${zwsp}`, {
                      parse_mode: 'Markdown',
                      disable_web_page_preview: false
                    });
                    
                    console.log(`✅ [AUTO-ANALYSIS] Mensagem com link enviada ao usuário ${chatId}`);
                    } catch (msgErr) {
                    console.error('⚠️ [AUTO-ANALYSIS] Erro ao enviar mensagem ao usuário:', msgErr.message);
                    
                    // Tentar enviar mensagem simples como fallback
                    try {
                      const expiresAt = new Date();
                      expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
                      
                      // Mensagem única seguindo estrutura da imagem
                      const zwsp = '\u200B'; // Zero-width space
                      const zwnj = '\u200C'; // Zero-width non-joiner
                      await telegram.sendMessage(chatId, `✅ *ASSINATURA APROVADA!*

👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias

✅ *Seu acesso foi liberado!*

🔗 *Link direto para entrar:*
${group.group_link}

Clique no botão abaixo ou no link acima para entrar no grupo:

🆔 TXID: ${transactionData.txid}

${zwsp}${zwnj}${zwsp}`, {
                        parse_mode: 'Markdown',
                        disable_web_page_preview: false
                      });
                    } catch (fallbackErr) {
                      console.error('❌ [AUTO-ANALYSIS] Erro no fallback:', fallbackErr.message);
                    }
                  }
                  
                  await db.markAsDelivered(transactionData.txid);
                  console.log(`✅ [AUTO-ANALYSIS] Usuário ${chatId} adicionado ao grupo ${group.group_name} e assinatura entregue`);
                } else {
                  console.error(`❌ [AUTO-ANALYSIS] Grupo não encontrado para transação ${transactionData.txid}`);
                }
              } else if (transactionData.media_pack_id) {
                // Media pack (Packs de Agora)
                const packId = transactionData.media_pack_id;
                
                try {
                  // Buscar o internal ID da transação
                  const { data: transData, error: transError } = await db.supabase
                    .from('transactions')
                    .select('id')
                    .eq('txid', transactionData.txid)
                    .single();
                  
                  if (transError) throw transError;
                  
                  // Entregar media pack (fotos/vídeos aleatórios)
                  await deliver.deliverMediaPack(
                    chatId,
                    packId,
                    transactionData.user_id,
                    transData.id,
                    db
                  );
                  
                  await db.markAsDelivered(transactionData.txid);
                  console.log(`✅ [AUTO-ANALYSIS] Media pack ${packId} entregue com sucesso`);
                } catch (err) {
                  console.error(`❌ [AUTO-ANALYSIS] Erro ao entregar media pack:`, err.message);
                  
                  // Notificar usuário sobre erro
                  try {
                    await telegram.sendMessage(chatId, `⚠️ *PAGAMENTO APROVADO AUTOMATICAMENTE!*

Seu pagamento foi confirmado, mas ocorreu um erro ao enviar as mídias.

Entre em contato com o suporte.

🆔 TXID: ${transactionData.txid}`, {
                      parse_mode: 'Markdown'
                    });
                  } catch (notifyErr) {
                    console.error('❌ [AUTO-ANALYSIS] Erro ao notificar usuário:', notifyErr);
                  }
                }
              } else {
                // Produto digital - usar deliverContent para entregar arquivo ZIP corretamente
                // Buscar produto novamente para ter acesso completo
                let product = null;
                if (transactionData.product_id) {
                  try {
                    product = await db.getProduct(transactionData.product_id, true);
                  } catch (err) {
                    console.error('Erro ao buscar produto para entrega:', err);
                  }
                }
                
                if (product && product.delivery_url) {
                  console.log(`📨 [AUTO-ANALYSIS] Entregando produto digital para cliente ${chatId}`);
                  
                  try {
                    await deliver.deliverContent(
                      chatId, 
                      product, 
                      `✅ *PAGAMENTO APROVADO AUTOMATICAMENTE!*\n\n🤖 Análise de IA: ${analysis.confidence}% de confiança\n💰 Valor confirmado: R$ ${analysis.details.amount || transactionData.amount}\n\n🆔 TXID: ${transactionData.txid}`
                    );
                    
                    await db.markAsDelivered(transactionData.txid);
                    console.log(`✅ [AUTO-ANALYSIS] Produto digital entregue`);
                  } catch (deliverErr) {
                    console.error(`❌ [AUTO-ANALYSIS] Erro ao entregar produto:`, deliverErr.message);
                    // Fallback: enviar mensagem simples
                    await telegram.sendMessage(chatId, `✅ *PAGAMENTO APROVADO AUTOMATICAMENTE!*

🤖 Análise de IA: ${analysis.confidence}% de confiança
💰 Valor confirmado: R$ ${analysis.details.amount || transactionData.amount}

📦 *Produto:* ${productName}
${product.delivery_type === 'file' ? '📄 Arquivo anexado acima' : `🔗 Link: ${product.delivery_url}`}

✅ Produto entregue com sucesso!

🆔 TXID: ${transactionData.txid}`, { parse_mode: 'Markdown' });
                    
                    await db.markAsDelivered(transactionData.txid);
                  }
                } else {
                  console.warn(`⚠️ [AUTO-ANALYSIS] Produto não encontrado ou sem delivery_url para TXID ${transactionData.txid}`);
                }
              }
              
            } catch (approvalErr) {
              console.error(`❌ [AUTO-ANALYSIS] Erro na aprovação automática:`, approvalErr.message);
            }
          }
          // ⚠️ ANÁLISE COM BAIXA CONFIANÇA (confidence < 40 e isValid = false)
          // NÃO CANCELAR AUTOMATICAMENTE - deixar admin decidir manualmente
          else if (analysis && analysis.isValid === false && analysis.confidence < 40) {
            console.log(`⚠️ [AUTO-ANALYSIS] BAIXA CONFIANÇA para TXID ${transactionData.txid} - DEIXANDO PARA ADMIN DECIDIR`);
            
            try {
              // NÃO cancelar transação - manter como proof_sent para admin revisar
              // await db.cancelTransaction(transactionData.txid); // ❌ REMOVIDO!
              console.log(`⚠️ [AUTO-ANALYSIS] Transação mantida como 'proof_sent' para revisão manual do admin`);
              
              // Notificar USUÁRIO que comprovante está em análise (sem assustar)
              console.log(`📨 [AUTO-ANALYSIS] Enviando notificação de análise para cliente ${chatId}`);
              
              await telegram.sendMessage(chatId, `⚠️ *COMPROVANTE EM ANÁLISE*

📸 Seu comprovante foi recebido e está sendo analisado.

⏳ *Um admin irá validar manualmente em breve.*

💡 *Dica:* Se o comprovante estiver com baixa qualidade, você pode enviar outro mais claro.

🆔 TXID: ${transactionData.txid}`, { 
                parse_mode: 'Markdown' 
              });
              
              // Notificar ADMIN sobre baixa confiança - MAS COM BOTÕES DE APROVAR/REJEITAR
              const admins = await db.getAllAdmins();
              for (const admin of admins) {
                try {
                  await telegram.sendMessage(admin.telegram_id, 
                    `⚠️ *COMPROVANTE COM BAIXA CONFIANÇA - VALIDAÇÃO MANUAL NECESSÁRIA*

🤖 *Análise OCR:* ${analysis.confidence}% de confiança (< 40%)
⚠️ Motivo: ${analysis.details.reason || 'Comprovante não corresponde aos dados esperados'}
👤 Usuário: ${fromUser.first_name} (@${fromUser.username || 'N/A'})
🆔 ID: ${fromUser.id}
📦 Produto: ${productName}
💰 Valor esperado: R$ ${transactionData.amount}
📅 ${new Date().toLocaleString('pt-BR')}

🆔 TXID: ${transactionData.txid}

⚠️ *Status:* PENDENTE DE VALIDAÇÃO MANUAL
👁️ *Revise o comprovante acima e decida:*`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: '✅ Aprovar (Comprovante OK)', callback_data: `approve_${transactionData.txid}` },
                          { text: '❌ Rejeitar (Comprovante Inválido)', callback_data: `reject_${transactionData.txid}` }
                        ],
                        [
                          { text: '📋 Ver detalhes', callback_data: `details_${transactionData.txid}` }
                        ]
                      ]
                    }
                  });
                  console.log(`✅ [AUTO-ANALYSIS] Admin ${admin.telegram_id} notificado sobre baixa confiança (com botões)`);
                } catch (notifyErr) {
                  console.error(`❌ [AUTO-ANALYSIS] Erro ao notificar admin:`, notifyErr.message);
                }
              }
              
            } catch (lowConfidenceErr) {
              console.error(`❌ [AUTO-ANALYSIS] Erro ao processar baixa confiança:`, lowConfidenceErr.message);
            }
          }
          // ⚠️ ANÁLISE INCONCLUSIVA (deixar para validação manual)
          else {
            console.log(`⚠️ [AUTO-ANALYSIS] Análise inconclusiva para TXID ${transactionData.txid}`);
            console.log(`⚠️ [AUTO-ANALYSIS] Confiança: ${analysis?.confidence}%, isValid: ${analysis?.isValid}`);
            console.log(`⚠️ [AUTO-ANALYSIS] Validação manual já foi solicitada ao admin`);
          }
          
        } catch (err) {
          console.error(`❌ [AUTO-ANALYSIS] Erro na análise para TXID ${transactionData.txid}:`, err.message);
          console.error('Stack:', err.stack);
          console.error('Detalhes do erro:', {
            name: err.name,
            message: err.message,
            code: err.code
          });
          // Em caso de erro, validação manual já foi solicitada ao admin
        }
      });
      
      console.log('✅ [HANDLER] Análise automática iniciada em background');
      console.log(`✅ [HANDLER] Processo concluído com sucesso!`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
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

  console.log('✅ [BOT-INIT] Handler de comprovantes registrado');
  
  // ===== REGISTRAR COMANDOS DE USUÁRIO ANTES DO ADMIN =====
  // Isso garante que comandos como /meuspedidos e /renovar sejam processados antes do bot.on('text') do admin
  console.log('✅ [BOT-INIT] Registrando comandos de usuário...');
  
  // ===== MEUS PEDIDOS =====
  console.log('✅ [BOT-INIT] Registrando comando /meuspedidos...');
  bot.command('meuspedidos', async (ctx) => {
    try {
      console.log('📋 [MEUS-PEDIDOS] Comando /meuspedidos recebido de:', ctx.from.id);
      const user = await db.getOrCreateUser(ctx.from);
      const transactions = await db.getUserTransactions(ctx.from.id, 20);
      console.log('📋 [MEUS-PEDIDOS] Transações encontradas:', transactions?.length || 0);
      
      if (!transactions || transactions.length === 0) {
        console.log('📦 [MEUS-PEDIDOS] Nenhum pedido encontrado - enviando mensagem de incentivo');
        const response = await ctx.reply(`📦 *Nenhum pedido encontrado*

Você ainda não realizou nenhuma compra.

🛍️ *Que tal começar agora?*

*Use o comando:* /start

Para ver nossos produtos disponíveis e fazer sua primeira compra!

✨ *Ofertas especiais esperando por você!*`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍️ Ver Produtos', callback_data: 'back_to_start' }]
            ]
          }
        });
        console.log('✅ [MEUS-PEDIDOS] Mensagem enviada com sucesso');
        return response;
      }
      
      // Agrupar transações por status
      const statusEmoji = {
        'pending': '⏳',
        'proof_sent': '📸',
        'validated': '✅',
        'delivered': '✅',
        'expired': '❌',
        'cancelled': '❌'
      };
      
      const statusText = {
        'pending': 'Aguardando pagamento',
        'proof_sent': 'Comprovante em análise',
        'validated': 'Pagamento aprovado',
        'delivered': 'Produto entregue',
        'expired': 'Transação expirada',
        'cancelled': 'Transação cancelada'
      };
      
      let message = `📋 *MEUS PEDIDOS*\n\n`;
      
      // Mostrar últimas 10 transações
      const recentTransactions = transactions.slice(0, 10);
      
      for (const tx of recentTransactions) {
        const emoji = statusEmoji[tx.status] || '📦';
        const status = statusText[tx.status] || tx.status;
        const productName = tx.product_name || tx.product_id || tx.media_pack_id || (tx.group_id ? 'Grupo' : 'Produto');
        const date = new Date(tx.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        message += `${emoji} *${productName}*\n`;
        message += `💰 R$ ${parseFloat(tx.amount).toFixed(2)}\n`;
        message += `📊 ${status}\n`;
        message += `📅 ${date}\n`;
        message += `🆔 \`${tx.txid}\`\n\n`;
      }
      
      if (transactions.length > 10) {
        message += `\n_Mostrando 10 de ${transactions.length} pedidos_`;
      }
      
      console.log('📋 [MEUS-PEDIDOS] Enviando lista de pedidos');
      const response = await ctx.reply(message, { parse_mode: 'Markdown' });
      console.log('✅ [MEUS-PEDIDOS] Lista de pedidos enviada com sucesso');
      return response;
    } catch (err) {
      console.error('❌ [MEUS-PEDIDOS] Erro no comando meuspedidos:', err);
      console.error('❌ [MEUS-PEDIDOS] Stack:', err.stack);
      return ctx.reply('❌ Erro ao buscar seus pedidos. Tente novamente.');
    }
  });

  // ===== RENOVAR ASSINATURA =====
  console.log('✅ [BOT-INIT] Registrando comando /renovar...');
  bot.command('renovar', async (ctx) => {
    try {
      console.log('🔄 [RENOVAR] Comando /renovar recebido de:', ctx.from.id);
      const user = await db.getOrCreateUser(ctx.from);
      const groups = await db.getAllGroups();
      console.log('🔄 [RENOVAR] Grupos encontrados:', groups?.length || 0);
      const activeGroups = groups.filter(g => g.is_active);
      
      if (activeGroups.length === 0) {
        console.log('🔥 [RENOVAR] Nenhum grupo ativo - enviando mensagem de promoção');
        const response = await ctx.reply(`🔥 *PROMOÇÃO ESPECIAL!*

📦 Nenhum grupo disponível para renovação no momento.

✨ *Mas temos ofertas incríveis esperando por você!*

🛍️ *Use o comando:* /start

Para ver nossos produtos em promoção e fazer sua compra agora!

💎 *Ofertas limitadas - Não perca!*`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍️ Ver Produtos em Promoção', callback_data: 'back_to_start' }]
            ]
          }
        });
        console.log('✅ [RENOVAR] Mensagem de promoção enviada com sucesso');
        return response;
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
            
            // Mensagem única com todas as informações + link oculto (gera card automático)
            const zwsp = '\u200B'; // Zero-width space
            const zwnj = '\u200C'; // Zero-width non-joiner
            await ctx.reply(`✅ *Você já tem assinatura ativa!*

👥 Grupo: ${group.group_name}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}
⏰ Faltam: ${daysLeft} dias

${zwsp}${zwnj}${zwsp}
${group.group_link}
${zwsp}${zwnj}${zwsp}`, {
              parse_mode: 'Markdown',
              disable_web_page_preview: false
            });
            return;
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
  
  console.log('✅ [BOT-INIT] Comandos de usuário registrados');
  
  // Registrar comandos admin DEPOIS do handler de comprovantes E dos comandos de usuário
  admin.registerAdminCommands(bot);
  console.log('✅ [BOT-INIT] Comandos do admin registrados');

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

      // Calcular tempo de expiração (30 minutos) - usar fuso horário correto
      const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
      const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      
      // 🆕 Salvar valores antes do setTimeout (ctx pode não estar disponível após 15 min)
      const chatId = ctx.chat.id;
      const reminderAmount = amount;
      const reminderKey = charge.key;
      const reminderCopiaCola = charge.copiaCola;
      
      // Agendar lembretes de pagamento
      // Lembrete aos 15 minutos (15 minutos restantes)
      console.log(`⏰ [LEMBRETE] Agendando lembrete de 15min para TXID: ${txid}, Chat: ${chatId}`);
      setTimeout(async () => {
        try {
          console.log(`⏰ [LEMBRETE] Executando lembrete de 15min para TXID: ${txid}`);
          const trans = await db.getTransactionByTxid(txid);
          // Verificar se ainda está pendente e não paga
          if (trans && trans.status === 'pending') {
            console.log(`✅ [LEMBRETE] Enviando lembrete de 15min para chat ${chatId}, TXID: ${txid}`);
            await bot.telegram.sendMessage(chatId, `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Faltam 15 minutos* para expirar!

💰 Valor: R$ ${reminderAmount}
🔑 Chave: ${reminderKey}

📋 Cópia & Cola:
\`${reminderCopiaCola}\`

⏰ *Expira às:* ${expirationStr}

📸 Após pagar, envie o comprovante.

🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
            console.log(`✅ [LEMBRETE] Lembrete enviado com sucesso para chat ${chatId}`);
          } else {
            console.log(`⏭️ [LEMBRETE] Transação ${txid} não está mais pendente (status: ${trans?.status || 'não encontrada'}) - lembrete não enviado`);
          }
        } catch (err) {
          // Tratar especificamente quando o bot foi bloqueado pelo usuário
          if (err.response && err.response.error_code === 403) {
            console.log(`ℹ️ [LEMBRETE] Bot bloqueado pelo usuário ${chatId} - lembrete não enviado`);
          } else {
            console.error(`❌ [LEMBRETE] Erro no lembrete 15 min para TXID ${txid}:`, err.message);
          }
        }
      }, 15 * 60 * 1000); // 15 minutos
      
      // Aviso de expiração e cancelamento automático aos 30 minutos
      setTimeout(async () => {
        try {
          console.log(`⏰ [EXPIRAÇÃO] Verificando expiração para TXID: ${txid}`);
          const trans = await db.getTransactionByTxid(txid);
          // Se ainda está pendente, cancelar
          if (trans && trans.status === 'pending') {
            console.log(`❌ [EXPIRAÇÃO] Cancelando transação ${txid} por expiração de 30min`);
            await db.cancelTransaction(txid);
            
            try {
              await bot.telegram.sendMessage(chatId, `⏰ *TRANSAÇÃO EXPIRADA*

❌ O prazo de 30 minutos foi atingido.
Esta transação foi cancelada automaticamente.

🔄 *Para comprar novamente:*
1. Use o comando /start
2. Selecione o produto desejado
3. Realize o pagamento em até 30 minutos
4. Envie o comprovante

💰 Valor: R$ ${reminderAmount}
🆔 TXID cancelado: ${txid}`, { parse_mode: 'Markdown' });
              console.log(`✅ [EXPIRAÇÃO] Mensagem de expiração enviada para chat ${chatId}`);
            } catch (sendErr) {
              // Tratar especificamente quando o bot foi bloqueado pelo usuário
              if (sendErr.response && sendErr.response.error_code === 403) {
                console.log(`ℹ️ [EXPIRAÇÃO] Bot bloqueado pelo usuário ${chatId} - mensagem de expiração não enviada`);
              } else {
                console.error(`❌ [EXPIRAÇÃO] Erro ao enviar mensagem de expiração para TXID ${txid}:`, sendErr.message);
              }
            }
          } else {
            console.log(`⏭️ [EXPIRAÇÃO] Transação ${txid} não está mais pendente (status: ${trans?.status || 'não encontrada'}) - cancelamento não necessário`);
          }
        } catch (err) {
          console.error(`❌ [EXPIRAÇÃO] Erro no cancelamento automático para TXID ${txid}:`, err.message);
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

  // ===== MEDIA PACK (Packs de Agora) =====
  bot.action(/buy_media:(.+)/, async (ctx) => {
    try {
      const packId = ctx.match[1];
      
      // Responder imediatamente ao clique
      await ctx.answerCbQuery('⏳ Gerando cobrança PIX...');
      
      // Buscar media pack e usuário em paralelo
      const [pack, user] = await Promise.all([
        db.getMediaPackById(packId),
        db.getOrCreateUser(ctx.from)
      ]);
      
      if (!pack || !pack.is_active) {
        return ctx.reply('❌ Pack não encontrado ou inativo.');
      }
      
      // Usar valor aleatório se houver valores variados, senão usar preço fixo
      let amount;
      if (pack.variable_prices && Array.isArray(pack.variable_prices) && pack.variable_prices.length > 0) {
        // Selecionar valor aleatório do array
        const randomIndex = Math.floor(Math.random() * pack.variable_prices.length);
        amount = pack.variable_prices[randomIndex].toString();
        console.log(`🎲 [MEDIA-PACK] Valor aleatório selecionado: R$ ${amount} (de ${pack.variable_prices.length} opções)`);
      } else {
        // Usar preço fixo
        amount = pack.price.toString();
      }

      // Gerar cobrança PIX
      const resp = await manualPix.createManualCharge({ amount, productId: `media_${packId}` });
      const charge = resp.charge;
      const txid = charge.txid;
      
      // Salvar transação com media_pack_id
      db.createTransaction({
        txid,
        userId: user.id,
        telegramId: ctx.chat.id,
        mediaPackId: packId,
        amount,
        pixKey: charge.key,
        pixPayload: charge.copiaCola
      }).catch(err => console.error('Erro ao salvar transação:', err));

      // Calcular tempo de expiração (30 minutos) - usar fuso horário correto
      const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
      const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      
      // 🆕 Salvar valores antes do setTimeout (ctx pode não estar disponível após 15 min)
      const chatIdMediaPack = ctx.chat.id;
      const reminderAmountMediaPack = amount;
      const reminderKeyMediaPack = charge.key;
      const reminderCopiaColaMediaPack = charge.copiaCola;
      
      // Agendar lembretes de pagamento
      console.log(`⏰ [LEMBRETE-MEDIAPACK] Agendando lembrete de 15min para TXID: ${txid}, Chat: ${chatIdMediaPack}`);
      setTimeout(async () => {
        try {
          console.log(`⏰ [LEMBRETE-MEDIAPACK] Executando lembrete de 15min para TXID: ${txid}`);
          const trans = await db.getTransactionByTxid(txid);
          if (trans && trans.status === 'pending') {
            console.log(`✅ [LEMBRETE-MEDIAPACK] Enviando lembrete de 15min para chat ${chatIdMediaPack}, TXID: ${txid}`);
            await bot.telegram.sendMessage(chatIdMediaPack, `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Faltam 15 minutos* para expirar!

💰 Valor: R$ ${reminderAmountMediaPack}
🔑 Chave: ${reminderKeyMediaPack}

📋 Cópia & Cola:
\`${reminderCopiaColaMediaPack}\`

⏰ *Expira às:* ${expirationStr}

📸 Após pagar, envie o comprovante.

🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
            console.log(`✅ [LEMBRETE-MEDIAPACK] Lembrete enviado com sucesso para chat ${chatIdMediaPack}`);
          } else {
            console.log(`⏭️ [LEMBRETE-MEDIAPACK] Transação ${txid} não está mais pendente (status: ${trans?.status || 'não encontrada'}) - lembrete não enviado`);
          }
        } catch (err) {
          // Tratar especificamente quando o bot foi bloqueado pelo usuário
          if (err.response && err.response.error_code === 403) {
            console.log(`ℹ️ [LEMBRETE-MEDIAPACK] Bot bloqueado pelo usuário ${chatIdMediaPack} - lembrete não enviado`);
          } else {
            console.error(`❌ [LEMBRETE-MEDIAPACK] Erro no lembrete 15 min para TXID ${txid}:`, err.message);
          }
        }
      }, 15 * 60 * 1000);
      
      // Cancelamento automático aos 30 minutos
      setTimeout(async () => {
        try {
          console.log(`⏰ [EXPIRAÇÃO-MEDIAPACK] Verificando expiração para TXID: ${txid}`);
          const trans = await db.getTransactionByTxid(txid);
          if (trans && trans.status === 'pending') {
            console.log(`❌ [EXPIRAÇÃO-MEDIAPACK] Cancelando transação ${txid} por expiração de 30min`);
            await db.cancelTransaction(txid);
            
            try {
              await bot.telegram.sendMessage(chatIdMediaPack, `⏰ *TRANSAÇÃO EXPIRADA*

❌ O prazo de 30 minutos foi atingido.
Esta transação foi cancelada automaticamente.

🔄 *Para comprar novamente:*
1. Use o comando /start
2. Selecione o pack desejado
3. Realize o pagamento em até 30 minutos
4. Envie o comprovante

💰 Valor: R$ ${reminderAmountMediaPack}
🆔 TXID cancelado: ${txid}`, { parse_mode: 'Markdown' });
              console.log(`✅ [EXPIRAÇÃO-MEDIAPACK] Mensagem de expiração enviada para chat ${chatIdMediaPack}`);
            } catch (sendErr) {
              // Tratar especificamente quando o bot foi bloqueado pelo usuário
              if (sendErr.response && sendErr.response.error_code === 403) {
                console.log(`ℹ️ [EXPIRAÇÃO-MEDIAPACK] Bot bloqueado pelo usuário ${chatIdMediaPack} - mensagem de expiração não enviada`);
              } else {
                console.error(`❌ [EXPIRAÇÃO-MEDIAPACK] Erro ao enviar mensagem de expiração para TXID ${txid}:`, sendErr.message);
              }
            }
          } else {
            console.log(`⏭️ [EXPIRAÇÃO-MEDIAPACK] Transação ${txid} não está mais pendente (status: ${trans?.status || 'não encontrada'}) - cancelamento não necessário`);
          }
        } catch (err) {
          console.error(`❌ [EXPIRAÇÃO-MEDIAPACK] Erro no cancelamento automático para TXID ${txid}:`, err.message);
        }
      }, 30 * 60 * 1000);
      
      // Enviar QR Code
      if (charge.qrcodeBuffer) {
        return await ctx.replyWithPhoto(
          { source: charge.qrcodeBuffer },
          {
            caption: `📸 *${pack.name}*

💰 Pague R$ ${amount} usando PIX

🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento
📦 *Entrega:* ${pack.items_per_delivery} itens aleatórios

📸 Após pagar, envie o comprovante (foto) aqui.

🆔 TXID: ${txid}`,
            parse_mode: 'Markdown'
          }
        );
      } else {
        return await ctx.reply(`📸 *${pack.name}*

💰 Pague R$ ${amount} usando PIX

🔑 Chave: ${charge.key}

📋 Cópia & Cola:
\`${charge.copiaCola}\`

⏰ *VÁLIDO ATÉ:* ${expirationStr}
⚠️ *Prazo:* 30 minutos para pagamento
📦 *Entrega:* ${pack.items_per_delivery} itens aleatórios

📸 Envie o comprovante quando pagar.

🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Erro na compra de media pack:', err.message);
      console.error('Stack:', err.stack);
      await ctx.reply('❌ Erro ao gerar cobrança. Tente novamente.');
    }
  });

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
          // Mensagem única com todas as informações + link oculto (gera card automático)
          const zwsp = '\u200B'; // Zero-width space
          const zwnj = '\u200C'; // Zero-width non-joiner
          await ctx.reply(`✅ *Você já é membro!*

👥 Grupo: ${group.group_name}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}

${zwsp}${zwnj}${zwsp}
${group.group_link}
${zwsp}${zwnj}${zwsp}`, {
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          });
          return;
        }
      }
      
      const [user] = await Promise.all([
        db.getOrCreateUser(ctx.from)
      ]);
      
      const amount = group.subscription_price.toString();
      const productId = `group_${group.group_id}`; // Para o manualPix
      
      // Gerar cobrança PIX
      const resp = await manualPix.createManualCharge({ amount, productId });
      const charge = resp.charge;
      const txid = charge.txid;
      
      // 🆕 Salvar transação com referência ao grupo (usando UUID interno do grupo)
      await db.createTransaction({
        txid,
        userId: user.id,
        telegramId: ctx.chat.id,
        groupId: group.id, // 🆕 Usar UUID interno do grupo (não productId)
        amount,
        pixKey: charge.key,
        pixPayload: charge.copiaCola
      }).catch(err => console.error('Erro ao salvar transação:', err));
      
      // Calcular tempo de expiração (30 minutos) - usar fuso horário correto
      const expirationTime = new Date(Date.now() + 30 * 60 * 1000);
      const expirationStr = expirationTime.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      
      // 🆕 Salvar valores antes do setTimeout (ctx pode não estar disponível após 15 min)
      const chatIdGroup = ctx.chat.id;
      const reminderAmountGroup = amount;
      const reminderKeyGroup = charge.key;
      const reminderCopiaColaGroup = charge.copiaCola;
      
      // Agendar lembretes de pagamento (o job também enviará, mas manter setTimeout como backup)
      console.log(`⏰ [LEMBRETE-GROUP] Agendando lembrete de 15min para TXID: ${txid}, Chat: ${chatIdGroup}`);
      setTimeout(async () => {
        try {
          console.log(`⏰ [LEMBRETE-GROUP] Executando lembrete de 15min para TXID: ${txid}`);
          const trans = await db.getTransactionByTxid(txid);
          if (trans && trans.status === 'pending') {
            console.log(`✅ [LEMBRETE-GROUP] Enviando lembrete de 15min para chat ${chatIdGroup}, TXID: ${txid}`);
            await bot.telegram.sendMessage(chatIdGroup, `⏰ *LEMBRETE DE PAGAMENTO*

⚠️ *Faltam 15 minutos* para expirar!

💰 Valor: R$ ${reminderAmountGroup}
🔑 Chave: ${reminderKeyGroup}

📋 Cópia & Cola:
\`${reminderCopiaColaGroup}\`

⏰ *Expira às:* ${expirationStr}

📸 Após pagar, envie o comprovante.

🆔 TXID: ${txid}`, { parse_mode: 'Markdown' });
            console.log(`✅ [LEMBRETE-GROUP] Lembrete enviado com sucesso para chat ${chatIdGroup}`);
          } else {
            console.log(`⏭️ [LEMBRETE-GROUP] Transação ${txid} não está mais pendente (status: ${trans?.status || 'não encontrada'}) - lembrete não enviado`);
          }
        } catch (err) {
          if (err.response && err.response.error_code === 403) {
            console.log(`ℹ️ [LEMBRETE-GROUP] Bot bloqueado pelo usuário ${chatIdGroup} - lembrete não enviado`);
          } else {
            console.error(`❌ [LEMBRETE-GROUP] Erro no lembrete 15 min para TXID ${txid}:`, err.message);
          }
        }
      }, 15 * 60 * 1000); // 15 minutos
      
      // Cancelamento automático aos 30 minutos
      setTimeout(async () => {
        try {
          console.log(`⏰ [EXPIRAÇÃO-GROUP] Verificando expiração para TXID: ${txid}`);
          const trans = await db.getTransactionByTxid(txid);
          if (trans && trans.status === 'pending') {
            console.log(`❌ [EXPIRAÇÃO-GROUP] Cancelando transação ${txid} por expiração de 30min`);
            await db.cancelTransaction(txid);
            
            try {
              await bot.telegram.sendMessage(chatIdGroup, `⏰ *TRANSAÇÃO EXPIRADA*

❌ O prazo de 30 minutos foi atingido.
Esta transação foi cancelada automaticamente.

🔄 *Para assinar novamente:*
1. Use o comando /start
2. Selecione o grupo desejado
3. Realize o pagamento em até 30 minutos
4. Envie o comprovante

💰 Valor: R$ ${reminderAmountGroup}
🆔 TXID cancelado: ${txid}`, { parse_mode: 'Markdown' });
              console.log(`✅ [EXPIRAÇÃO-GROUP] Mensagem de expiração enviada para chat ${chatIdGroup}`);
            } catch (sendErr) {
              if (sendErr.response && sendErr.response.error_code === 403) {
                console.log(`ℹ️ [EXPIRAÇÃO-GROUP] Bot bloqueado pelo usuário ${chatIdGroup} - mensagem de expiração não enviada`);
              } else {
                console.error(`❌ [EXPIRAÇÃO-GROUP] Erro ao enviar mensagem de expiração para TXID ${txid}:`, sendErr.message);
              }
            }
          } else {
            console.log(`⏭️ [EXPIRAÇÃO-GROUP] Transação ${txid} não está mais pendente (status: ${trans?.status || 'não encontrada'}) - cancelamento não necessário`);
          }
        } catch (err) {
          console.error(`❌ [EXPIRAÇÃO-GROUP] Erro no cancelamento automático para TXID ${txid}:`, err.message);
        }
      }, 30 * 60 * 1000); // 30 minutos
      
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

  // ===== SISTEMA DE SUPORTE INTERNO =====
  bot.action('support_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      console.log(`💬 [SUPPORT] Usuário ${ctx.from.id} acessou suporte`);
      
      // Buscar transações pendentes do usuário
      const { data: pendingTransactions, error } = await db.supabase
        .from('transactions')
        .select('*')
        .eq('telegram_id', ctx.from.id)
        .in('status', ['pending', 'proof_sent'])
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Erro ao buscar transações:', error);
      }
      
      const hasPending = pendingTransactions && pendingTransactions.length > 0;
      
      if (hasPending) {
        // TEM TRANSAÇÃO PENDENTE - Pedir comprovante automaticamente
        const transaction = pendingTransactions[0]; // Mais recente
        const createdAt = new Date(transaction.created_at);
        const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60));
        const minutesRemaining = Math.max(0, 30 - minutesAgo);
        
        let statusText = '';
        if (transaction.status === 'pending') {
          statusText = '⏳ *Aguardando pagamento*';
        } else if (transaction.status === 'proof_sent') {
          statusText = '📸 *Comprovante recebido - Em análise*';
        }
        
        const message = `💬 *SUPORTE ON-LINE*

${statusText}

🆔 TXID: \`${transaction.txid}\`
💰 Valor: R$ ${transaction.amount}
⏰ Expira em: ${minutesRemaining} minutos

${transaction.status === 'pending' ? 
`📸 *ENVIE SEU COMPROVANTE:*
Após realizar o pagamento PIX, envie a foto ou PDF do comprovante aqui no chat.

💡 *Dica:* Tire uma foto clara e legível do comprovante.` : 
`✅ Comprovante já foi recebido!
Um admin está analisando e aprovará em breve.`}

❓ *Precisa de ajuda?*
Entre em contato: @suportedireto`;

        const buttons = [];
        
        if (transaction.status === 'pending') {
          buttons.push([Markup.button.callback('🔄 Verificar Status', `check_status:${transaction.txid}`)]);
        }
        
        buttons.push([Markup.button.url('💬 Falar com Suporte', 'https://t.me/suportedireto')]);
        buttons.push([Markup.button.callback('🏠 Voltar ao Menu', 'back_to_start')]);
        
        return ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        });
        
      } else {
        // SEM TRANSAÇÃO PENDENTE - Menu de ajuda
        const message = `💬 *SUPORTE ON-LINE*

👋 Olá! Como posso ajudar?

📋 *Opções disponíveis:*

1️⃣ Fazer uma nova compra
   Use /start e escolha um produto

2️⃣ Ver seus pedidos
   Use /meuspedidos para ver histórico

3️⃣ Renovar assinatura
   Use /renovar para grupos

❓ *Dúvidas frequentes:*
• Quanto tempo demora a entrega?
  → Imediata após aprovação do pagamento

• Como funciona o PIX?
  → Gere o QR Code, pague e envie o comprovante

• Não recebi meu produto
  → Envie seu TXID para @suportedireto

💬 *Falar com atendente:*
Clique no botão abaixo para contato direto`;

        return ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('💬 Falar com Suporte', 'https://t.me/suportedireto')],
            [Markup.button.callback('🏠 Voltar ao Menu', 'back_to_start')]
          ])
        });
      }
      
    } catch (err) {
      console.error('Erro no suporte:', err);
      return ctx.reply('❌ Erro ao carregar suporte. Tente novamente.');
    }
  });
  
  // Handler para verificar status de transação
  bot.action(/^check_status:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Verificando status...');
      
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      const statusEmoji = {
        'pending': '⏳',
        'proof_sent': '📸',
        'validated': '✅',
        'delivered': '✅',
        'expired': '❌',
        'cancelled': '❌'
      };
      
      const statusText = {
        'pending': 'Aguardando pagamento',
        'proof_sent': 'Comprovante em análise',
        'validated': 'Pagamento aprovado',
        'delivered': 'Produto entregue',
        'expired': 'Transação expirada',
        'cancelled': 'Transação cancelada'
      };
      
      return ctx.reply(`📊 *STATUS DA TRANSAÇÃO*

${statusEmoji[transaction.status]} *${statusText[transaction.status]}*

🆔 TXID: \`${txid}\`
💰 Valor: R$ ${transaction.amount}
📅 Criada: ${new Date(transaction.created_at).toLocaleString('pt-BR')}

${transaction.status === 'delivered' ? '✅ Seu produto foi entregue com sucesso!' : 
  transaction.status === 'validated' ? '⏳ Produto será entregue em instantes!' :
  transaction.status === 'proof_sent' ? '📸 Aguarde a análise do comprovante...' :
  transaction.status === 'pending' ? '⏳ Realize o pagamento e envie o comprovante!' :
  '❌ Entre em contato com o suporte: @suportedireto'}`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao verificar status:', err);
      return ctx.reply('❌ Erro ao verificar status.');
    }
  });
  
  // Handler para voltar ao menu inicial
  bot.action('back_to_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      // Buscar dados novamente
      const [products, groups, mediaPacks] = await Promise.all([
        db.getAllProducts(),
        db.getAllGroups(),
        db.getAllMediaPacks()
      ]);
      
      // Gerar botões
      const buttons = products.map(product => {
        const emoji = parseFloat(product.price) >= 50 ? '💎' : '🛍️';
        const buttonText = `${emoji} ${product.name} (R$${parseFloat(product.price).toFixed(2)})`;
        return [Markup.button.callback(buttonText, `buy:${product.product_id}`)];
      });
      
      const activeMediaPacks = mediaPacks.filter(p => p.is_active);
      for (const pack of activeMediaPacks) {
        buttons.push([Markup.button.callback(pack.name, `buy_media:${pack.pack_id}`)]);
      }
      
      // Adicionar botões de grupos ativos (um botão por grupo, usando o nome cadastrado)
      const activeGroups = groups.filter(g => g.is_active);
      for (const group of activeGroups) {
        // Usar o nome do grupo cadastrado no admin, ou um padrão se não tiver nome
        const groupButtonText = group.group_name || `👥 Grupo (R$${parseFloat(group.subscription_price).toFixed(2)}/mês)`;
        buttons.push([Markup.button.callback(groupButtonText, `subscribe:${group.group_id}`)]);
      }
      
      buttons.push([Markup.button.callback('💬 Suporte On-line', 'support_menu')]);
      
      const text = `👋 Olá! Bem-vindo ao Bot da Val 🌶️🔥\n\nEscolha uma opção abaixo:`;
      
      return ctx.editMessageText(text, Markup.inlineKeyboard(buttons));
      
    } catch (err) {
      console.error('Erro ao voltar ao menu:', err);
      return ctx.reply('Use /start para ver o menu novamente.');
    }
  });

  // Integrar controle de grupos
  const groupControl = require('./groupControl');
  groupControl.startGroupControl(bot);

  return bot;
}

module.exports = { createBot };

