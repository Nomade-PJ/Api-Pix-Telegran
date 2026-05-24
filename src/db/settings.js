// src/admin/settings.js
const db = require('../database');
const deliver = require('../deliver');

function registerSettingsHandlers(bot) {
  // ===== GERENCIAR DDDs BLOQUEADOS =====
  
  bot.command('ddds', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    try {
      const blockedDDDs = await db.getBlockedAreaCodes();
      
      let message = `🚫 *DDDs BLOQUEADOS*\n\n`;
      
      if (blockedDDDs.length === 0) {
        message += `Nenhum DDD bloqueado no momento.\n\n`;
      } else {
        for (const ddd of blockedDDDs) {
          message += `📍 *${ddd.area_code}* - ${ddd.state}\n`;
          if (ddd.reason) {
            message += `   └ ${ddd.reason}\n`;
          }
        }
        message += `\n`;
      }
      
      message += `*Comandos:*\n`;
      message += `➕ /addddd <DDD> <Estado> <Motivo> - Bloquear DDD\n`;
      message += `➖ /removeddd <DDD> - Desbloquear DDD\n\n`;
      message += `*Exemplo:*\n`;
      message += `/addddd 11 São Paulo Região não atendida`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar DDDs:', err);
      return ctx.reply('❌ Erro ao buscar DDDs bloqueados.');
    }
  });
  
  bot.command('addddd', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    try {
      // Extrair argumentos: /addddd 11 São Paulo Região não atendida
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length < 2) {
        return ctx.reply(
          '❌ *Uso incorreto*\n\n' +
          'Formato: `/addddd <DDD> <Estado> [Motivo]`\n\n' +
          '*Exemplo:*\n' +
          '`/addddd 98 Maranhão Região não atendida`',
          { parse_mode: 'Markdown' }
        );
      }
      
      const areaCode = args[0];
      const state = args[1];
      const reason = args.slice(2).join(' ') || 'Região não atendida';
      
      // Validar DDD (2 dígitos)
      if (!/^\d{2}$/.test(areaCode)) {
        return ctx.reply('❌ DDD inválido. Use 2 dígitos (ex: 11, 98, 86)');
      }
      
      // Verificar se já existe
      const isBlocked = await db.isAreaCodeBlocked(areaCode);
      if (isBlocked) {
        return ctx.reply(`⚠️ DDD ${areaCode} já está bloqueado.`);
      }
      
      // Adicionar
      const result = await db.addBlockedAreaCode(areaCode, state, reason);
      
      if (result) {
        return ctx.reply(
          `✅ *DDD Bloqueado*\n\n` +
          `📍 DDD: ${areaCode}\n` +
          `📌 Estado: ${state}\n` +
          `💬 Motivo: ${reason}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        return ctx.reply('❌ Erro ao bloquear DDD.');
      }
    } catch (err) {
      console.error('Erro ao adicionar DDD:', err);
      return ctx.reply('❌ Erro ao bloquear DDD.');
    }
  });
  
  bot.command('removeddd', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    try {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length === 0) {
        return ctx.reply(
          '❌ *Uso incorreto*\n\n' +
          'Formato: `/removeddd <DDD>`\n\n' +
          '*Exemplo:*\n' +
          '`/removeddd 98`',
          { parse_mode: 'Markdown' }
        );
      }
      
      const areaCode = args[0];
      
      // Validar DDD
      if (!/^\d{2}$/.test(areaCode)) {
        return ctx.reply('❌ DDD inválido. Use 2 dígitos (ex: 11, 98, 86)');
      }
      
      // Verificar se existe
      const isBlocked = await db.isAreaCodeBlocked(areaCode);
      if (!isBlocked) {
        return ctx.reply(`⚠️ DDD ${areaCode} não está bloqueado.`);
      }
      
      // Remover
      const success = await db.removeBlockedAreaCode(areaCode);
      
      if (success) {
        return ctx.reply(
          `✅ *DDD Desbloqueado*\n\n` +
          `📍 DDD ${areaCode} foi removido da lista de bloqueios.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        return ctx.reply('❌ Erro ao desbloquear DDD.');
      }
    } catch (err) {
      console.error('Erro ao remover DDD:', err);
      return ctx.reply('❌ Erro ao desbloquear DDD.');
    }
  });

  // ===== GERENCIAMENTO DE BLOQUEIOS INDIVIDUAIS =====
  
  // Handler do botão "Gerenciar Bloqueios"
  bot.action('admin_manage_blocks', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const message = `🔓 *GERENCIAR BLOQUEIOS DE USUÁRIOS*

Você pode bloquear ou desbloquear usuários específicos pelo ID do Telegram.

🟢 *DESBLOQUEAR:* Libera acesso mesmo com DDD bloqueado
🔴 *BLOQUEAR:* Impede acesso aos produtos

Escolha uma ação:`;

    try {
      return await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🟢 Desbloquear Usuário', 'block_action_unblock'),
            Markup.button.callback('🔴 Bloquear Usuário', 'block_action_block')
          ],
          [
            Markup.button.callback('🔍 Verificar Status', 'block_action_check')
          ],
          [
            Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
          ]
        ])
      });
    } catch (err) {
      // Ignorar erro se mensagem já é a mesma (usuário clicou duas vezes)
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [MANAGE-BLOCKS] Mensagem já está atualizada, ignorando erro');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Desbloquear Usuário
  bot.action('block_action_unblock', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Criar sessão
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'unblock_user',
      step: 'waiting_id'
    };
    
    try {
      return await ctx.editMessageText(
        `🟢 *DESBLOQUEAR USUÁRIO*

Digite o *ID do Telegram* do usuário que deseja desbloquear:

💡 *Como obter o ID:*
• Peça ao usuário para enviar /start no bot
• Ou use @userinfobot no Telegram
• O ID aparece nos logs quando o usuário interage

_Cancelar:_ /cancelar`, 
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_block_action')]
          ])
        }
      );
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [UNBLOCK-ACTION] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Bloquear Usuário
  bot.action('block_action_block', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Criar sessão
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'block_user',
      step: 'waiting_id'
    };
    
    try {
      return await ctx.editMessageText(
        `🔴 *BLOQUEAR USUÁRIO*

Digite o *ID do Telegram* do usuário que deseja bloquear:

⚠️ *Atenção:* O usuário não verá mais os produtos disponíveis.

💡 *Como obter o ID:*
• Peça ao usuário para enviar /start no bot
• Ou use @userinfobot no Telegram
• O ID aparece nos logs quando o usuário interage

_Cancelar:_ /cancelar`, 
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_block_action')]
          ])
        }
      );
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [BLOCK-ACTION] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Verificar Status
  bot.action('block_action_check', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Criar sessão
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'check_block_status',
      step: 'waiting_id'
    };
    
    try {
      return await ctx.editMessageText(
        `🔍 *VERIFICAR STATUS DE BLOQUEIO*

Digite o *ID do Telegram* do usuário:

_Cancelar:_ /cancelar`, 
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_block_action')]
          ])
        }
      );
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [CHECK-STATUS] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Cancelar ação de bloqueio
  bot.action('cancel_block_action', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    
    // Limpar sessão
    if (global._SESSIONS && global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    
    // Voltar ao menu de bloqueios
    return bot.handleUpdate({ 
      ...ctx.update, 
      callback_query: { 
        ...ctx.update.callback_query, 
        data: 'admin_manage_blocks' 
      } 
    });
  });
  
  // Handler para responder tickets e criar respostas automáticas (admin) - ANTES do handler de bloqueio
  bot.on('text', async (ctx, next) => {
    const session = global._SESSIONS?.[ctx.from.id];
    
    // 🆕 DEBUG: Log para verificar se o handler está sendo executado
    console.log(`🔍 [ADMIN-TEXT-HANDLER] Handler executado para usuário ${ctx.from.id}`);
    console.log(`🔍 [ADMIN-TEXT-HANDLER] Sessão: ${session ? session.type : 'nenhuma'}`);
    if (session && session.type === 'admin_reply_ticket') {
      console.log(`🔍 [ADMIN-REPLY-TICKET] Handler executado para usuário ${ctx.from.id}, ticket: ${session.ticketId}`);
      console.log(`🔍 [ADMIN-REPLY-TICKET] Mensagem: ${ctx.message.text?.substring(0, 50)}`);
    }
    
    // Handler para responder ticket (admin) - VERIFICAR PRIMEIRO
    if (session && session.type === 'admin_reply_ticket') {
      if (ctx.message.text.startsWith('/')) {
        if (ctx.message.text === '/cancelar') {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Operação cancelada.');
        }
        return next();
      }
      
      try {
        console.log(`✅ [ADMIN-REPLY-TICKET] Processando resposta do ticket ${session.ticketId}`);
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Acesso negado.');
        }
        
        const ticketId = session.ticketId;
        const user = await db.getUserByTelegramId(ctx.from.id);
        const ticket = await db.getSupportTicket(ticketId);
        
        if (!ticket) {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Ticket não encontrado.');
        }
        
        console.log(`✅ [ADMIN-REPLY-TICKET] Adicionando mensagem ao ticket ${ticketId}`);
        // Adicionar mensagem do admin
        await db.addTicketMessage(ticketId, user.id, ctx.message.text, true);
        
        // Atualizar status se estiver aberto
        if (ticket.status === 'open') {
          await db.updateTicketStatus(ticketId, 'in_progress', user.id);
        }
        
        delete global._SESSIONS[ctx.from.id];
        
        // Notificar usuário
        try {
          // Escapar caracteres Markdown na mensagem do admin
          const escapeMarkdown = (text) => {
            if (!text) return '';
            return String(text)
              .replace(/\*/g, '\\*')
              .replace(/_/g, '\\_')
              .replace(/\[/g, '\\[')
              .replace(/\]/g, '\\]')
              .replace(/\(/g, '\\(')
              .replace(/\)/g, '\\)')
              .replace(/~/g, '\\~')
              .replace(/`/g, '\\`');
          };
          
          const ticketNumber = escapeMarkdown(ticket.ticket_number);
          const adminMessage = escapeMarkdown(ctx.message.text);
          
          console.log(`✅ [ADMIN-REPLY-TICKET] Notificando usuário ${ticket.telegram_id}`);
          await ctx.telegram.sendMessage(ticket.telegram_id, 
            `💬 *Nova resposta no seu ticket*\n\n📋 Ticket: ${ticketNumber}\n\n👨\\u200d💼 *Admin:*\n${adminMessage}\n\n💬 Use /suporte para ver seus tickets.`, {
              parse_mode: 'Markdown'
            });
        } catch (err) {
          console.error('❌ [ADMIN-REPLY-TICKET] Erro ao notificar usuário:', err);
        }
        
        const ticketNumber = (ticket.ticket_number || '').replace(/\*/g, '\\*').replace(/_/g, '\\_');
        
        console.log(`✅ [ADMIN-REPLY-TICKET] Resposta enviada com sucesso!`);
        return ctx.reply(`✅ Resposta enviada ao ticket ${ticketNumber}!`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 Ver Ticket', callback_data: `admin_view_ticket_${ticketId}` }
            ]]
          }
        });
      } catch (err) {
        console.error('❌ [ADMIN-REPLY-TICKET] Erro ao responder:', err);
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Erro ao responder ticket.');
      }
    }
    
    // Handler para criar resposta automática
    if (session && session.type === 'add_auto_response') {
      if (ctx.message.text.startsWith('/')) {
        if (ctx.message.text === '/cancelar') {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Operação cancelada.');
        }
        return next();
      }
      
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Acesso negado.');
      }
      
      if (session.step === 'keyword') {
        session.data = { keyword: ctx.message.text };
        session.step = 'response';
        
        return ctx.reply(`🤖 *NOVA RESPOSTA AUTOMÁTICA*

📝 *Passo 2/3: Resposta*

Digite a resposta que será enviada quando alguém usar a palavra-chave "${session.data.keyword}":

_Cancelar: /cancelar`, {
          parse_mode: 'Markdown'
        });
      } else if (session.step === 'response') {
        session.data.response = ctx.message.text;
        session.step = 'priority';
        
        return ctx.reply(`🤖 *NOVA RESPOSTA AUTOMÁTICA*

📝 *Passo 3/3: Prioridade*

Digite a prioridade (0-100, maior = mais importante):

_Cancelar: /cancelar`, {
          parse_mode: 'Markdown'
        });
      } else if (session.step === 'priority') {
        try {
          const priority = parseInt(ctx.message.text) || 0;
          
          await db.createAutoResponse(
            session.data.keyword,
            session.data.response,
            priority
          );
          
          delete global._SESSIONS[ctx.from.id];
          
          return ctx.reply(`✅ *Resposta automática criada!*

📝 *Palavra-chave:* ${session.data.keyword}
💬 *Resposta:* ${session.data.response.substring(0, 100)}${session.data.response.length > 100 ? '...' : ''}
📊 *Prioridade:* ${priority}

A resposta será ativada automaticamente quando alguém usar essa palavra-chave.`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🤖 Ver Respostas', callback_data: 'admin_auto_responses' }
              ]]
            }
          });
        } catch (err) {
          console.error('❌ [ADMIN-AUTO-RESPONSES] Erro:', err);
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Erro ao criar resposta automática.');
        }
      }
      return;
    }
    
    // Se não for nenhuma sessão admin conhecida, passar para próximo handler
    return next();
  });
  
  // Interceptar texto quando em sessão de bloqueio
  bot.on('text', async (ctx, next) => {
    console.log('🔍 [BLOCK-HANDLER] Handler de bloqueio executado');
    
    // Verificar se está em sessão de bloqueio
    const session = global._SESSIONS && global._SESSIONS[ctx.from.id];
    
    console.log('🔍 [BLOCK-HANDLER] Sessão encontrada:', session ? session.type : 'nenhuma');
    
    if (!session || !['unblock_user', 'block_user', 'check_block_status'].includes(session.type)) {
      console.log('🔍 [BLOCK-HANDLER] Não é sessão de bloqueio, passando para próximo handler');
      return next(); // Passar para próximo handler
    }
    
    console.log('✅ [BLOCK-HANDLER] Sessão de bloqueio detectada:', session.type);
    
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) {
      console.log('❌ [BLOCK-HANDLER] Usuário não é admin');
      delete global._SESSIONS[ctx.from.id];
      return;
    }
    
    // Cancelar
    if (ctx.message.text === '/cancelar') {
      console.log('❌ [BLOCK-HANDLER] Operação cancelada pelo usuário');
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Operação cancelada. Use /admin para voltar ao painel.');
    }
    
    // Processar ID
    const telegramId = parseInt(ctx.message.text.trim());
    
    console.log('📋 [BLOCK-HANDLER] ID recebido:', ctx.message.text.trim(), '→ Parsed:', telegramId);
    
    if (isNaN(telegramId) || telegramId <= 0) {
      console.log('❌ [BLOCK-HANDLER] ID inválido');
      return ctx.reply('❌ ID inválido. Digite apenas números.\n\nExemplo: `123456789`\n\n_Cancelar:_ /cancelar', {
        parse_mode: 'Markdown'
      });
    }
    
    try {
      if (session.type === 'unblock_user') {
        // DESBLOQUEAR
        await ctx.reply('⏳ Desbloqueando usuário...');
        
        const user = await db.unblockUserByTelegramId(telegramId);
        
        delete global._SESSIONS[ctx.from.id];
        
        return ctx.reply(
          `✅ *USUÁRIO DESBLOQUEADO COM SUCESSO!*

🆔 *ID:* \`${telegramId}\`
👤 *Nome:* ${user.first_name || 'N/A'}
📱 *Username:* @${user.username || 'N/A'}
🔓 *Status:* Desbloqueado

O usuário agora pode acessar todos os produtos, mesmo se o DDD dele estiver bloqueado.

Use /admin para voltar ao painel.`, 
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
            ])
          }
        );
        
      } else if (session.type === 'block_user') {
        // BLOQUEAR
        console.log(`🔴 [BLOCK-HANDLER] Iniciando bloqueio do usuário ${telegramId}`);
        await ctx.reply('⏳ Bloqueando usuário...');
        
        console.log(`📤 [BLOCK-HANDLER] Chamando db.blockUserByTelegramId(${telegramId})`);
        const user = await db.blockUserByTelegramId(telegramId);
        console.log(`✅ [BLOCK-HANDLER] Usuário bloqueado:`, user);
        
        delete global._SESSIONS[ctx.from.id];
        
        // Enviar mensagem de bloqueio ao usuário
        try {
          await ctx.telegram.sendMessage(
            telegramId,
            '⚠️ *Serviço Temporariamente Indisponível*\n\n' +
            'No momento, não conseguimos processar seu acesso.\n\n' +
            'Estamos trabalhando para expandir nosso atendimento em breve!',
            { 
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            }
          );
        } catch (notifyErr) {
          console.log('ℹ️ [BLOCK] Não foi possível notificar usuário (pode ter bloqueado o bot)');
        }
        
        return ctx.reply(
          `🔴 *USUÁRIO BLOQUEADO COM SUCESSO!*

🆔 *ID:* \`${telegramId}\`
👤 *Nome:* ${user.first_name || 'N/A'}
📱 *Username:* @${user.username || 'N/A'}
🔒 *Status:* Bloqueado

O usuário não poderá mais acessar os produtos.
Ele receberá a mensagem de "Serviço Indisponível".

Use /admin para voltar ao painel.`, 
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
            ])
          }
        );
        
      } else if (session.type === 'check_block_status') {
        // VERIFICAR STATUS
        await ctx.reply('⏳ Verificando status...');
        
        const user = await db.checkBlockStatus(telegramId);
        
        delete global._SESSIONS[ctx.from.id];
        
        if (!user) {
          return ctx.reply(
            `ℹ️ *USUÁRIO NÃO ENCONTRADO*

🆔 *ID:* \`${telegramId}\`

Este usuário ainda não interagiu com o bot.

💡 *O que fazer:*
• Peça ao usuário para enviar /start no bot
• Depois você poderá bloquear/desbloquear

Use /admin para voltar ao painel.`, 
            { 
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
              ])
            }
          );
        }
        
        const ddd = user.phone_number ? db.extractAreaCode(user.phone_number) : 'N/A';
        const statusEmoji = user.is_blocked ? '🔴' : '🟢';
        const statusText = user.is_blocked ? 'BLOQUEADO' : 'DESBLOQUEADO';
        
        return ctx.reply(
          `${statusEmoji} *STATUS DO USUÁRIO*

🆔 *ID:* \`${telegramId}\`
👤 *Nome:* ${user.first_name || 'N/A'}
📱 *Username:* @${user.username || 'N/A'}
📞 *Telefone:* ${user.phone_number || 'N/A'}
📍 *DDD:* ${ddd}
${statusEmoji} *Status:* ${statusText}

Use /admin para voltar ao painel.`, 
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(user.is_blocked ? '🟢 Desbloquear' : '🔴 Bloquear', user.is_blocked ? 'block_action_unblock' : 'block_action_block')
              ],
              [
                Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
              ]
            ])
          }
        );
      }
      
    } catch (err) {
      console.error('❌ [BLOCK-HANDLER] Erro:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply(
        `❌ *ERRO AO PROCESSAR*

Erro: ${err.message}

Use /admin para voltar ao painel.`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // ============================================================
  // ROTAÇÃO PIX — Configuração de chave secundária e regras
  // ============================================================

  bot.action('admin_pix_config', async (ctx) => {
    try {
      const { data: cfg, error } = await db.supabase.from('pix_settings').select('*').single();
      if (error || !cfg) return ctx.answerCbQuery('❌ Tabela pix_settings não encontrada.', { show_alert: true });

      const statusSec  = cfg.secondary_active ? '🟢 ATIVA' : '🔴 INATIVA';
      const statusRot  = cfg.rotation_enabled ? `🟢 A cada ${cfg.rotation_interval} transações` : '🔴 Desativada';
      const statusAcum = cfg.accumulated_rule_enabled ? `🟢 Acima de R$ ${parseFloat(cfg.accumulated_min_value).toFixed(2)}` : '🔴 Desativada';
      const statusDist = cfg.smart_distribution_enabled ? `🟢 ${cfg.secondary_percentage}% na secundária` : '🔴 Desativada';

      const msg =
        `💳 *ROTAÇÃO PIX*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 *Chave Principal:*\n` +
        `\`${cfg.primary_pix_key || 'Não configurada'}\`\n` +
        `👤 ${cfg.primary_holder || '-'} | 🏦 ${cfg.primary_bank || '-'}\n\n` +
        `📌 *Chave Secundária:* ${statusSec}\n` +
        `\`${cfg.secondary_pix_key || 'Não configurada'}\`\n` +
        `👤 ${cfg.secondary_holder || '-'} | 🏦 ${cfg.secondary_bank || '-'}\n\n` +
        `⚙️ *Regras de Rotação:*\n` +
        `🔄 Por quantidade: ${statusRot}\n` +
        `💰 Por acumulado: ${statusAcum}\n` +
        `📊 Distribuição: ${statusDist}\n` +
        `📈 Contador atual: *${cfg.transaction_counter}* transações`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📝 Configurar Chave Secundária', 'pix_edit_secondary')],
        [
          cfg.secondary_active
            ? Markup.button.callback('🔴 Desativar Secundária', 'pix_secondary_off')
            : Markup.button.callback('🟢 Ativar Secundária', 'pix_secondary_on')
        ],
        [Markup.button.callback('⚙️ Regras de Rotação', 'pix_rotation_rules')],
        [Markup.button.callback('📊 Ver Log de Uso', 'pix_view_log')],
        [Markup.button.callback('🔄 Zerar Contador', 'pix_reset_counter')],
        [Markup.button.callback('🏠 Voltar ao Painel', 'admin_refresh')]
      ]);

      return ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
    } catch (err) {
      console.error('Erro admin_pix_config:', err);
      return ctx.answerCbQuery('❌ Erro ao carregar configuração PIX.', { show_alert: true });
    }
  });

  // ── Excluir chave secundária ───────────────────────────────
  bot.action('pix_delete_secondary', async (ctx) => {
    const { data: cfg } = await db.supabase.from('pix_settings').select('secondary_pix_key').single();

    if (!cfg?.secondary_pix_key?.trim()) {
      return ctx.answerCbQuery('📭 Nenhuma chave secundária cadastrada.', { show_alert: true });
    }

    return ctx.editMessageText(
      `🗑️ *Excluir Chave PIX Secundária*\n\n` +
      `Tem certeza que deseja excluir?\n\n` +
      `🔑 Chave: \`${cfg.secondary_pix_key}\`\n\n` +
      `⚠️ Essa ação irá remover e desativar a chave secundária.`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ Sim, excluir', 'pix_delete_secondary_confirm')],
          [Markup.button.callback('❌ Cancelar', 'admin_pix_config')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_delete_secondary_confirm', async (ctx) => {
    try {
      await db.supabase.from('pix_settings').update({
        secondary_pix_key:          '',
        secondary_holder:           '',
        secondary_bank:             '',
        secondary_active:           false,
        rotation_enabled:           false,
        accumulated_rule_enabled:   false,
        smart_distribution_enabled: false,
        transaction_counter:        0,
        updated_at: new Date().toISOString()
      }).eq('id', 1);

      await ctx.answerCbQuery('✅ Chave secundária excluída!');
      return ctx.editMessageText(
        `✅ *Chave secundária removida com sucesso!*\n\n` +
        `Todos os pagamentos voltarão para a chave principal.\n\n` +
        `Para cadastrar uma nova chave, use *Configurar Chave Secundária*.`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Voltar à Rotação PIX', 'admin_pix_config')]
          ]).reply_markup
        }
      );
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao excluir. Tente novamente.', { show_alert: true });
    }
  });

  // ── Ativar chave secundária ────────────────────────────────
  bot.action('pix_secondary_on', async (ctx) => {
    try {
      const { data: cfg } = await db.supabase.from('pix_settings').select('secondary_pix_key').single();
      if (!cfg?.secondary_pix_key?.trim()) {
        return ctx.answerCbQuery('❌ Configure a chave secundária antes de ativar!', { show_alert: true });
      }
      await db.supabase.from('pix_settings').update({ secondary_active: true, updated_at: new Date().toISOString() }).eq('id', 1);
      await ctx.answerCbQuery('✅ Chave secundária ATIVADA!');
      // Recarregar tela
      const fakeCtx = { ...ctx, editMessageText: ctx.editMessageText };
      return bot.action['admin_pix_config']?.(ctx) || ctx.reply('✅ Ativada! Use /admin → Rotação PIX para ver.');
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao ativar.', { show_alert: true });
    }
  });

  // ── Desativar chave secundária ─────────────────────────────
  bot.action('pix_secondary_off', async (ctx) => {
    try {
      await db.supabase.from('pix_settings').update({ secondary_active: false, updated_at: new Date().toISOString() }).eq('id', 1);
      await ctx.answerCbQuery('🔴 Chave secundária DESATIVADA!');
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao desativar.', { show_alert: true });
    }
  });

  // ── Configurar chave secundária — tela de opções ──────────
  bot.action('pix_edit_secondary', async (ctx) => {
    try {
      const { data: cfg } = await db.supabase.from('pix_settings').select('secondary_pix_key, secondary_holder, secondary_bank').single();
      const temChave = cfg?.secondary_pix_key?.trim();

      let msg = `📝 *CHAVE PIX SECUNDÁRIA*\n\n`;
      if (temChave) {
        msg += `🔑 Atual: \`${cfg.secondary_pix_key}\`\n`;
        msg += `👤 ${cfg.secondary_holder || '-'} | 🏦 ${cfg.secondary_bank || '-'}\n\n`;
        msg += `O que deseja fazer?`;
      } else {
        msg += `Nenhuma chave cadastrada ainda.\n\nDeseja cadastrar uma nova chave?`;
      }

      const buttons = [
        [Markup.button.callback('➕ Cadastrar Nova Chave', 'pix_setup_start')]
      ];
      if (temChave) {
        buttons.push([Markup.button.callback('🗑️ Excluir Chave Secundária', 'pix_delete_secondary')]);
      }
      buttons.push([Markup.button.callback('◀️ Voltar', 'admin_pix_config')]);

      return ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao carregar.', { show_alert: true });
    }
  });

  // ── Iniciar wizard de cadastro ─────────────────────────────
  bot.action('pix_setup_start', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_setup', step: 'chave', data: {} };

    return ctx.editMessageText(
      `📝 *Cadastrar Chave PIX Secundária*\n\n` +
      `*Etapa 1 de 3 — Chave PIX*\n\n` +
      `Digite a chave PIX da conta secundária:\n\n` +
      `_Aceito: email, CPF, telefone ou chave aleatória (UUID)_`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_setup_cancel', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    delete global._SESSIONS[ctx.from.id];
    await ctx.answerCbQuery('❌ Configuração cancelada.');
    return ctx.deleteMessage().catch(() => {});
  });

  // ── Confirmar e salvar ─────────────────────────────────────
  bot.action('pix_setup_confirm', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'pix_setup') {
      return ctx.answerCbQuery('❌ Sessão expirada. Tente novamente.', { show_alert: true });
    }

    const d = session.data;
    try {
      await db.supabase.from('pix_settings').update({
        secondary_pix_key: d.chave,
        secondary_holder:  d.nome,
        secondary_bank:    d.banco,
        updated_at: new Date().toISOString()
      }).eq('id', 1);

      delete global._SESSIONS[ctx.from.id];
      await ctx.answerCbQuery('✅ Chave secundária salva!');
      return ctx.editMessageText(
        `✅ *Chave PIX Secundária configurada com sucesso!*\n\n` +
        `🔑 Chave: \`${d.chave}\`\n` +
        `👤 Recebedor: ${d.nome}\n` +
        `🏦 Banco: ${d.banco}\n\n` +
        `Agora vá em *Rotação PIX → 🟢 Ativar Secundária* para começar a usar.`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Ir para Rotação PIX', 'admin_pix_config')]
          ]).reply_markup
        }
      );
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao salvar. Tente novamente.', { show_alert: true });
    }
  });

  // ── Botões Voltar do wizard ────────────────────────────────
  bot.action('pix_setup_back_chave', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      global._SESSIONS[ctx.from.id].step = 'chave';
      global._SESSIONS[ctx.from.id].data = {};
    }
    await ctx.answerCbQuery();
    return ctx.editMessageText(
      `📝 *Configurar Chave PIX Secundária*\n\n` +
      `*Etapa 1 de 3*\n\n` +
      `Digite a *chave PIX* da conta secundária:\n\n` +
      `_Pode ser email, CPF, telefone ou chave aleatória (UUID)_`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_setup_back_nome', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      global._SESSIONS[ctx.from.id].step = 'nome';
    }
    await ctx.answerCbQuery();
    const d = global._SESSIONS[ctx.from.id]?.data || {};
    return ctx.editMessageText(
      `✅ Chave: \`${d.chave || ''}\`\n\n` +
      `*Etapa 2 de 3*\n\n` +
      `Digite o *nome do recebedor* desta conta:`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Voltar', 'pix_setup_back_chave'), Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_setup_back_banco', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      global._SESSIONS[ctx.from.id].step = 'banco';
    }
    await ctx.answerCbQuery();
    const d = global._SESSIONS[ctx.from.id]?.data || {};
    return ctx.editMessageText(
      `✅ Nome: *${d.nome || ''}*\n\n` +
      `*Etapa 3 de 3*\n\n` +
      `Digite o *nome do banco* desta conta:\n\n` +
      `_Exemplos: Nubank, Itaú, Bradesco, Caixa, Inter..._`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Voltar', 'pix_setup_back_nome'), Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
        ]).reply_markup
      }
    );
  });

  // ── Regras de rotação ──────────────────────────────────────
  bot.action('pix_rotation_rules', async (ctx) => {
    try {
      return reloadRotationScreen(ctx);
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro.', { show_alert: true });
    }
  });

  // ── Toggles com recarregamento automático da tela ────────────
  async function reloadRotationScreen(ctx) {
    const { data: cfg } = await db.supabase.from('pix_settings').select('*').single();
    const keyboard = Markup.inlineKeyboard([
      [cfg.rotation_enabled
        ? Markup.button.callback('🔴 Desativar Rotação por N trans.', 'pix_rot_off')
        : Markup.button.callback('🟢 Ativar Rotação por N trans.', 'pix_rot_on')
      ],
      [cfg.accumulated_rule_enabled
        ? Markup.button.callback('🔴 Desativar Regra Acumulado', 'pix_acum_off')
        : Markup.button.callback('🟢 Ativar Regra Acumulado', 'pix_acum_on')
      ],
      [cfg.smart_distribution_enabled
        ? Markup.button.callback('🔴 Desativar Distribuição %', 'pix_dist_off')
        : Markup.button.callback('🟢 Ativar Distribuição %', 'pix_dist_on')
      ],
      [Markup.button.callback(`🔢 Intervalo: ${cfg.rotation_interval} trans.`, 'pix_set_interval')],
      [Markup.button.callback(`💰 Valor mínimo: R$ ${parseFloat(cfg.accumulated_min_value).toFixed(2)}`, 'pix_set_accum')],
      [Markup.button.callback(`📊 % Secundária: ${cfg.secondary_percentage}%`, 'pix_set_percentage')],
      [Markup.button.callback('◀️ Voltar', 'admin_pix_config')]
    ]);

    const rotStatus  = cfg.rotation_enabled ? `🟢 Ativa (a cada ${cfg.rotation_interval} trans.)` : '🔴 Desativada';
    const acumStatus = cfg.accumulated_rule_enabled ? `🟢 Ativa (acima de R$ ${parseFloat(cfg.accumulated_min_value).toFixed(2)})` : '🔴 Desativada';
    const distStatus = cfg.smart_distribution_enabled ? `🟢 Ativa (${cfg.secondary_percentage}% na secundária)` : '🔴 Desativada';

    return ctx.editMessageText(
      `⚙️ *REGRAS DE ROTAÇÃO PIX*

` +
      `🔄 Rotação por N trans.: ${rotStatus}
` +
      `💰 Regra acumulado: ${acumStatus}
` +
      `📊 Distribuição %: ${distStatus}

` +
      `_Toque para ativar ou desativar cada regra:_`,
      { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup }
    );
  }

  bot.action('pix_rot_on',   async (ctx) => { await db.supabase.from('pix_settings').update({ rotation_enabled: true,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('🟢 Rotação ativada!'); return reloadRotationScreen(ctx); });
  bot.action('pix_rot_off',  async (ctx) => { await db.supabase.from('pix_settings').update({ rotation_enabled: false, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('🔴 Rotação desativada!'); return reloadRotationScreen(ctx); });
  bot.action('pix_acum_on',  async (ctx) => { await db.supabase.from('pix_settings').update({ accumulated_rule_enabled: true,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('🟢 Acumulado ativado!'); return reloadRotationScreen(ctx); });
  bot.action('pix_acum_off', async (ctx) => { await db.supabase.from('pix_settings').update({ accumulated_rule_enabled: false, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('🔴 Acumulado desativado!'); return reloadRotationScreen(ctx); });
  bot.action('pix_dist_on',  async (ctx) => { await db.supabase.from('pix_settings').update({ smart_distribution_enabled: true,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('🟢 Distribuição ativada!'); return reloadRotationScreen(ctx); });
  bot.action('pix_dist_off', async (ctx) => { await db.supabase.from('pix_settings').update({ smart_distribution_enabled: false, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('🔴 Distribuição desativada!'); return reloadRotationScreen(ctx); });

  // ── Definir intervalo — wizard por etapas ────────────────
  bot.action('pix_set_interval', async (ctx) => {
    const { data: cfg } = await db.supabase.from('pix_settings').select('rotation_interval').single();
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_rule', rule: 'interval' };

    return ctx.editMessageText(
      `🔢 *Definir Intervalo de Rotação*\n\n` +
      `📌 *O que é:* A cada X vendas aprovadas, UMA vai para a chave secundária.\n\n` +
      `📊 *Valor atual:* ${cfg?.rotation_interval || 8} transações\n\n` +
      `Digite o novo número de transações:\n` +
      `_Recomendado: entre 5 e 15_`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('5 trans.', 'pix_interval_5'), Markup.button.callback('8 trans.', 'pix_interval_8'), Markup.button.callback('10 trans.', 'pix_interval_10')],
          [Markup.button.callback('✏️ Digitar outro valor', 'pix_interval_custom')],
          [Markup.button.callback('◀️ Voltar', 'pix_rotation_rules')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_interval_5',  async (ctx) => { await db.supabase.from('pix_settings').update({ rotation_interval: 5,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Intervalo: 5 transações!'); return reloadRotationScreen(ctx); });
  bot.action('pix_interval_8',  async (ctx) => { await db.supabase.from('pix_settings').update({ rotation_interval: 8,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Intervalo: 8 transações!'); return reloadRotationScreen(ctx); });
  bot.action('pix_interval_10', async (ctx) => { await db.supabase.from('pix_settings').update({ rotation_interval: 10, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Intervalo: 10 transações!'); return reloadRotationScreen(ctx); });
  bot.action('pix_interval_custom', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_rule', rule: 'interval' };
    await ctx.answerCbQuery();
    return ctx.reply('🔢 Digite o número de transações (ex: 12):', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'pix_rule_cancel')]]).reply_markup
    });
  });

  // ── Definir valor acumulado — wizard ───────────────────────
  bot.action('pix_set_accum', async (ctx) => {
    const { data: cfg } = await db.supabase.from('pix_settings').select('accumulated_min_value').single();
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_rule', rule: 'accum' };

    return ctx.editMessageText(
      `💰 *Definir Valor Mínimo Acumulado*\n\n` +
      `📌 *O que é:* Se um cliente já gastou X reais no total, a próxima compra vai para a chave secundária.\n\n` +
      `📊 *Valor atual:* R$ ${parseFloat(cfg?.accumulated_min_value || 60).toFixed(2)}\n\n` +
      `Escolha o valor mínimo acumulado:`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('R$ 50', 'pix_accum_50'), Markup.button.callback('R$ 60', 'pix_accum_60'), Markup.button.callback('R$ 100', 'pix_accum_100')],
          [Markup.button.callback('✏️ Digitar outro valor', 'pix_accum_custom')],
          [Markup.button.callback('◀️ Voltar', 'pix_rotation_rules')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_accum_50',  async (ctx) => { await db.supabase.from('pix_settings').update({ accumulated_min_value: 50,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Mínimo: R$ 50!'); return reloadRotationScreen(ctx); });
  bot.action('pix_accum_60',  async (ctx) => { await db.supabase.from('pix_settings').update({ accumulated_min_value: 60,  updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Mínimo: R$ 60!'); return reloadRotationScreen(ctx); });
  bot.action('pix_accum_100', async (ctx) => { await db.supabase.from('pix_settings').update({ accumulated_min_value: 100, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Mínimo: R$ 100!'); return reloadRotationScreen(ctx); });
  bot.action('pix_accum_custom', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_rule', rule: 'accum' };
    await ctx.answerCbQuery();
    return ctx.reply('💰 Digite o valor mínimo em reais (ex: 80):', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'pix_rule_cancel')]]).reply_markup
    });
  });

  // ── Definir porcentagem — wizard ───────────────────────────
  bot.action('pix_set_percentage', async (ctx) => {
    const { data: cfg } = await db.supabase.from('pix_settings').select('secondary_percentage').single();
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_rule', rule: 'perc' };

    return ctx.editMessageText(
      `📊 *Definir % de Distribuição*\n\n` +
      `📌 *O que é:* A cada 100 vendas, X vão aleatoriamente para a chave secundária.\n\n` +
      `_Exemplo: 20% = a cada 10 vendas, ~2 vão para a secundária_\n\n` +
      `📊 *Valor atual:* ${cfg?.secondary_percentage || 20}%\n\n` +
      `Escolha a porcentagem:`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('10%', 'pix_perc_10'), Markup.button.callback('20%', 'pix_perc_20'), Markup.button.callback('30%', 'pix_perc_30')],
          [Markup.button.callback('✏️ Digitar outro valor', 'pix_perc_custom')],
          [Markup.button.callback('◀️ Voltar', 'pix_rotation_rules')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_perc_10', async (ctx) => { await db.supabase.from('pix_settings').update({ secondary_percentage: 10, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Distribuição: 10%!'); return reloadRotationScreen(ctx); });
  bot.action('pix_perc_20', async (ctx) => { await db.supabase.from('pix_settings').update({ secondary_percentage: 20, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Distribuição: 20%!'); return reloadRotationScreen(ctx); });
  bot.action('pix_perc_30', async (ctx) => { await db.supabase.from('pix_settings').update({ secondary_percentage: 30, updated_at: new Date().toISOString() }).eq('id', 1); await ctx.answerCbQuery('✅ Distribuição: 30%!'); return reloadRotationScreen(ctx); });
  bot.action('pix_perc_custom', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = { type: 'pix_rule', rule: 'perc' };
    await ctx.answerCbQuery();
    return ctx.reply('📊 Digite a porcentagem (ex: 25):', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'pix_rule_cancel')]]).reply_markup
    });
  });

  bot.action('pix_rule_cancel', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    delete global._SESSIONS[ctx.from.id];
    await ctx.answerCbQuery('❌ Cancelado.');
    return ctx.deleteMessage().catch(() => {});
  });

  // ── Zerar contador com confirmação e feedback ──────────────
  bot.action('pix_reset_counter', async (ctx) => {
    const { data: cfg } = await db.supabase.from('pix_settings').select('transaction_counter').single();
    return ctx.editMessageText(
      `🔄 *Zerar Contador de Transações*\n\n` +
      `📊 *Contador atual:* ${cfg?.transaction_counter || 0} transações processadas\n\n` +
      `⚠️ Zerar o contador faz a rotação por N transações reiniciar do zero.\n\n` +
      `Deseja continuar?`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('✅ Sim, zerar', 'pix_reset_confirm')],
          [Markup.button.callback('❌ Cancelar', 'admin_pix_config')]
        ]).reply_markup
      }
    );
  });

  bot.action('pix_reset_confirm', async (ctx) => {
    await db.supabase.from('pix_settings').update({ transaction_counter: 0, updated_at: new Date().toISOString() }).eq('id', 1);
    return ctx.editMessageText(
      `✅ *Contador zerado com sucesso!*\n\n` +
      `A rotação por N transações reiniciará do zero.`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('◀️ Voltar', 'admin_pix_config')]]).reply_markup
      }
    );
  });

  // ── Ver log de uso PIX ─────────────────────────────────────
  bot.action('pix_view_log', async (ctx) => {
    try {
      const { data: logs } = await db.supabase
        .from('pix_transactions_control')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (!logs || logs.length === 0) {
        return ctx.editMessageText(
          `📊 *LOG DE USO PIX*\n\n` +
          `📭 Nenhuma transação registrada ainda.\n\n` +
          `_O log começa a ser preenchido automaticamente quando a rotação PIX está ativa e ocorrem vendas._`,
          {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([[Markup.button.callback('◀️ Voltar', 'admin_pix_config')]]).reply_markup
          }
        );
      }

      // Contar totais
      const totalPrincipal = logs.filter(l => l.pix_type === 'primary').length;
      const totalSecundaria = logs.filter(l => l.pix_type === 'secondary').length;
      const valorPrincipal = logs.filter(l => l.pix_type === 'primary').reduce((s,l) => s + parseFloat(l.amount||0), 0);
      const valorSecundaria = logs.filter(l => l.pix_type === 'secondary').reduce((s,l) => s + parseFloat(l.amount||0), 0);

      const motivoMap = {
        'rotation': '🔄 Rotação',
        'accumulated': '💰 Acumulado',
        'distribution': '📊 Distribuição',
        'default': '🔵 Padrão',
        'secondary_inactive': '🔵 Padrão',
        'fallback': '🔵 Fallback'
      };

      let msg = `📊 *LOG DE USO PIX*\n\n`;
      msg += `🔵 Principal: ${totalPrincipal} trans. | R$ ${valorPrincipal.toFixed(2)}\n`;
      msg += `🟡 Secundária: ${totalSecundaria} trans. | R$ ${valorSecundaria.toFixed(2)}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (const log of logs.slice(0, 10)) {
        const hora = new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const tipo = log.pix_type === 'primary' ? '🔵' : '🟡';
        const motivo = motivoMap[log.reason] || log.reason;
        msg += `${tipo} R$${parseFloat(log.amount||0).toFixed(2)} | ${motivo} | ${hora}\n`;
      }

      return ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('◀️ Voltar', 'admin_pix_config')]]).reply_markup
      });
    } catch (err) {
      return ctx.answerCbQuery('❌ Erro ao carregar log.', { show_alert: true });
    }
  });

  // ── Handler de texto: salvar configurações PIX via mensagem ─
  // Adicione este bloco dentro do handler de mensagens de texto do admin
  // Procure por: bot.on('message', ...) ou bot.on('text', ...) no admin.js
  // e adicione ANTES do processamento padrão:
  //
  // if (text.startsWith('PIX2|')) { ... }
  // if (text.startsWith('PIX_INTERVAL|')) { ... }
  // if (text.startsWith('PIX_ACCUM|')) { ... }
  // if (text.startsWith('PIX_PERC|')) { ... }
  //
  // OU use o comando /pixconfig para configurar via terminal do bot
  bot.command('pixconfig', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');

    const args = ctx.message.text.split(' ').slice(1).join(' ');
    if (!args) {
      return ctx.reply(
        `🔧 *CONFIGURAÇÃO PIX VIA COMANDO*\n\n` +
        `*Chave secundária:*\n\`/pixconfig PIX2|chave|nome|banco\`\n\n` +
        `*Intervalo de rotação:*\n\`/pixconfig INTERVAL|5\`\n\n` +
        `*Valor acumulado mínimo:*\n\`/pixconfig ACCUM|60\`\n\n` +
        `*% distribuição:*\n\`/pixconfig PERC|20\``,
        { parse_mode: 'Markdown' }
      );
    }

    try {
      if (args.startsWith('PIX2|')) {
        const parts = args.split('|');
        if (parts[1] === 'cancelar') return ctx.reply('❌ Operação cancelada.');
        await db.supabase.from('pix_settings').update({
          secondary_pix_key: parts[1]?.trim() || '',
          secondary_holder:  parts[2]?.trim() || '',
          secondary_bank:    parts[3]?.trim() || '',
          updated_at: new Date().toISOString()
        }).eq('id', 1);
        return ctx.reply(`✅ Chave secundária configurada: \`${parts[1]}\``, { parse_mode: 'Markdown' });
      }

      if (args.startsWith('INTERVAL|')) {
        const val = parseInt(args.split('|')[1]);
        if (isNaN(val) || val < 1) return ctx.reply('❌ Número inválido. Use ex: INTERVAL|5');
        await db.supabase.from('pix_settings').update({ rotation_interval: val, updated_at: new Date().toISOString() }).eq('id', 1);
        return ctx.reply(`✅ Intervalo definido: a cada *${val}* transações`, { parse_mode: 'Markdown' });
      }

      if (args.startsWith('ACCUM|')) {
        const val = parseFloat(args.split('|')[1]);
        if (isNaN(val) || val < 0) return ctx.reply('❌ Valor inválido. Use ex: ACCUM|60');
        await db.supabase.from('pix_settings').update({ accumulated_min_value: val, updated_at: new Date().toISOString() }).eq('id', 1);
        return ctx.reply(`✅ Valor mínimo acumulado: *R$ ${val.toFixed(2)}*`, { parse_mode: 'Markdown' });
      }

      if (args.startsWith('PERC|')) {
        const val = parseInt(args.split('|')[1]);
        if (isNaN(val) || val < 1 || val > 100) return ctx.reply('❌ Porcentagem inválida (1-100). Use ex: PERC|20');
        await db.supabase.from('pix_settings').update({ secondary_percentage: val, updated_at: new Date().toISOString() }).eq('id', 1);
        return ctx.reply(`✅ Distribuição: *${val}%* das transações na chave secundária`, { parse_mode: 'Markdown' });
      }

      return ctx.reply('❌ Formato inválido. Use /pixconfig sem argumentos para ver os formatos disponíveis.');
    } catch (err) {
      console.error('Erro pixconfig:', err);
      return ctx.reply('❌ Erro ao salvar configuração PIX.');
    }
  });

}

module.exports = { registerAdminCommands };
}

module.exports = { registerSettingsHandlers };
